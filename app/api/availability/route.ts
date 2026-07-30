import { generateCandidateSlots, getBookingPricing } from "@/lib/booking"
import { listAvailableSlots } from "@/lib/google-calendar"
import {
  bookingConfigurationReady,
  ConfigurationError,
} from "@/lib/server-config"

export async function GET() {
  if (!bookingConfigurationReady()) {
    return Response.json(
      { error: "Online booking is being configured. Please check back soon." },
      { status: 503 }
    )
  }

  try {
    const candidates = generateCandidateSlots()
    const slots = await listAvailableSlots(candidates)
    const availableIds = new Set(slots.map((slot) => slot.id))
    const days = Array.from(new Set(candidates.map((slot) => slot.date))).map(
      (date) => {
        const daySlots = candidates.filter((slot) => slot.date === date)
        return {
          date,
          slots: daySlots.filter((slot) => availableIds.has(slot.id)),
          totalSlots: daySlots.length,
        }
      }
    )
    return Response.json(
      { days, pricing: getBookingPricing() },
      { headers: { "cache-control": "no-store, max-age=0" } }
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
