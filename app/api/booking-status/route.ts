import { DEPOSIT_AMOUNT_JPY } from "@/lib/booking"
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
    const paid =
      session.payment_status === "paid" &&
      session.amount_total === DEPOSIT_AMOUNT_JPY &&
      session.currency === "jpy"

    if (!paid || !eventId) {
      return Response.json({ status: "pending" })
    }

    const calendarState = await getBookingState(eventId, session.id)
    return Response.json({
      status: calendarState === "confirmed" ? "confirmed" : "processing",
    })
  } catch (error) {
    console.error("Booking status lookup failed", error)
    return Response.json({ status: "processing" })
  }
}
