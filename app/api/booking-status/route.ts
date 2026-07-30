import {
  bookingTransportBufferMinutes,
  getBookingPricing,
} from "@/lib/booking"
import { getBookingState } from "@/lib/google-calendar"
import { getStripe } from "@/lib/stripe"

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id")
  if (!sessionId?.startsWith("cs_")) {
    return Response.json({ status: "invalid" }, { status: 400 })
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    const eventId = session.metadata?.booking_event_id
    const durationMinutes = Number(
      session.metadata?.booking_duration_minutes ?? 4 * 60
    )
    const pricing = getBookingPricing(durationMinutes)
    const paid =
      session.payment_status === "paid" &&
      session.amount_total === pricing.depositAmountJpy &&
      session.currency === "jpy"

    if (!paid || !eventId) {
      return Response.json({ status: "pending" })
    }

    const calendarState = await getBookingState(eventId, session.id)
    const metadata = session.metadata ?? {}
    const receipt =
      metadata.booking_reference &&
      metadata.slot_start &&
      metadata.slot_end
        ? {
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
    console.error("Booking status lookup failed", error)
    return Response.json({ status: "processing" })
  }
}
