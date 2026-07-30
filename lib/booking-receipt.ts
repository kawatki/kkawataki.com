import "server-only"

import type { BookingReceipt } from "@/lib/booking"
import { bookingTransportBufferMinutes } from "@/lib/booking"
import { findConfirmedBookingByReference } from "@/lib/google-calendar"
import { getStripe } from "@/lib/stripe"

const BOOKING_REFERENCE_PATTERN =
  /^RJG-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/u

function positiveInteger(value: string | null | undefined) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@")
  if (!local || !domain) {
    return ""
  }
  return `${local.slice(0, 1)}•••@${domain}`
}

export function normalizeBookingReference(value: string) {
  const normalized = value.trim().toUpperCase()
  return BOOKING_REFERENCE_PATTERN.test(normalized) ? normalized : null
}

export async function getPublicBookingReceipt(
  value: string
): Promise<BookingReceipt | null> {
  const bookingReference = normalizeBookingReference(value)
  if (!bookingReference) {
    return null
  }

  const calendarBooking =
    await findConfirmedBookingByReference(bookingReference)
  if (!calendarBooking) {
    return null
  }

  const session = await getStripe().checkout.sessions.retrieve(
    calendarBooking.stripeSessionId
  )
  const metadata = session.metadata ?? {}
  const durationMinutes = positiveInteger(
    metadata.booking_duration_minutes
  )
  const rateJpyPer30Minutes = positiveInteger(
    metadata.rate_jpy_per_30_minutes
  )
  const serviceTotalJpy = positiveInteger(metadata.service_total_jpy)
  const depositAmountJpy = positiveInteger(metadata.deposit_amount_jpy)
  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? ""

  if (
    session.payment_status !== "paid" ||
    session.currency !== "jpy" ||
    metadata.booking_reference !== bookingReference ||
    metadata.booking_event_id !== calendarBooking.eventId ||
    !durationMinutes ||
    durationMinutes % 30 !== 0 ||
    !rateJpyPer30Minutes ||
    !serviceTotalJpy ||
    serviceTotalJpy !== rateJpyPer30Minutes * (durationMinutes / 30) ||
    !depositAmountJpy ||
    session.amount_total !== depositAmountJpy ||
    !customerEmail
  ) {
    return null
  }

  return {
    balanceDueJpy: serviceTotalJpy - depositAmountJpy,
    bookingReference,
    customerEmail: maskEmail(customerEmail),
    depositAmountJpy,
    durationHours: durationMinutes / 60,
    rateJpyPer30Minutes,
    requestTitle: metadata.booking_title ?? "",
    serviceTotalJpy,
    slotEnd: calendarBooking.slotEnd,
    slotStart: calendarBooking.slotStart,
    transportBufferMinutes: bookingTransportBufferMinutes(),
  }
}
