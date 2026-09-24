import type Stripe from "stripe"

import { bookingPricingFromMetadata } from "@/lib/booking-policy"
import { bookingWasCancelled } from "@/lib/cancellation-store"
import {
  confirmPaidBooking,
  deleteHoldByStripeSession,
} from "@/lib/google-calendar"
import { createStripeCommerceCheckoutTask } from "@/lib/google-commerce-tasks"
import { createStripeCustomRequestTask } from "@/lib/google-tasks"
import { requiredEnv } from "@/lib/server-config"
import { getStripe, getStripeCryptoProvider } from "@/lib/stripe"

async function refundConflictingPayment(session: Stripe.Checkout.Session) {
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id

  if (!paymentIntent) {
    throw new Error("Paid Checkout Session has no PaymentIntent.")
  }

  await getStripe().refunds.create(
    {
      payment_intent: paymentIntent,
      reason: "requested_by_customer",
    },
    { idempotencyKey: `booking-conflict-${session.id}` }
  )
}

async function fulfillCheckout(
  session: Stripe.Checkout.Session,
  paidAt: number
) {
  if (session.payment_status !== "paid") {
    return
  }

  const metadata = session.metadata ?? {}
  if (metadata.custom_request_terms_accepted) {
    await fulfillCustomRequestCheckout(session, paidAt)
    return
  }
  if (metadata.item_checkout || metadata.package_checkout) {
    await fulfillCommerceCheckout(session, paidAt)
    return
  }

  if (await bookingWasCancelled(session.id)) return
  const pricing = bookingPricingFromMetadata(metadata, session.amount_total, session.currency)

  const email = session.customer_details?.email ?? session.customer_email
  const eventId = metadata.booking_event_id

  if (
    !email ||
    !eventId ||
    !metadata.customer_name ||
    !metadata.booking_title
  ) {
    throw new Error("Paid Checkout Session is missing booking metadata.")
  }

  const result = await confirmPaidBooking({
    alternateContact: metadata.alternate_contact ?? "",
    balanceDueJpy: pricing.balanceDueJpy,
    depositAmountJpy: pricing.depositAmountJpy,
    depositPercent: pricing.depositPercent,
    durationHours: pricing.durationHours,
    email,
    eventId,
    location: metadata.booking_location ?? "",
    name: metadata.customer_name,
    notes: [metadata.booking_notes ?? "", ...(metadata.people_count ? [`Group size: ${metadata.people_count}`, `${metadata.recording_pricing_version === "social-media-v1" ? "Social media participation" : "Face recording consent"}: ${metadata.face_recording_consent === "true" ? "Yes" : "No"}`, ...(metadata.surroundings_recording_consent !== undefined ? [`Food and surroundings recording consent: ${metadata.surroundings_recording_consent === "true" ? "Yes" : "No"}`] : [])] : [])].filter(Boolean).join("\n"),
    paidAt,
    rateJpyPer30Minutes: pricing.rateJpyPer30Minutes,
    sessionId: session.id,
    serviceTotalJpy: pricing.serviceTotalJpy,
    socialHandle: metadata.social_handle ?? "",
    socialPlatform:
      metadata.social_platform === "discord" ||
      metadata.social_platform === "instagram" ||
      metadata.social_platform === "line" ||
      metadata.social_platform === "telegram" ||
      metadata.social_platform === "whatsapp" ||
      metadata.social_platform === "x"
        ? metadata.social_platform
        : "none",
    title: metadata.booking_title,
  })

  if ("conflict" in result) {
    await refundConflictingPayment(session)
  }
}

async function fulfillCommerceCheckout(
  session: Stripe.Checkout.Session,
  paidAt: number
) {
  const metadata = session.metadata ?? {}
  const amountJpy = Number(metadata.item_total_jpy)
  const email = session.customer_details?.email ?? session.customer_email
  const reference = metadata.item_reference ?? metadata.package_reference ?? ""

  if (
    session.currency !== "jpy" ||
    session.amount_total !== amountJpy ||
    !Number.isInteger(amountJpy) ||
    !email ||
    !metadata.customer_name ||
    !reference ||
    !metadata.item_summary
  ) {
    throw new Error("Paid commerce Checkout Session is missing metadata.")
  }

  const itemLines = parseCommerceItemLines(metadata.item_lines)

  await createStripeCommerceCheckoutTask({
    amountJpy,
    email,
    itemIds: metadata.item_ids ?? metadata.item_id ?? "",
    itemKind: metadata.item_kind ?? "",
    itemLines,
    itemSummary: metadata.item_summary,
    name: metadata.customer_name,
    notes: metadata.item_notes ?? "",
    paidAt,
    preferredDate: metadata.preferred_date ?? "",
    reference,
    requiresShipping: metadata.item_requires_shipping === "true",
    sessionId: session.id,
    shippingAddress:
      metadata.item_requires_shipping === "true"
        ? {
            addressLine1: metadata.shipping_address_line_1 ?? "",
            addressLine2: metadata.shipping_address_line_2 ?? "",
            city: metadata.shipping_city ?? "",
            country: metadata.shipping_country ?? "",
            postalCode: metadata.shipping_postal_code ?? "",
            region: metadata.shipping_region ?? "",
          }
        : null,
    socialHandle: metadata.social_handle ?? "",
    socialPlatform:
      metadata.social_platform === "discord" ||
      metadata.social_platform === "instagram" ||
      metadata.social_platform === "line" ||
      metadata.social_platform === "telegram" ||
      metadata.social_platform === "whatsapp" ||
      metadata.social_platform === "x"
        ? metadata.social_platform
        : "none",
  })
}

