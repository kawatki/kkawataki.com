export const CUSTOM_REQUEST_TERMS_VERSION = "2026-07-31-v1"
export const CUSTOM_REQUEST_MIN_AMOUNT_JPY = 100
export const CUSTOM_REQUEST_MAX_AMOUNT_JPY = 300_000

export type CustomRequestPayment = {
  amountJpy: number
  email: string
  name: string
  notes: string
  requestTitle: string
  termsAccepted: boolean
}

export function createCustomRequestReference() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
  const random = crypto.getRandomValues(new Uint8Array(8))
  const characters = Array.from(
    random,
    (value) => alphabet[value % alphabet.length]
  )
  return `RJG-REQ-${characters.slice(0, 4).join("")}-${characters
    .slice(4)
    .join("")}`
}

export function parseCustomRequestPayment(value: unknown): CustomRequestPayment {
  if (!value || typeof value !== "object") {
    throw new Error("Please complete the custom request form.")
  }

  const input = value as Record<string, unknown>
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : ""
  const requestTitle =
    typeof input.requestTitle === "string" ? input.requestTitle.trim() : ""
  const notes = typeof input.notes === "string" ? input.notes.trim() : ""
  const amountJpy =
    typeof input.amountJpy === "number"
      ? input.amountJpy
      : typeof input.amountJpy === "string"
        ? Number(input.amountJpy.replaceAll(",", ""))
        : Number.NaN
  const termsAccepted = input.termsAccepted === true

  if (name.length < 2 || name.length > 80) {
    throw new Error("Enter your name.")
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.")
  }
  if (requestTitle.length < 3 || requestTitle.length > 100) {
    throw new Error("Briefly describe the custom request.")
  }
  if (notes.length > 450) {
    throw new Error("Please keep your note under 450 characters.")
  }
  if (
    !Number.isInteger(amountJpy) ||
    amountJpy < CUSTOM_REQUEST_MIN_AMOUNT_JPY ||
    amountJpy > CUSTOM_REQUEST_MAX_AMOUNT_JPY
  ) {
    throw new Error(
      `Enter an amount between ¥${CUSTOM_REQUEST_MIN_AMOUNT_JPY.toLocaleString(
        "en-US"
      )} and ¥${CUSTOM_REQUEST_MAX_AMOUNT_JPY.toLocaleString("en-US")}.`
    )
  }
  if (!termsAccepted) {
    throw new Error("Please confirm this custom payment was arranged with me.")
  }

  return {
    amountJpy,
    email,
    name,
    notes,
    requestTitle,
    termsAccepted,
  }
}
