import { DEPOSIT_PERCENT } from "@/lib/booking-policy"

export const BOOKING_TIME_ZONE = "Asia/Tokyo"
export const BOOKING_INCREMENT_MINUTES = 30
export const PREFERRED_BOOKING_MINUTES = 4 * 60
export const MINIMUM_BOOKING_MINUTES = 60
export const FALLBACK_BOOKING_MINUTES = [
  PREFERRED_BOOKING_MINUTES,
  3 * 60,
  2 * 60,
  MINIMUM_BOOKING_MINUTES,
] as const
export { DEPOSIT_PERCENT } from "@/lib/booking-policy"
export const DEPOSIT_TERMS_VERSION = "2026-09-24-v3"
export const CHECKOUT_HOLD_MINUTES = 10
export const STRIPE_CHECKOUT_EXPIRY_MINUTES = 30

const DEFAULT_DAY_START = "09:00"
const DEFAULT_DAY_END = "23:00"
const DEFAULT_TRANSPORT_BUFFER_MINUTES = 60
const DEFAULT_RATE_JPY_PER_30_MINUTES = 1_000
const DEFAULT_BOOKING_MONTHS_AHEAD = 6
const DEFAULT_MINIMUM_NOTICE_HOURS = 6

export type BookingSlot = {
  date: string
  durationMinutes: number
  end: string
  id: string
  label: string
  start: string
}

export type MessagingPlatform =
  | "discord"
  | "instagram"
  | "line"
  | "none"
  | "telegram"
  | "whatsapp"
  | "x"

export type BookingRequest = {
  alternateContact: string
  date: string
  depositTermsAccepted: boolean
  email: string
  endTime: string
  location: string
  name: string
  notes: string
  socialHandle: string
  socialPlatform: MessagingPlatform
  startTime: string
  title: string
}

export type BookingPricing = {
  balanceDueJpy: number
  bookingIncrementMinutes: number
  depositAmountJpy: number
  depositPercent: number
  durationHours: number
  minimumDurationOptions: number[]
  minimumDurationMinutes: number
  preferredDurationMinutes: number
  rateJpyPer30Minutes: number
  serviceTotalJpy: number
}

export type BookingReceipt = {
  cancellationPolicy: import("@/lib/booking-policy").CancellationPolicy
  balanceDueJpy: number
  bookingReference: string
  customerEmail: string
  depositAmountJpy: number
  durationHours: number
  rateJpyPer30Minutes: number
  requestTitle: string
  serviceTotalJpy: number
  slotEnd: string
  slotStart: string
  transportBufferMinutes: number
}

export function createBookingReference() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
  const random = crypto.getRandomValues(new Uint8Array(8))
  const characters = Array.from(
    random,
    (value) => alphabet[value % alphabet.length]
  )
  return `RJG-${characters.slice(0, 4).join("")}-${characters
    .slice(4)
    .join("")}`
}