function parseCommerceItemLines(value: string | undefined) {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap((line) => {
      const candidate = line as Record<string, unknown>
      if (
        typeof candidate.i !== "string" ||
        typeof candidate.k !== "string" ||
        typeof candidate.s !== "string" ||
        typeof candidate.a !== "number" ||
        !Number.isInteger(candidate.a)
      ) {
        return []
      }

      return [
        {
          amountJpy: candidate.a,
          itemId: candidate.i,
          itemKind: candidate.k,
          itemSummary: candidate.s,
          requiresShipping: candidate.sh === true,
        },
      ]
    })
  } catch {
    return []
  }
}

async function fulfillCustomRequestCheckout(
  session: Stripe.Checkout.Session,
  paidAt: number
) {
  const metadata = session.metadata ?? {}
  const amountJpy = Number(metadata.amount_jpy)
  const email = session.customer_details?.email ?? session.customer_email

  if (
    session.currency !== "jpy" ||
    session.amount_total !== amountJpy ||
    !Number.isInteger(amountJpy) ||
    !email ||
    !metadata.customer_name ||
    !metadata.request_reference ||
    !metadata.request_title
  ) {
    throw new Error("Paid custom request Checkout Session is missing metadata.")
  }

  await createStripeCustomRequestTask({
    paidAt,
    request: {
      amountJpy,
      email,
      name: metadata.customer_name,
      notes: metadata.request_notes ?? "",
      requestTitle: metadata.request_title,
      socialHandle: metadata.social_handle ?? "",
      socialPlatform:
        metadata.social_platform === "discord" ||
        metadata.social_platform === "instagram" ||
        metadata.social_platform === "line" ||
        metadata.social_platform === "telegram" ||
        metadata.social_platform === "whatsapp" ||
        metadata.social_platform === "x"
          ? metadata.social_platform
          : "none",
      termsAccepted: true,
    },
    requestReference: metadata.request_reference,
    sessionId: session.id,
  })
}

async function expireCheckoutHold(session: Stripe.Checkout.Session) {
  if (session.status !== "expired") {
    return
  }

  const metadata = session.metadata ?? {}
  if (
    metadata.custom_request_terms_accepted ||
    metadata.item_checkout ||
    metadata.package_checkout
  ) {
    return
  }

  const eventId = metadata.booking_event_id
  if (!eventId) {
    return
  }

  await deleteHoldByStripeSession(eventId, session.id)
}

// Failed events can arrive out of order. Check Stripe's current state first,
// and expire the checkout before releasing its hold so a retry cannot pay it.
async function releaseFailedPayment(intent: Stripe.PaymentIntent) {
  const eventId = intent.metadata.booking_event_id
  if (!eventId || !intent.metadata.booking_reference) return
  const current = await getStripe().paymentIntents.retrieve(intent.id)
  if (!["requires_payment_method", "canceled"].includes(current.status)) return
  const sessions = await getStripe().checkout.sessions.list({ payment_intent: intent.id, limit: 10 })
  for (const candidate of sessions.data) {
    if (candidate.metadata?.booking_event_id !== eventId) continue
    let session = await getStripe().checkout.sessions.retrieve(candidate.id)
    if (session.payment_status !== "unpaid") continue
    if (session.status === "open") {
      // A concurrent successful payment makes expiration fail; retry the webhook
      // instead of releasing a newly paid customer's time.
      session = await getStripe().checkout.sessions.expire(session.id)
    }
    if (session.status === "expired" && session.payment_status === "unpaid") {
      await deleteHoldByStripeSession(eventId, session.id)
    }
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return new Response("Missing Stripe signature.", { status: 400 })
  }

  let event: Stripe.Event
  try {
    const body = await request.text()
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      requiredEnv("STRIPE_WEBHOOK_SECRET"),
      undefined,
      getStripeCryptoProvider()
    )

  } catch (error) {
    console.error("Stripe webhook signature verification failed", error)
    return new Response("Invalid webhook signature.", { status: 400 })
  }

  try {
    if (event.type === "checkout.session.completed") {
      await fulfillCheckout(event.data.object, event.created)
    } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      await releaseFailedPayment(event.data.object)
    } else if (event.type === "checkout.session.expired") {
      await expireCheckoutHold(event.data.object)
    }
    return Response.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook fulfillment failed", error)
    return new Response("Webhook fulfillment failed.", { status: 500 })
  }
}
