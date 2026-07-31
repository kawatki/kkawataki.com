import {
  BOOKING_INCREMENT_MINUTES,
  bookingDayHours,
  bookingTransportBufferMinutes,
  generateCandidateSlots,
  getBookingPricing,
  timeToMinutes,
} from "@/lib/booking"
import { listAvailableSlots } from "@/lib/google-calendar"
import {
  bookingConfigurationReady,
  ConfigurationError,
} from "@/lib/server-config"
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit"

type AvailabilityPayload = {
  dayHours: ReturnType<typeof bookingDayHours>
  days: Array<{
    availableTimes: string[]
    date: string
    totalSegments: number
  }>
  pricing: ReturnType<typeof getBookingPricing>
  transportBufferMinutes: number
}

let availabilityCache:
  | { expiresAt: number; payload: AvailabilityPayload }
  | undefined

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit(request.headers, {
    bucket: "availability",
    limit: 20,
    windowSeconds: 5 * 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit)
  }

  if (!bookingConfigurationReady()) {
    return Response.json(
      { error: "Online booking is being configured. Please check back soon." },
      { status: 503 }
    )
  }

  try {
    if (availabilityCache && availabilityCache.expiresAt > Date.now()) {
      return Response.json(availabilityCache.payload, {
        headers: {
          "cache-control":
            "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
        },
      })
    }

    const dayHours = bookingDayHours()
    const fullDaySegments = Math.max(
      (timeToMinutes(dayHours.end) - timeToMinutes(dayHours.start)) /
        BOOKING_INCREMENT_MINUTES,
      0
    )
    const candidates = generateCandidateSlots()
    const slots = await listAvailableSlots(candidates)
    const availableIds = new Set(slots.map((slot) => slot.id))
    const days = Array.from(new Set(candidates.map((slot) => slot.date))).map(
      (date) => {
        const daySlots = candidates.filter((slot) => slot.date === date)
        return {
          availableTimes: daySlots
            .filter((slot) => availableIds.has(slot.id))
            .map((slot) => slot.start.slice(11, 16)),
          date,
          totalSegments: fullDaySegments,
        }
      }
    )
    const payload = {
      dayHours,
      days,
      pricing: getBookingPricing(),
      transportBufferMinutes: bookingTransportBufferMinutes(),
    }
    availabilityCache = {
      expiresAt: Date.now() + 30_000,
      payload,
    }
    return Response.json(
      payload,
      {
        headers: {
          "cache-control":
            "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
        },
      }
    )
  } catch (error) {
    console.error("Availability request failed", error)
    const message =
      error instanceof ConfigurationError
        ? "Online booking is being configured. Please check back soon."
        : "Available times could not be loaded. Please try again."
    return Response.json({ error: message }, { status: 503 })
  }
}