export function getBookingPricing(
  durationMinutes = PREFERRED_BOOKING_MINUTES
): BookingPricing {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < MINIMUM_BOOKING_MINUTES ||
    durationMinutes % BOOKING_INCREMENT_MINUTES !== 0
  ) {
    throw new Error("Choose a booking of at least one hour.")
  }

  const configuredRate = Number(process.env.BOOKING_RATE_JPY_PER_30_MINUTES)
  const rateJpyPer30Minutes =
    Number.isInteger(configuredRate) && configuredRate > 0
      ? configuredRate
      : DEFAULT_RATE_JPY_PER_30_MINUTES
  const serviceTotalJpy =
    rateJpyPer30Minutes * (durationMinutes / BOOKING_INCREMENT_MINUTES)
  const depositAmountJpy = Math.ceil(
    (serviceTotalJpy * DEPOSIT_PERCENT) / 100
  )

  return {
    balanceDueJpy: serviceTotalJpy - depositAmountJpy,
    bookingIncrementMinutes: BOOKING_INCREMENT_MINUTES,
    depositAmountJpy,
    depositPercent: DEPOSIT_PERCENT,
    durationHours: durationMinutes / 60,
    minimumDurationOptions: [...FALLBACK_BOOKING_MINUTES],
    minimumDurationMinutes: PREFERRED_BOOKING_MINUTES,
    preferredDurationMinutes: PREFERRED_BOOKING_MINUTES,
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

function bookingWindowEnd(today: string) {
  const configuredMonths = Number(process.env.BOOKING_MONTHS_AHEAD)
  const monthsAhead =
    Number.isInteger(configuredMonths) &&
    configuredMonths >= 1 &&
    configuredMonths <= 12
      ? configuredMonths
      : DEFAULT_BOOKING_MONTHS_AHEAD
  const [year, month] = today.split("-").map(Number)

  return new Date(Date.UTC(year, month + monthsAhead, 0))
    .toISOString()
    .slice(0, 10)
}

export function timeToMinutes(time: string) {
  if (!/^(?:[01]\d|2[0-3]):(?:00|30)$/u.test(time)) {
    return Number.NaN
  }
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function configuredTime(key: "BOOKING_DAY_END" | "BOOKING_DAY_START", fallback: string) {
  const value = process.env[key]?.trim()
  return value && Number.isFinite(timeToMinutes(value)) ? value : fallback
}

export function bookingDayHours() {
  const start = configuredTime("BOOKING_DAY_START", DEFAULT_DAY_START)
  const end = configuredTime("BOOKING_DAY_END", DEFAULT_DAY_END)
  return timeToMinutes(end) > timeToMinutes(start)
    ? { end, start }
    : { end: DEFAULT_DAY_END, start: DEFAULT_DAY_START }
}

export function bookingTransportBufferMinutes() {
  const configuredBuffer = Number(
    process.env.BOOKING_TRANSPORT_BUFFER_MINUTES
  )
  return Number.isInteger(configuredBuffer) &&
    configuredBuffer >= 0 &&
    configuredBuffer <= 4 * 60
    ? configuredBuffer
    : DEFAULT_TRANSPORT_BUFFER_MINUTES
}

export function bookingMinimumNoticeHours() {
  const configuredNotice = Number(process.env.BOOKING_MINIMUM_NOTICE_HOURS)
  return Number.isInteger(configuredNotice) &&
    configuredNotice >= 0 &&
    configuredNotice <= 72
    ? configuredNotice
    : DEFAULT_MINIMUM_NOTICE_HOURS
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`
}

function displayTime(value: Date) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BOOKING_TIME_ZONE,
  }).format(value)
}

export function slotEventId(start: string, durationMinutes: number) {
  const startPart = Math.floor(new Date(start).getTime() / 1_000).toString(16)
  const durationPart = (durationMinutes / BOOKING_INCREMENT_MINUTES).toString(16)
  return `rjg${startPart}d${durationPart}`
}

function createSlot(
  date: string,
  startTime: string,
  endTime: string,
  durationMinutes: number
) {
  const start = `${date}T${startTime}:00+09:00`
  const end = `${date}T${endTime}:00+09:00`
  const parsedStart = new Date(start)
  const parsedEnd = new Date(end)
  if (
    Number.isNaN(parsedStart.getTime()) ||
    Number.isNaN(parsedEnd.getTime()) ||
    parsedEnd.getTime() <= parsedStart.getTime()
  ) {
    throw new Error("Choose a valid time range.")
  }

  return {
    date,
    durationMinutes,
    end: parsedEnd.toISOString(),
    id: slotEventId(start, durationMinutes),
    label: `${displayTime(parsedStart)}–${displayTime(parsedEnd)}`,
    start,
  }
}

export function makeSlot(
  date: string,
  startTime: string,
  endTime: string
): BookingSlot {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  const { end: dayEnd, start: dayStart } = bookingDayHours()
  const durationMinutes = endMinutes - startMinutes

  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(endMinutes) ||
    startMinutes < timeToMinutes(dayStart) ||
    endMinutes > timeToMinutes(dayEnd) ||
    durationMinutes < MINIMUM_BOOKING_MINUTES ||
    durationMinutes % BOOKING_INCREMENT_MINUTES !== 0
  ) {
    throw new Error("Choose a valid time range of at least one hour.")
  }

  return createSlot(date, startTime, endTime, durationMinutes)
}

export function validateRequestedSlot(
  date: string,
  startTime: string,
  endTime: string,
  now = new Date()
) {
  const slot = makeSlot(date, startTime, endTime)
  const parts = datePartsInTokyo(now)
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const earliest =
    now.getTime() + bookingMinimumNoticeHours() * 60 * 60 * 1_000

  if (
    date < today ||
    date > bookingWindowEnd(today) ||
    new Date(slot.start).getTime() < earliest
  ) {
    throw new Error("That time is outside the booking window.")
  }
  return slot
}

export function generateCandidateSlots(now = new Date()) {
  const parts = datePartsInTokyo(now)
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const lastDate = bookingWindowEnd(today)
  const earliest =
    now.getTime() + bookingMinimumNoticeHours() * 60 * 60 * 1_000
  const { end, start } = bookingDayHours()
  const endMinutes = timeToMinutes(end)
  const slots: BookingSlot[] = []

  for (let day = 0; ; day += 1) {
    const date = addDays(today, day)
    if (date > lastDate) break

    for (
      let minute = timeToMinutes(start);
      minute + BOOKING_INCREMENT_MINUTES <= endMinutes;
      minute += BOOKING_INCREMENT_MINUTES
    ) {
      const slot = createSlot(
        date,
        minutesToTime(minute),
        minutesToTime(minute + BOOKING_INCREMENT_MINUTES),
        BOOKING_INCREMENT_MINUTES
      )
      if (new Date(slot.start).getTime() >= earliest) {
        slots.push(slot)
      }
    }
  }

  return slots
}

export function minimumDurationForAvailableTimes(
  availableTimes: string[],
  durationOptions = FALLBACK_BOOKING_MINUTES
) {
  const available = new Set(availableTimes)

  return (
    durationOptions.find((durationMinutes) =>
      availableTimes.some((startTime) => {
        const start = timeToMinutes(startTime)
        if (!Number.isFinite(start)) return false

        for (
          let minute = start;
          minute < start + durationMinutes;
          minute += BOOKING_INCREMENT_MINUTES
        ) {
          if (!available.has(minutesToTime(minute))) {
            return false
          }
        }
        return true
      })
    ) ?? null
  )
}

export function parseBookingRequest(value: unknown): BookingRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Please complete the booking form.")
  }

  const input = value as Record<string, unknown>
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  const title = typeof input.title === "string" ? input.title.trim() : ""
  const location =
    typeof input.location === "string" ? input.location.trim() : ""
  const notes = typeof input.notes === "string" ? input.notes.trim() : ""
  let socialPlatform: Exclude<BookingRequest["socialPlatform"], "none">
  if (
    input.socialPlatform === "discord" ||
    input.socialPlatform === "instagram" ||
    input.socialPlatform === "line" ||
    input.socialPlatform === "telegram" ||
    input.socialPlatform === "whatsapp" ||
    input.socialPlatform === "x"
  ) {
    socialPlatform = input.socialPlatform
  } else {
    throw new Error("Choose a messaging app.")
  }
  const rawSocialHandle =
    typeof input.socialHandle === "string" ? input.socialHandle.trim() : ""
  const usesAtPrefix =
    socialPlatform === "discord" ||
    socialPlatform === "instagram" ||
    socialPlatform === "telegram" ||
    socialPlatform === "x"
  const contactValue = usesAtPrefix
    ? rawSocialHandle.replace(/^@+/u, "")
    : rawSocialHandle
  const socialHandle = !contactValue
    ? ""
    : usesAtPrefix
      ? `@${contactValue}`
      : contactValue
  const alternateContact = ""
  const date = typeof input.date === "string" ? input.date.trim() : ""
  const startTime =
    typeof input.startTime === "string" ? input.startTime.trim() : ""
  const endTime = typeof input.endTime === "string" ? input.endTime.trim() : ""
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
  if (location.length < 2 || location.length > 120) {
    throw new Error("Enter the meeting location.")
  }
  if (notes.length > 450) {
    throw new Error("Please keep your note under 450 characters.")
  }
  if (
    socialPlatform === "instagram" &&
    !/^@[A-Za-z0-9._]{1,30}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid Instagram username.")
  }
  if (
    socialPlatform === "x" &&
    !/^@[A-Za-z0-9_]{1,15}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid X username.")
  }
  if (
    socialPlatform === "discord" &&
    !/^@[A-Za-z0-9._]{2,32}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid Discord username.")
  }
  if (
    socialPlatform === "telegram" &&
    !/^@[A-Za-z0-9_]{5,32}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid Telegram username.")
  }
  if (
    socialPlatform === "line" &&
    !/^[A-Za-z0-9._-]{1,80}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid LINE ID.")
  }
  if (
    socialPlatform === "whatsapp" &&
    !/^\+[1-9]\d{7,14}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid WhatsApp phone number.")
  }
  if (!date || !startTime || !endTime) {
    throw new Error("Choose an available start and end time.")
  }
  if (!depositTermsAccepted) {
    throw new Error("Please agree to the deposit and cancellation policy.")
  }

  return {
    alternateContact,
    date,
    depositTermsAccepted,
    email,
    endTime,
    location,
    name,
    notes,
    socialHandle,
    socialPlatform,
    startTime,
    title,
  }
}
