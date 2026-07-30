export const BOOKING_TIME_ZONE = "Asia/Tokyo"
export const BOOKING_DURATION_HOURS = 4
export const DEPOSIT_AMOUNT_JPY = 2_000
export const DEPOSIT_TERMS_VERSION = "2026-07-30"
export const CHECKOUT_HOLD_MINUTES = 30
export const BOOKING_WINDOW_DAYS = 56
export const MINIMUM_NOTICE_HOURS = 24

const DEFAULT_SLOT_STARTS = ["09:00", "14:00", "19:00"]
const DEFAULT_RATE_JPY_PER_30_MINUTES = 1_000

export type BookingSlot = {
  date: string
  end: string
  id: string
  label: string
  start: string
}

export type BookingRequest = {
  depositTermsAccepted: boolean
  email: string
  name: string
  notes: string
  slotId: string
  title: string
}

export type BookingPricing = {
  balanceDueJpy: number
  depositAmountJpy: number
  durationHours: number
  rateJpyPer30Minutes: number
  serviceTotalJpy: number
}

export function getBookingPricing(): BookingPricing {
  const configuredRate = Number(process.env.BOOKING_RATE_JPY_PER_30_MINUTES)
  const rateJpyPer30Minutes =
    Number.isInteger(configuredRate) && configuredRate > 0
      ? configuredRate
      : DEFAULT_RATE_JPY_PER_30_MINUTES
  const serviceTotalJpy = rateJpyPer30Minutes * BOOKING_DURATION_HOURS * 2

  return {
    balanceDueJpy: Math.max(serviceTotalJpy - DEPOSIT_AMOUNT_JPY, 0),
    depositAmountJpy: DEPOSIT_AMOUNT_JPY,
    durationHours: BOOKING_DURATION_HOURS,
    rateJpyPer30Minutes,
    serviceTotalJpy,
  }
}

function datePartsInTokyo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BOOKING_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date)

  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<
    string,
    string
  >
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

function startTimes() {
  const configured = process.env.BOOKING_SLOT_STARTS?.split(",")
    .map((time) => time.trim())
    .filter((time) => /^\d{2}:\d{2}$/.test(time))

  return configured?.length ? configured : DEFAULT_SLOT_STARTS
}

export function slotEventId(start: string) {
  return `rjg${Math.floor(new Date(start).getTime() / 1_000).toString(16)}`
}

export function makeSlot(date: string, startTime: string): BookingSlot {
  const start = `${date}T${startTime}:00+09:00`
  const endDate = new Date(
    new Date(start).getTime() + BOOKING_DURATION_HOURS * 60 * 60 * 1_000
  )
  const end = endDate.toISOString()
  const startHour = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BOOKING_TIME_ZONE,
  }).format(new Date(start))
  const endHour = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BOOKING_TIME_ZONE,
  }).format(endDate)

  return {
    date,
    end,
    id: slotEventId(start),
    label: `${startHour}–${endHour}`,
    start,
  }
}

export function generateCandidateSlots(now = new Date()) {
  const parts = datePartsInTokyo(now)
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const earliest = now.getTime() + MINIMUM_NOTICE_HOURS * 60 * 60 * 1_000
  const slots: BookingSlot[] = []

  for (let day = 0; day < BOOKING_WINDOW_DAYS; day += 1) {
    const date = addDays(today, day)
    for (const time of startTimes()) {
      const slot = makeSlot(date, time)
      if (new Date(slot.start).getTime() >= earliest) {
        slots.push(slot)
      }
    }
  }

  return slots
}

export function findCandidateSlot(slotId: string, now = new Date()) {
  return generateCandidateSlots(now).find((slot) => slot.id === slotId)
}

export function parseBookingRequest(value: unknown): BookingRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Please complete the booking form.")
  }

  const input = value as Record<string, unknown>
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  const title = typeof input.title === "string" ? input.title.trim() : ""
  const notes = typeof input.notes === "string" ? input.notes.trim() : ""
  const slotId = typeof input.slotId === "string" ? input.slotId.trim() : ""
  const depositTermsAccepted = input.depositTermsAccepted === true

  if (name.length < 2 || name.length > 80) {
    throw new Error("Enter your name.")
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.")
  }
  if (title.length < 3 || title.length > 100) {
    throw new Error("Briefly describe what you would like to do.")
  }
  if (notes.length > 450) {
    throw new Error("Please keep your note under 450 characters.")
  }
  if (!slotId) {
    throw new Error("Choose an available time.")
  }
  if (!depositTermsAccepted) {
    throw new Error("Please agree to the non-refundable deposit policy.")
  }

  return { depositTermsAccepted, email, name, notes, slotId, title }
}
