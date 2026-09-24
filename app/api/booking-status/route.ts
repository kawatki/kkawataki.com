import { bookingPricingFromMetadata, cancellationPolicyFromMetadata } from "@/lib/booking-policy"
import { bookingWasCancelled } from "@/lib/cancellation-store"
import {
  bookingTransportBufferMinutes,
} from "@/lib/booking"
import { getBookingState } from "@/lib/google-calendar"
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit"
import { getStripe } from "@/lib/stripe"

function isMissingStripeSession(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "resource_missing"
  )
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request.headers, {
    bucket: "booking-status",
    limit: 60,
    windowSeconds: 5 * 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit)
  }

  const sessionId = new URL(request.url).searchParams.get("session_id")
  if (!sessionId?.startsWith("cs_")) {
    return Response.json({ status: "invalid" }, { status: 400 })
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    const eventId = session.metadata?.booking_event_id
    if (session.payment_status !== "paid") {
      return Response.json({ status: "incomplete" })
    }
    const pricing = bookingPricingFromMetadata(session.metadata ?? {}, session.amount_total, session.currency)
    if (await bookingWasCancelled(session.id)) return Response.json({ status: "cancelled" })

    if (!eventId) {
      return Response.json({ status: "invalid" }, { status: 400 })
    }

    const calendarState = await getBookingState(eventId, session.id)
    if (calendarState === "expired" || calendarState === "conflict") {
      return Response.json({ status: "refunded" })
    }
    const metadata = session.metadata ?? {}
    const receipt =
      metadata.booking_reference &&
      metadata.slot_start &&
      metadata.slot_end
        ? {
            cancellationPolicy: cancellationPolicyFromMetadata(metadata),
            balanceDueJpy: pricing.balanceDueJpy,
            bookingReference: metadata.booking_reference,
            customerEmail:
              session.customer_details?.email ?? session.customer_email ?? "",
            depositAmountJpy: pricing.depositAmountJpy,
            durationHours: pricing.durationHours,
            rateJpyPer30Minutes: pricing.rateJpyPer30Minutes,
            requestTitle: metadata.booking_title ?? "",
            serviceTotalJpy: pricing.serviceTotalJpy,
            slotEnd: metadata.slot_end,
            slotStart: metadata.slot_start,
            transportBufferMinutes: bookingTransportBufferMinutes(),
          }
        : undefined
    return Response.json({
      receipt,
      status: calendarState === "confirmed" ? "confirmed" : "processing",
    })
  } catch (error) {
    if (isMissingStripeSession(error)) {
      return Response.json({ status: "invalid" }, { status: 404 })
    }
    console.error("Booking status lookup failed", error)
    return Response.json({ status: "error" }, { status: 502 })
  }
}
