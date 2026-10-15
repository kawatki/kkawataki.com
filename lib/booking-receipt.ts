import "server-only"
import { bookingPricingFromMetadata, cancellationPolicyFromMetadata } from "@/lib/booking-policy"

import type { BookingReceipt } from "@/lib/booking"
import { bookingTransportBufferMinutes } from "@/lib/booking"
import { findConfirmedBookingByReference } from "@/lib/google-calendar"
import { getStripe } from "@/lib/stripe"

const BOOKING_REFERENCE_PATTERN =
  /^RJG-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/u

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
  let pricing: ReturnType<typeof bookingPricingFromMetadata>
  try {
    pricing = bookingPricingFromMetadata(metadata, session.amount_total, session.currency)
  } catch {
    return null
  }
  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? ""

  if (
    session.payment_status !== "paid" ||
    session.currency !== "jpy" ||
    metadata.booking_reference !== bookingReference ||
    metadata.booking_event_id !== calendarBooking.eventId ||
    !customerEmail
  ) {
    return null
  }

  return {
    cancellationPolicy: cancellationPolicyFromMetadata(metadata),
    ...pricing,
    bookingReference,
    customerEmail: maskEmail(customerEmail),
    requestTitle: metadata.booking_title ?? "",
    slotEnd: calendarBooking.slotEnd,
    slotStart: calendarBooking.slotStart,
    transportBufferMinutes: bookingTransportBufferMinutes(),
  }
}
