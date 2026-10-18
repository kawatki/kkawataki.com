import "server-only"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { getLookupBooking } from "@/lib/google-calendar"
import { bookingWasCancelled } from "@/lib/cancellation-store"
import { bookingPricingFromMetadata, cancellationPolicyFromMetadata } from "@/lib/booking-policy"
import { bookingTransportBufferMinutes, type BookingReceipt } from "@/lib/booking"

export class LookupInputError extends Error {}
export function parseLookupInput(value: unknown) {
  const input = value as Record<string, unknown> | null
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : ""
  const last4 = typeof input?.last4 === "string" ? input.last4 : ""
  const expiry = typeof input?.expiry === "string" ? input.expiry.trim() : ""
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry)
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4}$/.test(last4) || !match) {
    throw new LookupInputError("Enter your booking email, four card digits, and expiry as MM/YY.")
  }
  // Expired cards are valid for looking up historical payments.
  return { email, last4, month: Number(match[1]), year: 2000 + Number(match[2]) }
}

export type LookupBooking = {
  reference: string
  status: "confirmed" | "cancelled" | "refunded" | "processing"
  title: string
  slotStart: string | null
  slotEnd: string | null
  location: string
  paidJpy: number
  refundedJpy: number
  receipt?: BookingReceipt
}

export async function lookupBookings(input: ReturnType<typeof parseLookupInput>): Promise<LookupBooking[]> {
  const stripe = getStripe()
  const results: LookupBooking[] = []
  const seen = new Set<string>()
  for await (const charge of lookupCharges(stripe, input)) {
    const card = charge.payment_method_details?.card
    if (!charge.paid || charge.currency !== "jpy" || card?.last4 !== input.last4 || card.exp_month !== input.month || card.exp_year !== input.year) continue
    const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id
    if (!intent || seen.has(intent)) continue
    // Checkout email is authoritative, including guest checkouts without a Customer.
    const sessions = await stripe.checkout.sessions.list({ payment_intent: intent, limit: 1 })
    const session = sessions.data[0]
    const email = (session?.customer_details?.email ?? session?.customer_email ?? "").trim().toLowerCase()
    const metadata = session?.metadata ?? {}
    if (!session || email !== input.email || session.payment_status !== "paid" || !metadata.booking_event_id || !metadata.booking_reference) continue
    seen.add(intent)
    const calendar = await getLookupBooking(metadata.booking_event_id, session.id)
    const cancelled = await bookingWasCancelled(session.id) || calendar?.state === "cancelled"
    const status = cancelled ? "cancelled" : charge.refunded ? "refunded" : calendar?.state === "confirmed" ? "confirmed" : "processing"
    const slotStart = calendar?.slotStart && Number.isFinite(Date.parse(calendar.slotStart)) ? calendar.slotStart : null
    const slotEnd = calendar?.slotEnd && Number.isFinite(Date.parse(calendar.slotEnd)) ? calendar.slotEnd : null
    results.push({
      reference: metadata.booking_reference, status, title: metadata.booking_title ?? "",
      slotStart, slotEnd, location: calendar?.location ?? metadata.booking_location ?? "",
      paidJpy: charge.amount, refundedJpy: charge.amount_refunded,
      ...(status === "confirmed" && slotStart && slotEnd ? { receipt: {
        ...bookingPricingFromMetadata(metadata, session.amount_total, session.currency),
        cancellationPolicy: cancellationPolicyFromMetadata(metadata),
        bookingReference: metadata.booking_reference, customerEmail: input.email,
        requestTitle: metadata.booking_title ?? "", slotStart, slotEnd,
        transportBufferMinutes: bookingTransportBufferMinutes(),
      } } : {}),
    })
  }
  return results.sort((a, b) => (b.slotStart ?? "").localeCompare(a.slotStart ?? ""))
}

async function* lookupCharges(stripe: Stripe, input: ReturnType<typeof parseLookupInput>) {
  // Stripe Search is eventually consistent. Read recent charges directly so a
  // paid booking is discoverable immediately, including guest Checkout sessions.
  const recentSince = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60
  let startingAfter: string | undefined
  let recentComplete = false
  for (let count = 0; count < 10; count++) {
    const charges = await stripe.charges.list({
      created: { gte: recentSince }, limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    yield* charges.data
    if (!charges.has_more) { recentComplete = true; break }
    startingAfter = charges.data.at(-1)?.id
    if (!startingAfter) break
  }
  if (!recentComplete) throw new Error("Lookup recent-payment limit reached")

  // The disjoint time ranges avoid duplicates and keep historical lookup fast.
  let page: string | undefined
  for (let count = 0; count < 10; count++) {
    const charges = await stripe.charges.search({
      query: `payment_method_details.card.last4:'${input.last4}' AND payment_method_details.card.exp_month:'${input.month}' AND payment_method_details.card.exp_year:'${input.year}' AND status:'succeeded' AND created<${recentSince}`,
      limit: 100,
      ...(page ? { page } : {}),
    })
    yield* charges.data
    if (!charges.has_more) return
    if (!charges.next_page) break
    page = charges.next_page
  }
  // Never return a partial search as a definitive empty result.
  throw new Error("Lookup search limit reached")
}
