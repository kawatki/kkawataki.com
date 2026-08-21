import "server-only"

import type {
  BookingRequest,
  BookingSlot,
  MessagingPlatform,
} from "@/lib/booking"
import {
  bookingTransportBufferMinutes,
  BOOKING_TIME_ZONE,
} from "@/lib/booking"
import { requiredEnv } from "@/lib/server-config"

type GoogleEvent = {
  attendees?: Array<{ email?: string }>
  description?: string
  end?: { date?: string; dateTime?: string }
  etag?: string
  extendedProperties?: {
    private?: Record<string, string>
  }
  id?: string
  start?: { date?: string; dateTime?: string }
  status?: string
  summary?: string
}

type GoogleEventList = {
  items?: GoogleEvent[]
  nextPageToken?: string
}

type TokenCache = {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | undefined

export class SlotUnavailableError extends Error {
  constructor() {
    super("That time has just become unavailable. Please choose another slot.")
    this.name = "SlotUnavailableError"
  }
}

class GoogleCalendarError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "GoogleCalendarError"
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

async function importGooglePrivateKey() {
  const pem = requiredEnv("GOOGLE_PRIVATE_KEY").replaceAll("\\n", "\n")
  const encoded = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/gu, "")
  const binary = atob(encoded)
  const keyBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  return crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["sign"]
  )
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1_000)
  if (tokenCache && tokenCache.expiresAt > now + 60) {
    return tokenCache.accessToken
  }

  const header = textToBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = textToBase64Url(
    JSON.stringify({
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3_600,
      iat: now,
      iss: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      scope: "https://www.googleapis.com/auth/calendar.events",
    })
  )
  const unsignedToken = `${header}.${claims}`
  const key = await importGooglePrivateKey()
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  )
  const assertion = `${unsignedToken}.${bytesToBase64Url(new Uint8Array(signature))}`

  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  })

  if (!response.ok) {
    throw new GoogleCalendarError("Google authentication failed.", response.status)
  }

  const result = (await response.json()) as {
    access_token: string
    expires_in?: number
  }
  tokenCache = {
    accessToken: result.access_token,
    expiresAt: now + (result.expires_in ?? 3_600),
  }
  return result.access_token
}

