import type Stripe from "stripe"

import { getBookingPricing } from "@/lib/booking"
import { confirmPaidBooking } from "@/lib/google-calendar"
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
  const hasVariablePricing = Boolean(metadata.booking_duration_minutes)
  const durationMinutes = Number(
    metadata.booking_duration_minutes ?? 4 * 60
  )
  const pricing = getBookingPricing(durationMinutes)
  if (
    session.amount_total !== pricing.depositAmountJpy ||
    session.currency !== "jpy" ||
    (hasVariablePricing &&
      (metadata.deposit_amount_jpy !== String(pricing.depositAmountJpy) ||
        metadata.service_total_jpy !== String(pricing.serviceTotalJpy)))
  ) {
    throw new Error("Paid Checkout Session has invalid pricing metadata.")
  }

  const email = session.customer_details?.email ?? session.customer_email
  const eventId = metadata.booking_event_id

  if (!email || !eventId || !metadata.customer_name || !metadata.booking_title) {
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
    name: metadata.customer_name,
    notes: metadata.booking_notes ?? "",
    paidAt,
    rateJpyPer30Minutes: pricing.rateJpyPer30Minutes,
    sessionId: session.id,
    serviceTotalJpy: pricing.serviceTotalJpy,
    socialHandle: metadata.social_handle ?? "",
    socialPlatform:
      metadata.social_platform === "discord" ||
      metadata.social_platform === "instagram" ||
      metadata.social_platform === "line" ||
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
    }
    return Response.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook fulfillment failed", error)
    return new Response("Webhook fulfillment failed.", { status: 500 })
  }
}
