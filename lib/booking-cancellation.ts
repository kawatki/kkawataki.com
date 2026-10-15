import "server-only"
import type Stripe from "stripe"

import { normalizeBookingReference } from "@/lib/booking-receipt"
import { cancellationPolicyFromMetadata, cancellationRefund } from "@/lib/booking-policy"
import { findConfirmedBookingByReference, releaseCancelledBooking } from "@/lib/google-calendar"
import { cancellationDatabase, findCancellation, recordCancellation, type CancellationRecord } from "@/lib/cancellation-store"
import { requiredEnv } from "@/lib/server-config"
import { getStripe } from "@/lib/stripe"

export class CancellationInputError extends Error {}

async function hashEmail(email: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email))
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("")
}

export function parseCancellationInput(input: unknown) {
  const value = input as Record<string, unknown> | null
  const email = typeof value?.email === "string" ? value.email.trim().toLowerCase() : ""
  const reference = typeof value?.reference === "string" ? normalizeBookingReference(value.reference) : null
  if (!reference || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CancellationInputError("Enter your booking email and a valid RJG booking reference.")
  }
  return { email, reference }
}

async function signingKey() {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(requiredEnv("STRIPE_WEBHOOK_SECRET")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0))
}

type Quote = { reference: string; sessionId: string; emailHash: string; start: string; paid: number; amount: number; percent: number; expires: number }
async function signQuote(quote: Quote) {
  const payload = encode(new TextEncoder().encode(JSON.stringify(quote)))
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(`booking-cancel:${payload}`))
  return `${payload}.${encode(new Uint8Array(signature))}`
}
async function readQuote(token: unknown): Promise<Quote> {
  try {
    if (typeof token !== "string" || token.length > 3000) throw new Error()
    const [payload, signature, extra] = token.split(".")
    if (extra || !signature || !await crypto.subtle.verify("HMAC", await signingKey(), decode(signature), new TextEncoder().encode(`booking-cancel:${payload}`))) throw new Error()
    const quote = JSON.parse(new TextDecoder().decode(decode(payload))) as Quote
    if (!Number.isFinite(quote.expires) || quote.expires < Date.now()) throw new Error()
    return quote
  } catch {
    throw new CancellationInputError("Your refund estimate expired. Look up your booking again.")
  }
}