function calendarUrl(path = "", parameters?: Record<string, string>) {
  const calendarId = encodeURIComponent(requiredEnv("GOOGLE_CALENDAR_ID"))
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${path}`
  )
  for (const [key, value] of Object.entries(parameters ?? {})) {
    url.searchParams.set(key, value)
  }
  return url
}

async function googleRequest<T>(
  url: URL,
  init: RequestInit = {},
  acceptedStatuses: number[] = []
): Promise<T | null> {
  const accessToken = await getGoogleAccessToken()
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
  })

  if (acceptedStatuses.includes(response.status)) {
    return null
  }

  if (!response.ok) {
    const detail = await response.text()
    console.error("Google Calendar request failed", response.status, detail.slice(0, 500))
    throw new GoogleCalendarError("Google Calendar request failed.", response.status)
  }

  if (response.status === 204) {
    return null
  }
  return (await response.json()) as T
}

function bookingProperties(event: GoogleEvent) {
  return event.extendedProperties?.private ?? {}
}

function eventTime(value?: { date?: string; dateTime?: string }) {
  if (value?.dateTime) {
    return new Date(value.dateTime).getTime()
  }
  if (value?.date) {
    return new Date(`${value.date}T00:00:00+09:00`).getTime()
  }
  return Number.NaN
}

function shiftIsoTime(value: string, minutes: number) {
  return new Date(
    new Date(value).getTime() + minutes * 60 * 1_000
  ).toISOString()
}

function shiftIsoFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1_000).toISOString()
}

function holdBody(
  slot: BookingSlot,
  request: BookingRequest,
  expiresAt: number,
  holdToken: string,
  cancelToken: string,
  bookingReference: string,
  stripeSessionId = ""
) {
  return {
    description: [
      `Booking reference: ${bookingReference}`,
      "",
      "This time is temporarily held while the customer completes payment.",
    ].join("\n"),
    end: { dateTime: slot.end, timeZone: BOOKING_TIME_ZONE },
    location: request.location,
    extendedProperties: {
      private: {
        bookingReference,
        bookingState: "hold",
        cancelToken,
        customerEmail: request.email,
        customerName: request.name,
        holdExpiresAt: String(expiresAt),
        holdToken,
        location: request.location,
        requestNotes: request.notes,
        requestTitle: request.title,
        alternateContact: request.alternateContact,
        socialHandle: request.socialHandle,
        socialPlatform: request.socialPlatform,
        stripeSessionId,
      },
    },
    id: slot.id,
    start: { dateTime: slot.start, timeZone: BOOKING_TIME_ZONE },
    status: "confirmed",
    summary: "Payment pending — Rental Japanese Guy",
    transparency: "opaque",
    visibility: "private",
  }
}

export async function listAvailableSlots(candidates: BookingSlot[]) {
  if (!candidates.length) {
    return []
  }

  const first = candidates[0]
  const last = candidates.at(-1) ?? first
  const bufferMinutes = bookingTransportBufferMinutes()
  const events: GoogleEvent[] = []
  let pageToken: string | undefined

  do {
    const result = await googleRequest<GoogleEventList>(
      calendarUrl("", {
        maxResults: "2500",
        orderBy: "startTime",
        pageToken: pageToken ?? "",
        showDeleted: "false",
        singleEvents: "true",
        timeMax: shiftIsoTime(last.end, bufferMinutes),
        timeMin: shiftIsoTime(first.start, -bufferMinutes),
        timeZone: BOOKING_TIME_ZONE,
      })
    )
    events.push(...(result?.items ?? []))
    pageToken = result?.nextPageToken
  } while (pageToken)

  const now = Date.now()
  const busy = events.flatMap((event) => {
    const properties = bookingProperties(event)
    const isExpiredHold =
      properties.bookingState === "hold" &&
      Number(properties.holdExpiresAt || 0) <= Math.floor(now / 1_000)

    if (
      event.status === "cancelled" ||
      isExpiredHold ||
      properties.bookingState === "expired"
    ) {
      return []
    }

    const start = eventTime(event.start)
    const end = eventTime(event.end)
    return Number.isFinite(start) && Number.isFinite(end) ? [{ start, end }] : []
  })

  return candidates.filter((slot) => {
    const start = new Date(slot.start).getTime()
    const end = new Date(slot.end).getTime()
    const bufferMilliseconds = bufferMinutes * 60 * 1_000
    return !busy.some(
      (event) =>
        start < event.end + bufferMilliseconds &&
        end + bufferMilliseconds > event.start
    )
  })
}

async function getEvent(eventId: string) {
  return googleRequest<GoogleEvent>(calendarUrl(`/${encodeURIComponent(eventId)}`), {}, [
    404,
    410,
  ])
}

export async function findConfirmedBookingByReference(
  bookingReference: string
) {
  const result = await googleRequest<GoogleEventList>(
    calendarUrl("", {
      maxResults: "10",
      privateExtendedProperty: `bookingReference=${bookingReference}`,
      showDeleted: "false",
      singleEvents: "true",
    })
  )

  const event = (result?.items ?? []).find((candidate) => {
    const properties = bookingProperties(candidate)
    return (
      candidate.status !== "cancelled" &&
      properties.bookingReference === bookingReference &&
      properties.bookingState === "confirmed"
    )
  })
  const properties = event ? bookingProperties(event) : {}
  const slotStart = event?.start?.dateTime
  const slotEnd = event?.end?.dateTime

  if (
    !event?.id ||
    !slotStart ||
    !slotEnd ||
    !properties.stripeSessionId
  ) {
    return null
  }

  return {
    eventId: event.id,
    slotEnd,
    slotStart,
    stripeSessionId: properties.stripeSessionId,
  }
}

export async function acquireSlot(
  slot: BookingSlot,
  request: BookingRequest,
  expiresAt: number,
  holdToken: string,
  cancelToken: string,
  bookingReference: string
) {
  const [available] = await listAvailableSlots([slot])
  if (!available) {
    throw new SlotUnavailableError()
  }

  const existing = await getEvent(slot.id)
  const body = holdBody(
    slot,
    request,
    expiresAt,
    holdToken,
    cancelToken,
    bookingReference
  )

  if (!existing) {
    try {
      await googleRequest<GoogleEvent>(calendarUrl(), {
        body: JSON.stringify(body),
        method: "POST",
      })
      return
    } catch (error) {
      if (error instanceof GoogleCalendarError && error.status === 409) {
        throw new SlotUnavailableError()
      }
      throw error
    }
  }

  const properties = bookingProperties(existing)
  const expired =
    properties.bookingState === "expired" ||
    (properties.bookingState === "hold" &&
      Number(properties.holdExpiresAt || 0) <= Math.floor(Date.now() / 1_000))

  if (!expired || !existing.etag) {
    throw new SlotUnavailableError()
  }

  try {
    await googleRequest<GoogleEvent>(calendarUrl(`/${encodeURIComponent(slot.id)}`), {
      body: JSON.stringify(body),
      headers: { "if-match": existing.etag },
      method: "PUT",
    })
  } catch (error) {
    if (
      error instanceof GoogleCalendarError &&
      [409, 412].includes(error.status)
    ) {
      throw new SlotUnavailableError()
    }
    throw error
  }
}

async function patchPrivateProperties(
  eventId: string,
  updates: Record<string, string>,
  expected?: Record<string, string>
) {
  const event = await getEvent(eventId)
  if (!event?.etag) {
    return false
  }

  const properties = bookingProperties(event)
  if (
    expected &&
    Object.entries(expected).some(([key, value]) => properties[key] !== value)
  ) {
    return false
  }

  await googleRequest<GoogleEvent>(calendarUrl(`/${encodeURIComponent(eventId)}`), {
    body: JSON.stringify({
      extendedProperties: {
        private: { ...properties, ...updates },
      },
    }),
    headers: { "if-match": event.etag },
    method: "PATCH",
  })
  return true
}

export async function attachCheckoutSession(
  eventId: string,
  stripeSessionId: string,
  expiresAt: number,
  holdToken: string
) {
  const updated = await patchPrivateProperties(
    eventId,
    {
      holdExpiresAt: String(expiresAt),
      stripeSessionId,
    },
    { holdToken }
  )
  if (!updated) {
    throw new SlotUnavailableError()
  }
}

export async function expireHold(eventId: string, holdToken: string) {
  await patchPrivateProperties(
    eventId,
    {
      holdExpiresAt: String(Math.floor(Date.now() / 1_000) - 1),
    },
    { holdToken }
  )
}

async function deleteHold(
  eventId: string,
  expected: Record<string, string>
) {
  const event = await getEvent(eventId)
  if (!event?.etag) {
    return false
  }

  const properties = bookingProperties(event)
  if (
    properties.bookingState !== "hold" ||
    Object.entries(expected).some(([key, value]) => properties[key] !== value)
  ) {
    return false
  }

  await googleRequest<null>(
    calendarUrl(`/${encodeURIComponent(eventId)}`),
    {
      headers: { "if-match": event.etag },
      method: "DELETE",
    },
    [404, 410]
  )
  return true
}

export function deleteHoldByCancelToken(eventId: string, cancelToken: string) {
  return deleteHold(eventId, { cancelToken })
}

export function deleteHoldByStripeSession(
  eventId: string,
  stripeSessionId: string
) {
  return deleteHold(eventId, { stripeSessionId })
}

export async function deleteExpiredBookingHolds() {
  const now = Math.floor(Date.now() / 1_000)
  const events: GoogleEvent[] = []
  let pageToken: string | undefined

  do {
    const result = await googleRequest<GoogleEventList>(
      calendarUrl("", {
        maxResults: "2500",
        orderBy: "startTime",
        pageToken: pageToken ?? "",
        showDeleted: "false",
        singleEvents: "true",
        timeMax: shiftIsoFromNow(24 * 370),
        timeMin: shiftIsoFromNow(-24 * 30),
        timeZone: BOOKING_TIME_ZONE,
      })
    )
    events.push(...(result?.items ?? []))
    pageToken = result?.nextPageToken
  } while (pageToken)

  const holds = events.filter((event) => {
    const properties = bookingProperties(event)
    return event.id && properties.bookingState === "hold"
  })
  const realEvents = events.flatMap((event) => {
    const properties = bookingProperties(event)
    if (
      event.status === "cancelled" ||
      properties.bookingState === "hold" ||
      properties.bookingState === "expired"
    ) {
      return []
    }
    const start = eventTime(event.start)
    const end = eventTime(event.end)
    return Number.isFinite(start) && Number.isFinite(end)
      ? [{ end, id: event.id, start }]
      : []
  })

  const stale = holds.filter((hold) => {
    const properties = bookingProperties(hold)
    const holdStart = eventTime(hold.start)
    const holdEnd = eventTime(hold.end)
    const isExpired = Number(properties.holdExpiresAt || 0) <= now
    const overlapsRealEvent =
      Number.isFinite(holdStart) &&
      Number.isFinite(holdEnd) &&
      realEvents.some(
        (event) =>
          hold.id !== event.id && holdStart < event.end && holdEnd > event.start
      )

    return isExpired || overlapsRealEvent
  })

  await Promise.all(
    stale.map((event) =>
      googleRequest<null>(
        calendarUrl(`/${encodeURIComponent(event.id ?? "")}`),
        { method: "DELETE" },
        [404, 410]
      )
    )
  )

  return { deleted: stale.length }
}

export async function confirmPaidBooking(input: {
  alternateContact: string
  balanceDueJpy: number
  depositAmountJpy: number
  depositPercent: number
  durationHours: number
  email: string
  eventId: string
  location: string
  name: string
  notes: string
  paidAt: number
  rateJpyPer30Minutes: number
  sessionId: string
  serviceTotalJpy: number
  socialHandle: string
  socialPlatform: MessagingPlatform
  title: string
}) {
  const event = await getEvent(input.eventId)
  if (!event) {
    throw new Error("The calendar hold no longer exists.")
  }

  const properties = bookingProperties(event)
  if (properties.stripeSessionId !== input.sessionId) {
    return { conflict: true as const }
  }
  if (properties.bookingState === "confirmed") {
    return { confirmed: true as const }
  }
  const holdExpiresAt = Number(properties.holdExpiresAt || 0)
  if (!holdExpiresAt || input.paidAt > holdExpiresAt) {
    await patchPrivateProperties(
      input.eventId,
      { bookingState: "expired" },
      { stripeSessionId: input.sessionId }
    )
    return { conflict: true as const }
  }

  const eventStart = event.start?.dateTime
  const eventEnd = event.end?.dateTime
  if (!eventStart || !eventEnd) {
    throw new Error("The calendar hold has invalid times.")
  }

  const overlapping = await googleRequest<GoogleEventList>(
    calendarUrl("", {
      maxResults: "250",
      orderBy: "startTime",
      showDeleted: "false",
      singleEvents: "true",
      timeMax: shiftIsoTime(eventEnd, bookingTransportBufferMinutes()),
      timeMin: shiftIsoTime(eventStart, -bookingTransportBufferMinutes()),
      timeZone: BOOKING_TIME_ZONE,
    })
  )
  const hasConflict = (overlapping?.items ?? []).some((candidate) => {
    if (candidate.id === input.eventId || candidate.status === "cancelled") {
      return false
    }
    const candidateProperties = bookingProperties(candidate)
    return candidateProperties.bookingState !== "hold"
  })
  if (hasConflict) {
    await patchPrivateProperties(
      input.eventId,
      { bookingState: "conflict" },
      { stripeSessionId: input.sessionId }
    )
    return { conflict: true as const }
  }

  const markedPaid = await patchPrivateProperties(
    input.eventId,
    {
      bookingState: "paid",
      stripeSessionId: input.sessionId,
    },
    { stripeSessionId: input.sessionId }
  )
  if (!markedPaid) {
    return { conflict: true as const }
  }

  const inviteCustomer = process.env.GOOGLE_INVITE_CUSTOMERS === "true"
  const yen = (amount: number) => `¥${amount.toLocaleString("en-US")}`
  const halfHours = input.durationHours * 2
  const contactLabel: Record<Exclude<MessagingPlatform, "none">, string> = {
    discord: "Discord",
    instagram: "Instagram",
    line: "LINE",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    x: "X.com",
  }
  const contactLines =
    input.socialPlatform === "none"
      ? ["Messaging app: Email only"]
      : [`${contactLabel[input.socialPlatform]}: ${input.socialHandle}`]
  const description = [
    properties.bookingReference
      ? [`Booking reference: ${properties.bookingReference}`]
      : [],
    [
      `YOUR BOOKING · ${input.durationHours} HOURS`,
      `${yen(input.rateJpyPer30Minutes)} × ${halfHours} half-hours: ${yen(input.serviceTotalJpy)}`,
      `${input.depositPercent}% deposit paid: − ${yen(input.depositAmountJpy)}`,
      `Pay in person: ${yen(input.balanceDueJpy)}`,
    ],
    [`Customer: ${input.name}`, `Email: ${input.email}`, ...contactLines],
    [
      ...(input.location ? [`Location: ${input.location}`] : []),
      `Request: ${input.title}`,
      ...(input.notes ? [`Notes: ${input.notes}`] : []),
    ],
    [`Stripe Checkout: ${input.sessionId}`],
  ]
    .filter((section) => section.length > 0)
    .map((section) => section.join("\n"))
    .join("\n\n")

  await googleRequest<GoogleEvent>(
    calendarUrl(`/${encodeURIComponent(input.eventId)}`, {
      sendUpdates: inviteCustomer ? "all" : "none",
    }),
    {
      body: JSON.stringify({
        ...(inviteCustomer ? { attendees: [{ email: input.email }] } : {}),
        description,
        ...(input.location ? { location: input.location } : {}),
        extendedProperties: {
          private: {
            ...properties,
            bookingState: "confirmed",
            customerEmail: input.email,
            customerName: input.name,
            location: input.location,
            requestNotes: input.notes,
            requestTitle: input.title,
            alternateContact: input.alternateContact,
            socialHandle: input.socialHandle,
            socialPlatform: input.socialPlatform,
            stripeSessionId: input.sessionId,
          },
        },
        status: "confirmed",
        summary: `Rental Japanese Guy — ${input.title}`,
        transparency: "opaque",
        visibility: "private",
      }),
      method: "PATCH",
    }
  )

  return { confirmed: true as const }
}

export async function getBookingState(eventId: string, stripeSessionId: string) {
  const event = await getEvent(eventId)
  const properties = event ? bookingProperties(event) : {}
  if (properties.stripeSessionId !== stripeSessionId) {
    return "not_found"
  }
  return properties.bookingState ?? "hold"
}
