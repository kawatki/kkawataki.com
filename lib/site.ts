const configuredBookingUrl = process.env.NEXT_PUBLIC_GOOGLE_BOOKING_URL?.trim()

export const hasBookingUrl = Boolean(configuredBookingUrl)
export const bookingUrl = configuredBookingUrl ?? "https://calendar.google.com/"
