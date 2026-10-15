import { pricePackages } from "@/lib/experience-packages"
import { bookingPriceMultiplier, type BookingOptions } from "@/lib/booking-options"
import { DEPOSIT_PERCENT } from "@/lib/booking-policy"

export const PRICING_VERSION = "private-experiences-v5"
export const TAX_RATE = 0.1
export const TRANSPORT_FEE_JPY = 4_000
export const EXPERIENCE_PLANS = [
  { hours: 4, durationLabel: "4 hours", priceJpy: 16_000, name: "Short Experience", description: "Food, conversation, and neighborhood discoveries at your own pace." },
  { hours: 8, durationLabel: "8 hours", priceJpy: 28_000, name: "Half Day", description: "Time to explore your interests, stop for a meal, and enjoy the city." },
  { hours: 14, durationLabel: "14 hours", priceJpy: 42_000, name: "Full Day", description: "An unhurried day together, from morning into the evening." },
] as const

export function planForDuration(durationMinutes: number) {
  return EXPERIENCE_PLANS.find((plan) => plan.hours * 60 === durationMinutes)
}

export function experiencePrice(durationMinutes: number, options?: BookingOptions) {
  const plan = planForDuration(durationMinutes)
  if (!plan) throw new Error("Choose a Short Experience (4h), Half Day (8h), or Full Day (14h).")
  const multiplier = options ? bookingPriceMultiplier(options.peopleCount, options.faceRecordingConsent) : bookingPriceMultiplier(1, false)
  const planAmountJpy = Math.round(plan.priceJpy * multiplier)
  const packageIds = options?.packageIds ?? []
  const packagesTotalJpy = pricePackages(packageIds, durationMinutes / 60)
  const subtotalJpy = planAmountJpy + packagesTotalJpy + TRANSPORT_FEE_JPY
  const taxAmountJpy = Math.round(subtotalJpy * TAX_RATE)
  const serviceTotalJpy = subtotalJpy + taxAmountJpy
  const depositAmountJpy = Math.ceil(serviceTotalJpy * DEPOSIT_PERCENT / 100)
  return {
    pricingVersion: PRICING_VERSION,
    subtotalJpy,
    taxRate: TAX_RATE,
    taxAmountJpy,
    planAmountJpy,
    packageIds,
    packagesTotalJpy,
    transportFeeJpy: TRANSPORT_FEE_JPY,
    serviceTotalJpy,
    depositAmountJpy,
    depositPercent: DEPOSIT_PERCENT,
    balanceDueJpy: serviceTotalJpy - depositAmountJpy,
    durationHours: durationMinutes / 60,
  }
}

// Availability remains a grid of start times; customers buy complete experiences.
export function experienceStartTimes(availableTimes: string[], durationMinutes: number, increment = 30) {
  if (!planForDuration(durationMinutes)) return []
  const available = new Set(availableTimes)
  return availableTimes.filter((time) => {
    const [hours, minutes] = time.split(":").map(Number)
    const start = hours * 60 + minutes
    for (let offset = 0; offset < durationMinutes; offset += increment) {
      const minute = start + offset
      const segment = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
      if (!available.has(segment)) return false
    }
    return true
  })
}
