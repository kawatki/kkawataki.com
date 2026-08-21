export const CUSTOM_REQUEST_TERMS_VERSION = "2026-07-31-v1"
export const CUSTOM_REQUEST_MIN_AMOUNT_JPY = 100
export const CUSTOM_REQUEST_MAX_AMOUNT_JPY = 300_000
export const CUSTOM_REQUEST_MIN_AMOUNT_BTC = 0.01
export const CUSTOM_REQUEST_MAX_AMOUNT_BTC = 100

export type CustomRequestMessagingPlatform =
  | "discord"
  | "instagram"
  | "line"
  | "none"
  | "telegram"
  | "whatsapp"
  | "x"

export type CustomRequestPayment = {
  amountJpy: number
  email: string
  name: string
  notes: string
  requestTitle: string
  socialHandle: string
  socialPlatform: CustomRequestMessagingPlatform
  termsAccepted: boolean
}

export type BtcCustomRequestPayment = Omit<CustomRequestPayment, "amountJpy"> & {
  amountBtc: number
}

export type BtcPaymentConfig = {
  address: string
  confirmationsRequired: string
  explorerApiUrl: string
  minAmountBtc: number
  network: string
  pendingRequestTtlHours: number
  refundPolicy: string
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
  let socialPlatform: CustomRequestMessagingPlatform = "none"
  if (
    input.socialPlatform === "discord" ||
    input.socialPlatform === "instagram" ||
    input.socialPlatform === "line" ||
    input.socialPlatform === "none" ||
    input.socialPlatform === "telegram" ||
    input.socialPlatform === "whatsapp" ||
    input.socialPlatform === "x"
  ) {
    socialPlatform = input.socialPlatform
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
  const socialHandle = socialPlatform === "none"
    ? ""
    : !contactValue
    ? ""
    : usesAtPrefix
      ? `@${contactValue}`
      : contactValue
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
    socialPlatform !== "none" &&
    socialPlatform === "instagram" &&
    !/^@[A-Za-z0-9._]{1,30}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid Instagram username.")
  }
  if (
    socialPlatform !== "none" &&
    socialPlatform === "telegram" &&
    !/^@[A-Za-z0-9_]{5,32}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid Telegram username.")
  }
  if (
    socialPlatform !== "none" &&
    socialPlatform === "x" &&
    !/^@[A-Za-z0-9_]{1,15}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid X username.")
  }
  if (
    socialPlatform !== "none" &&
    socialPlatform === "discord" &&
    !/^@[A-Za-z0-9._]{2,32}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid Discord username.")
  }
  if (
    socialPlatform !== "none" &&
    socialPlatform === "line" &&
    !/^[A-Za-z0-9._-]{1,80}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid LINE ID.")
  }
  if (
    socialPlatform !== "none" &&
    socialPlatform === "whatsapp" &&
    !/^\+[1-9]\d{7,14}$/u.test(socialHandle)
  ) {
    throw new Error("Enter a valid WhatsApp phone number.")
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
    socialHandle,
    socialPlatform,
    termsAccepted,
  }
}

export function parseBtcCustomRequestPayment(
  value: unknown,
  minAmountBtc = CUSTOM_REQUEST_MIN_AMOUNT_BTC
): BtcCustomRequestPayment {
  if (!value || typeof value !== "object") {
    throw new Error("Please complete the custom request form.")
  }

  const input = value as Record<string, unknown>
  const parsed = parseCustomRequestPayment({
    ...input,
    amountJpy: CUSTOM_REQUEST_MIN_AMOUNT_JPY,
  })
  const amountBtc =
    typeof input.amountBtc === "number"
      ? input.amountBtc
      : typeof input.amountBtc === "string"
        ? Number(input.amountBtc.trim())
        : Number.NaN

  if (
    !Number.isFinite(amountBtc) ||
    amountBtc < minAmountBtc ||
    amountBtc > CUSTOM_REQUEST_MAX_AMOUNT_BTC
  ) {
    throw new Error(
      `Enter a BTC amount between ${minAmountBtc} BTC and ${CUSTOM_REQUEST_MAX_AMOUNT_BTC} BTC.`
    )
  }

  return {
    amountBtc,
    email: parsed.email,
    name: parsed.name,
    notes: parsed.notes,
    requestTitle: parsed.requestTitle,
    socialHandle: parsed.socialHandle,
    socialPlatform: parsed.socialPlatform,
    termsAccepted: parsed.termsAccepted,
  }
}

export function getBtcPaymentConfig(): BtcPaymentConfig {
  const minAmountBtc = Number(process.env.BTC_MIN_AMOUNT_BTC?.trim())
  const pendingRequestTtlHours = Number(
    process.env.BTC_PENDING_REQUEST_TTL_HOURS?.trim()
  )
  return {
    address: process.env.BTC_RECEIVING_ADDRESS?.trim() ?? "",
    confirmationsRequired:
      process.env.BTC_CONFIRMATIONS_REQUIRED?.trim() || "1",
    explorerApiUrl:
      process.env.BTC_EXPLORER_API_URL?.trim() ||
      "https://blockstream.info/api",
    minAmountBtc: Number.isFinite(minAmountBtc)
      ? minAmountBtc
      : CUSTOM_REQUEST_MIN_AMOUNT_BTC,
    network: process.env.BTC_PAYMENT_NETWORK?.trim() || "Bitcoin mainnet",
    pendingRequestTtlHours:
      Number.isFinite(pendingRequestTtlHours) && pendingRequestTtlHours > 0
        ? pendingRequestTtlHours
        : 2,
    refundPolicy:
      process.env.BTC_REFUND_POLICY?.trim() ||
      "If the rental does not happen, I will refund the BTC received in full, excluding the Bitcoin network/remittance fee.",
  }
}