async function authenticatedBooking(email: string, reference: string) {
  const emailHash = await hashEmail(email)
  const existing = await findCancellation(reference)
  if (existing) {
    if (existing.email_hash !== emailHash) throw new CancellationInputError("No booking matches those details.")
    return { existing, emailHash }
  }
  const booking = await findConfirmedBookingByReference(reference)
  if (!booking) throw new CancellationInputError("No booking matches those details.")
  const session = await getStripe().checkout.sessions.retrieve(booking.stripeSessionId)
  const metadata = session.metadata ?? {}
  const paidEmail = (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase()
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id
  if (paidEmail !== email || session.payment_status !== "paid" || session.currency !== "jpy" ||
      metadata.booking_reference !== reference || metadata.booking_event_id !== booking.eventId ||
      !Number.isSafeInteger(session.amount_total) || !session.amount_total || !paymentIntent) {
    throw new CancellationInputError("No booking matches those details.")
  }
  const policy = cancellationPolicyFromMetadata(metadata)
  let refund
  try { refund = cancellationRefund(session.amount_total, booking.slotStart, policy, Date.now(), { paidAt: Number(metadata.booking_paid_at) * 1000, shortNoticeApproved: metadata.short_notice_approved === "true", arrangementsStarted: metadata.arrangements_started === "true" }) }
  catch (error) { throw new CancellationInputError(error instanceof Error ? error.message : "Unable to calculate a refund. Please contact Taki.") }
  return { emailHash, booking, session, paymentIntent, policy, refund }
}

function cancellationResult(row: CancellationRecord) {
  return {
    reference: row.reference,
    slotStart: row.slot_start,
    amountPaidJpy: row.amount_paid,
    refundAmountJpy: row.refund_amount,
    refundPercent: row.refund_percent,
    cancelled: Boolean(row.calendar_released),
    requested: true,
    refundStatus: row.refund_status,
  }
}

export async function previewCancellation(email: string, reference: string) {
  const booking = await authenticatedBooking(email, reference)
  if (booking.existing) return cancellationResult(booking.existing)
  const { session, refund, policy } = booking
  const quote: Quote = {
    reference, sessionId: session.id, emailHash: booking.emailHash,
    start: booking.booking.slotStart, paid: session.amount_total!, amount: refund.amountJpy,
    percent: refund.percent, expires: Date.now() + 10 * 60 * 1000,
  }
  return {
    reference, slotStart: quote.start, amountPaidJpy: quote.paid,
    refundAmountJpy: quote.amount, refundPercent: quote.percent,
    legacyPolicy: policy.version === "legacy-non-refundable", requested: false,
    quote: await signQuote(quote),
  }
}

export async function confirmCancellation(email: string, reference: string, token: unknown) {
  const booking = await authenticatedBooking(email, reference)
  if (booking.existing) return cancellationResult(await processCancellation(booking.existing))
  const quote = await readQuote(token)
  if (quote.reference !== reference || quote.emailHash !== booking.emailHash ||
      quote.sessionId !== booking.session.id || quote.start !== booking.booking.slotStart ||
      quote.paid !== booking.session.amount_total || quote.amount !== booking.refund.amountJpy ||
      quote.percent !== booking.refund.percent) {
    throw new CancellationInputError("The booking or refund has changed. Look up your booking again before confirming.")
  }
  const record = await recordCancellation({
    reference, session_id: booking.session.id, event_id: booking.booking.eventId,
    email_hash: booking.emailHash, slot_start: quote.start, requested_at: Date.now(),
    amount_paid: quote.paid, refund_percent: quote.percent, refund_amount: quote.amount,
    payment_intent: booking.paymentIntent, refund_id: null, refund_status: "not_started",
    calendar_released: 0, lock_token: null, locked_until: 0,
  })
  return cancellationResult(await processCancellation(record))
}

export async function processCancellation(record: CancellationRecord) {
  const db = await cancellationDatabase()
  const lock = crypto.randomUUID()
  const row = await db.prepare(`UPDATE booking_cancellations SET lock_token = ?, locked_until = ?
    WHERE reference = ? AND locked_until < ? RETURNING *`)
    .bind(lock, Date.now() + 5 * 60 * 1000, record.reference, Date.now()).first<CancellationRecord>()
  if (!row) return await findCancellation(record.reference) ?? record
  try {
    // Release the schedule even when a refund is zero or Stripe needs a retry.
    if (!row.calendar_released) {
      await releaseCancelledBooking(row.event_id, row.session_id)
      await db.prepare("UPDATE booking_cancellations SET calendar_released = 1 WHERE reference = ? AND lock_token = ?")
        .bind(row.reference, lock).run()
    }
    let status = row.refund_status
    let refundId = row.refund_id
    if (row.refund_amount === 0) {
      status = "not_due"
    } else if (!["succeeded", "failed", "canceled", "needs_attention"].includes(status)) {
      const stripe = getStripe()
      let refund: Stripe.Refund | undefined = refundId ? await stripe.refunds.retrieve(refundId) : undefined
      if (!refund) {
        // Check durable Stripe history too: idempotency keys expire after 24 hours.
        for await (const candidate of stripe.refunds.list({ payment_intent: row.payment_intent, limit: 100 })) {
          if (candidate.metadata?.cancellation_reference === row.reference) { refund = candidate; break }
        }
      }
      if (!refund) {
        const intent = await stripe.paymentIntents.retrieve(row.payment_intent, { expand: ["latest_charge"] })
        const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null
        if (!charge || charge.disputed || charge.amount_refunded > 0) {
          status = "needs_attention"
        } else {
          refund = await stripe.refunds.create({
            payment_intent: row.payment_intent, amount: row.refund_amount,
            reason: "requested_by_customer", metadata: { cancellation_reference: row.reference },
          }, { idempotencyKey: `customer-cancellation-${row.session_id}` })
        }
      }
      if (refund) {
        refundId = refund.id
        status = refund.amount === row.refund_amount ? refund.status ?? "pending" : "needs_attention"
      }
    }
    await db.prepare("UPDATE booking_cancellations SET refund_id = ?, refund_status = ? WHERE reference = ? AND lock_token = ?")
      .bind(refundId, status, row.reference, lock).run()
  } catch (error) {
    // The accepted request remains durable and may be resumed without changing its refund.
    console.error("Cancellation processing needs retry", row.reference, error)
  } finally {
    await db.prepare("UPDATE booking_cancellations SET lock_token = NULL, locked_until = 0 WHERE reference = ? AND lock_token = ?")
      .bind(row.reference, lock).run()
  }
  return await findCancellation(row.reference) ?? row
}

export async function retryBookingCancellations() {
  const db = await cancellationDatabase()
  const { results } = await db.prepare(`SELECT * FROM booking_cancellations
    WHERE (calendar_released = 0 OR refund_status IN ('not_started', 'pending', 'requires_action'))
    AND locked_until < ? ORDER BY requested_at LIMIT 20`).bind(Date.now()).all<CancellationRecord>()
  for (const row of results) await processCancellation(row)
  return results.length
}
