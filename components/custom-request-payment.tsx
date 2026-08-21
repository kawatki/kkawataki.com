"use client"

import { FormEvent, useCallback, useMemo, useState } from "react"
import { Checkbox } from "@base-ui/react/checkbox"
import {
  ArrowRight,
  BadgeCheck,
  Bitcoin,
  Check,
  Copy,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  SearchCheck,
  Sparkles,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import {
  CUSTOM_REQUEST_MIN_AMOUNT_BTC,
  CUSTOM_REQUEST_MAX_AMOUNT_JPY,
  CUSTOM_REQUEST_MIN_AMOUNT_JPY,
} from "@/lib/custom-request"
import type { CustomRequestMessagingPlatform } from "@/lib/custom-request"
import { TurnstileWidget } from "@/components/turnstile-widget"
import { WHATSAPP_COUNTRY_CODES } from "@/lib/whatsapp-country-codes"

const TURNSTILE_TOKEN_REFRESH_AFTER_MS = 4 * 60 * 1_000

type PaymentMethod = "card" | "btc"

type MessagingField = {
  inputMode?: "tel" | "text"
  label: string
  maxLength: number
  pattern: string
  placeholder: string
  prefix?: string
}

const MESSAGING_FIELDS: Record<CustomRequestMessagingPlatform, MessagingField> = {
  discord: {
    label: "Discord username",
    maxLength: 33,
    pattern: "@?[A-Za-z0-9._]{2,32}",
    placeholder: "username",
    prefix: "@",
  },
  instagram: {
    label: "Instagram username",
    maxLength: 31,
    pattern: "@?[A-Za-z0-9._]{1,30}",
    placeholder: "username",
    prefix: "@",
  },
  line: {
    label: "LINE ID",
    maxLength: 80,
    pattern: "[A-Za-z0-9._-]{1,80}",
    placeholder: "your-line-id",
  },
  none: {
    label: "Email only",
    maxLength: 0,
    pattern: "",
    placeholder: "",
  },
  telegram: {
    label: "Telegram username",
    maxLength: 33,
    pattern: "@?[A-Za-z0-9_]{5,32}",
    placeholder: "username",
    prefix: "@",
  },
  whatsapp: {
    inputMode: "tel",
    label: "WhatsApp phone number",
    maxLength: 30,
    pattern: "\\+?[0-9 ()-]{7,30}",
    placeholder: "Phone",
  },
  x: {
    label: "X username",
    maxLength: 16,
    pattern: "@?[A-Za-z0-9_]{1,15}",
    placeholder: "username",
    prefix: "@",
  },
}

const MESSAGING_OPTIONS: Array<{
  label: string
  value: CustomRequestMessagingPlatform
}> = [
  { label: "Email only", value: "none" },
  { label: "Instagram", value: "instagram" },
  { label: "Telegram", value: "telegram" },
  { label: "X", value: "x" },
  { label: "LINE", value: "line" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Discord", value: "discord" },
]

type BtcInstructions = {
  address: string
  amountBtc: number
  confirmationsRequired: string
  network: string
  reference: string
  refundPolicy: string
}

type BtcVerification = {
  confirmations: number
  confirmationsRequired: number
  status: "paid_unconfirmed" | "success"
  txid: string
}

function yen(amount: number) {
  return `¥${amount.toLocaleString("en-US")}`
}

function amountFromForm(formData: FormData) {
  const value = String(formData.get("amountJpy") ?? "").replaceAll(",", "")
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.floor(amount) : 0
}

function btcAmountFromForm(formData: FormData) {
  const amount = Number(String(formData.get("amountBtc") ?? "").trim())
  return Number.isFinite(amount) ? amount : 0
}

function btc(amount: number) {
  return `${amount.toLocaleString("en-US", {
    maximumFractionDigits: 8,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  })} BTC`
}

function btcPaymentUri(instructions: BtcInstructions) {
  const parameters = new URLSearchParams({
    amount: String(instructions.amountBtc),
    message: instructions.reference,
  })
  return `bitcoin:${instructions.address}?${parameters.toString()}`
}

export function CustomRequestPayment({
  paymentCancelled,
  turnstileSiteKey,
}: {
  paymentCancelled: boolean
  turnstileSiteKey: string
}) {
  const [amountJpy, setAmountJpy] = useState(0)
  const [amountBtc, setAmountBtc] = useState(CUSTOM_REQUEST_MIN_AMOUNT_BTC)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card")
  const [socialPlatform, setSocialPlatform] =
    useState<CustomRequestMessagingPlatform>("none")
  const [whatsAppCountryCode, setWhatsAppCountryCode] = useState("+81")
  const [whatsAppLocalNumber, setWhatsAppLocalNumber] = useState("")
  const [btcInstructions, setBtcInstructions] =
    useState<BtcInstructions | null>(null)
  const [btcTxid, setBtcTxid] = useState("")
  const [btcVerification, setBtcVerification] =
    useState<BtcVerification | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileTokenCreatedAt, setTurnstileTokenCreatedAt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [verifyingBtc, setVerifyingBtc] = useState(false)
  const [error, setError] = useState(
    paymentCancelled ? "Payment was cancelled. Your card was not charged." : ""
  )

  const validCardAmount =
    Number.isInteger(amountJpy) &&
    amountJpy >= CUSTOM_REQUEST_MIN_AMOUNT_JPY &&
    amountJpy <= CUSTOM_REQUEST_MAX_AMOUNT_JPY
  const validBtcAmount =
    Number.isFinite(amountBtc) && amountBtc >= CUSTOM_REQUEST_MIN_AMOUNT_BTC
  const validAmount =
    paymentMethod === "btc" ? validBtcAmount : validCardAmount
  const messagingField = MESSAGING_FIELDS[socialPlatform]
  const whatsAppDigits = whatsAppLocalNumber.replace(/\D/gu, "")
  const normalizedWhatsAppNumber =
    socialPlatform === "whatsapp" && whatsAppDigits
      ? `${whatsAppCountryCode}${whatsAppDigits.replace(/^0+/u, "")}`
      : ""

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token)
    setTurnstileTokenCreatedAt(token ? Date.now() : 0)
    if (token) {
      setError((current) =>
        current.toLowerCase().includes("security check") ? "" : current
      )
    }
  }, [])

  const amountHelp = useMemo(() => {
    if (paymentMethod === "btc") {
      if (!amountBtc) {
        return "Enter the BTC amount we agreed on."
      }
      if (!validBtcAmount) {
        return `Minimum BTC payment is ${btc(CUSTOM_REQUEST_MIN_AMOUNT_BTC)}.`
      }
      return `BlueWallet will open with ${btc(amountBtc)}.`
    }
    if (!amountJpy) {
      return "Enter the yen amount we agreed on."
    }
    if (!validCardAmount) {
      return `${yen(CUSTOM_REQUEST_MIN_AMOUNT_JPY)}-${yen(
        CUSTOM_REQUEST_MAX_AMOUNT_JPY
      )} accepted.`
    }
    return `Stripe will charge ${yen(amountJpy)}.`
  }, [amountBtc, amountJpy, paymentMethod, validBtcAmount, validCardAmount])

  const copyPaymentDetail = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      setError("Copy failed. Please select and copy the text manually.")
    }
  }, [])

  const cancelBtcInstructions = useCallback(() => {
    setBtcInstructions(null)
    setBtcTxid("")
    setBtcVerification(null)
    setTurnstileToken("")
    setTurnstileTokenCreatedAt(0)
    setTurnstileAttempt((value) => value + 1)
    setError("")
  }, [])

  async function verifyBtcTransaction() {
    setError("")
    setBtcVerification(null)

    if (!btcInstructions) {
      setError("Create BTC payment instructions first.")
      return
    }
    if (!turnstileToken) {
      setError("Complete the security check before verifying the transaction.")
      return
    }
    if (!btcTxid.trim()) {
      setError("Paste the Bitcoin transaction ID after you pay.")
      return
    }

    setVerifyingBtc(true)
    try {
      const response = await fetch("/api/request-payment/btc/verify", {
        body: JSON.stringify({
          reference: btcInstructions.reference,
          turnstileToken,
          txid: btcTxid,
        }),
        cache: "no-store",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const result = (await response.json()) as {
        confirmations?: number
        confirmationsRequired?: number
        error?: string
        status?: "paid_unconfirmed" | "success"
        txid?: string
      }

      if (
        !response.ok ||
        typeof result.confirmations !== "number" ||
        typeof result.confirmationsRequired !== "number" ||
        !result.status ||
        !result.txid
      ) {
        throw new Error(result.error || "BTC transaction could not be verified.")
      }

      setBtcVerification({
        confirmations: result.confirmations,
        confirmationsRequired: result.confirmationsRequired,
        status: result.status,
        txid: result.txid,
      })
      setTurnstileToken("")
      setTurnstileTokenCreatedAt(0)
      setTurnstileAttempt((value) => value + 1)
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "BTC transaction could not be verified."
      )
    } finally {
      setVerifyingBtc(false)
    }
  }

  async function requestCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setBtcInstructions(null)

    if (!turnstileSiteKey) {
      setError("Secure checkout is temporarily unavailable.")
      return
    }
    if (!validAmount) {
      setError("Enter the custom payment amount we agreed on.")
      return
    }
    if (!termsAccepted) {
      setError("Please confirm this custom payment was arranged with me.")
      return
    }
    if (
      !turnstileToken ||
      Date.now() - turnstileTokenCreatedAt > TURNSTILE_TOKEN_REFRESH_AFTER_MS
    ) {
      setError("The security check expired. Please try again.")
      setTurnstileToken("")
      setTurnstileTokenCreatedAt(0)
      setTurnstileAttempt((value) => value + 1)
      return
    }

    const formData = new FormData(event.currentTarget)
    setSubmitting(true)

    try {
      const paymentPayload =
        paymentMethod === "btc"
          ? { amountBtc: btcAmountFromForm(formData) }
          : { amountJpy: amountFromForm(formData) }
      const response = await fetch(
        paymentMethod === "btc"
          ? "/api/request-payment/btc"
          : "/api/request-payment",
        {
          body: JSON.stringify({
            ...paymentPayload,
            email: String(formData.get("email") ?? ""),
            name: String(formData.get("name") ?? ""),
            notes: String(formData.get("notes") ?? ""),
            requestTitle: String(formData.get("requestTitle") ?? ""),
              socialHandle:
              socialPlatform === "none"
                ? ""
                : socialPlatform === "whatsapp"
                ? normalizedWhatsAppNumber
                : String(formData.get("socialHandle") ?? ""),
            socialPlatform,
            termsAccepted,
            turnstileToken,
          }),
          cache: "no-store",
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
      const result = (await response.json()) as {
        address?: string
        amountBtc?: number
        confirmationsRequired?: string
        error?: string
        network?: string
        reference?: string
        refundPolicy?: string
        url?: string
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            (paymentMethod === "btc"
              ? "BTC payment instructions could not be created."
              : "Checkout could not be started.")
        )
      }

      if (paymentMethod === "btc") {
        if (
          !result.address ||
          !result.amountBtc ||
          !result.confirmationsRequired ||
          !result.network ||
          !result.reference ||
          !result.refundPolicy
        ) {
          throw new Error("BTC payment instructions could not be created.")
        }
        setBtcInstructions({
          address: result.address,
          amountBtc: result.amountBtc,
          confirmationsRequired: result.confirmationsRequired,
          network: result.network,
          reference: result.reference,
          refundPolicy: result.refundPolicy,
        })
        setBtcTxid("")
        setBtcVerification(null)
        setSubmitting(false)
        setTurnstileToken("")
        setTurnstileTokenCreatedAt(0)
        setTurnstileAttempt((value) => value + 1)
        return
      }

      if (!result.url) {
        throw new Error("Checkout could not be started.")
      }
      window.location.assign(result.url)
    } catch (checkoutError) {
      setSubmitting(false)
      setTurnstileToken("")
      setTurnstileTokenCreatedAt(0)
      setTurnstileAttempt((value) => value + 1)
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : paymentMethod === "btc"
            ? "BTC payment instructions could not be created."
            : "Checkout could not be started. Your card was not charged."
      )
    }
  }

  const submitLabel =
    paymentMethod === "btc"
      ? validAmount
        ? `Create BTC instructions for ${btc(amountBtc)}`
        : "Enter custom amount"
      : validAmount
        ? `Pay ${yen(amountJpy)}`
        : "Enter custom amount"

  return (
    <form
      onSubmit={requestCheckout}
      className="mx-auto max-w-2xl rounded-3xl bg-ink p-6 text-paper shadow-2xl shadow-ink/15 sm:p-8"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-jade-light text-ink">
        <Sparkles className="size-6" />
      </span>
      <p className="eyebrow mt-7 text-paper/50">Private request payment</p>
      <h1 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
        Custom payment.
      </h1>
      <p className="mt-4 text-sm leading-6 text-paper/60">
        Use this page only if we already agreed on a custom amount. This payment
        does not create a public booking slot or calendar event by itself. Card
        is for normal pricing; BTC is for people who want to use Bitcoin as
        real-world peer-to-peer money.
      </p>

      <div className="mt-8 grid gap-5">
        <label className="grid gap-2 text-sm font-semibold">
          Name (Nickname)
          <input
            name="name"
            required
            maxLength={80}
            autoComplete="name"
            className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
            placeholder="Your nickname, e.g. Taki"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Email
          <input
            name="email"
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
            placeholder="you@example.com"
          />
        </label>
        <section className="grid gap-4 rounded-2xl border border-paper/15 bg-paper/5 p-4">
          <div>
            <h2 className="text-sm font-semibold">Where else should I message you?</h2>
            <p className="mt-1 text-xs leading-5 text-paper/45">
              Optional. Add this when the request needs quick back-and-forth.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            Messaging app
            <select
              name="socialPlatform"
              value={socialPlatform}
              onChange={(event) => {
                setSocialPlatform(
                  event.target.value as CustomRequestMessagingPlatform
                )
                setBtcInstructions(null)
              }}
              className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none focus:border-jade-light"
            >
              {MESSAGING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {socialPlatform === "none" ? (
            <p className="rounded-xl border border-paper/15 bg-paper/5 px-4 py-3 text-sm leading-6 text-paper/55">
              I’ll use your email receipt and any existing conversation for this
              payment.
            </p>
          ) : socialPlatform === "whatsapp" ? (
            <div className="grid gap-3 sm:grid-cols-[13rem_1fr]">
              <label className="grid gap-2 text-sm font-semibold">
                Country
                <select
                  value={whatsAppCountryCode}
                  onChange={(event) => {
                    setWhatsAppCountryCode(event.target.value)
                    setBtcInstructions(null)
                  }}
                  className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none focus:border-jade-light"
                  aria-label="WhatsApp country code"
                >
                  {WHATSAPP_COUNTRY_CODES.map((country) => (
                    <option key={`${country.iso2}-${country.code}`} value={country.code}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Phone
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  value={whatsAppLocalNumber}
                  onChange={(event) => {
                    setWhatsAppLocalNumber(event.target.value)
                    setBtcInstructions(null)
                  }}
                  maxLength={30}
                  className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
                  placeholder="Phone"
                />
              </label>
              <input
                readOnly
                type="hidden"
                name="socialHandle"
                value={normalizedWhatsAppNumber}
              />
            </div>
          ) : (
            <label className="grid gap-2 text-sm font-semibold">
              {messagingField.label}
              <div className="flex h-12 overflow-hidden rounded-xl border border-paper/15 bg-paper/10 focus-within:border-jade-light">
                {messagingField.prefix ? (
                  <span className="flex items-center border-r border-paper/15 px-4 font-normal text-paper/45">
                    {messagingField.prefix}
                  </span>
                ) : null}
                <input
                  name="socialHandle"
                  required
                  inputMode={messagingField.inputMode}
                  maxLength={messagingField.maxLength}
                  pattern={messagingField.pattern}
                  className="min-w-0 flex-1 bg-transparent px-4 font-normal text-paper outline-none placeholder:text-paper/30"
                  placeholder={messagingField.placeholder}
                  onChange={() => setBtcInstructions(null)}
                />
              </div>
            </label>
          )}
        </section>
        <label className="grid gap-2 text-sm font-semibold">
          {paymentMethod === "btc" ? "BTC payment amount" : "Custom payment amount"}
          <input
            key={paymentMethod}
            name={paymentMethod === "btc" ? "amountBtc" : "amountJpy"}
            required
            type="number"
            inputMode="decimal"
            min={
              paymentMethod === "btc"
                ? CUSTOM_REQUEST_MIN_AMOUNT_BTC
                : CUSTOM_REQUEST_MIN_AMOUNT_JPY
            }
            max={
              paymentMethod === "btc"
                ? undefined
                : CUSTOM_REQUEST_MAX_AMOUNT_JPY
            }
            step={paymentMethod === "btc" ? 0.00000001 : 1}
            defaultValue={
              paymentMethod === "btc" ? CUSTOM_REQUEST_MIN_AMOUNT_BTC : ""
            }
            onChange={(event) => {
              if (paymentMethod === "btc") {
                setAmountBtc(Number(event.target.value))
              } else {
                setAmountJpy(Number(event.target.value))
              }
              setBtcInstructions(null)
            }}
            className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
            placeholder={paymentMethod === "btc" ? "0.01" : "5000"}
          />
          <span className="text-xs font-normal leading-5 text-paper/45">
            {amountHelp}
          </span>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          What is this payment for?
          <input
            name="requestTitle"
            required
            minLength={3}
            maxLength={100}
            className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
            placeholder="Custom Tokyo help arranged with Taki"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Notes <span className="font-normal text-paper/40">Optional</span>
          <textarea
            name="notes"
            maxLength={450}
            rows={4}
            className="resize-y rounded-xl border border-paper/15 bg-paper/10 px-4 py-3 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
            placeholder="Anything useful for the request..."
          />
        </label>
      </div>

      <div
        className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-paper/15 bg-paper/5 p-1"
        role="tablist"
        aria-label="Payment method"
      >
        <button
          type="button"
          role="tab"
          id="card-payment-tab"
          aria-controls="payment-method-details"
          aria-selected={paymentMethod === "card"}
          onClick={() => {
            setPaymentMethod("card")
            setBtcInstructions(null)
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-paper/55 transition hover:bg-paper/10 hover:text-paper aria-selected:bg-paper aria-selected:text-ink"
        >
          <CreditCard className="size-4" />
          Card
        </button>
        <button
          type="button"
          role="tab"
          id="btc-payment-tab"
          aria-controls="payment-method-details"
          aria-selected={paymentMethod === "btc"}
          onClick={() => {
            setPaymentMethod("btc")
            setBtcInstructions(null)
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-paper/55 transition hover:bg-paper/10 hover:text-paper aria-selected:bg-paper aria-selected:text-ink"
        >
          <Bitcoin className="size-4" />
          BTC
        </button>
      </div>

      <div
        id="payment-method-details"
        role="tabpanel"
        aria-labelledby={
          paymentMethod === "btc" ? "btc-payment-tab" : "card-payment-tab"
        }
        className="mt-6 rounded-2xl border border-jade-light/20 bg-jade-light/10 p-5"
      >
        <p className="text-sm font-semibold">Before you pay</p>
        {paymentMethod === "btc" ? (
          <p className="mt-2 text-sm leading-6 text-paper/60">
            BTC is for someone who appreciates the peer-to-peer internet and
            wants to try Bitcoin as a real payment method connected to the real
            world. Because it is manual and harder to convert than card payment,
            BTC requests start at {btc(CUSTOM_REQUEST_MIN_AMOUNT_BTC)}. If the
            rental does not happen, I will refund the BTC received in full,
            excluding the Bitcoin network/remittance fee.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-paper/60">
            This is a custom payment arranged directly with me. Stripe will send
            the payment receipt to your email. If this payment is connected to a
            booking, we will handle the details in our messages.
          </p>
        )}
      </div>

      {btcInstructions && (
        <div className="mt-6 rounded-2xl border border-paper/15 bg-paper p-5 text-ink">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">BTC payment details</p>
              <p className="mt-1 text-xs text-ink/55">
                Saved as a pending payment task, not a confirmed booking.
              </p>
            </div>
            <span className="rounded-full bg-jade px-3 py-1 text-xs font-semibold text-white">
              {btcInstructions.network}
            </span>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[14rem_1fr]">
            <div>
              <div className="flex aspect-square items-center justify-center rounded-2xl border border-ink/10 bg-white p-6">
                <QRCodeSVG
                  value={btcPaymentUri(btcInstructions)}
                  size={192}
                  level="M"
                  marginSize={2}
                  className="h-auto w-full max-w-48"
                  title={`BTC payment QR for ${btcInstructions.reference}`}
                />
              </div>
              <p className="mt-3 text-center text-xs font-semibold text-ink/50">
                Scan with BlueWallet
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <span className="text-xs font-semibold uppercase text-ink/45">
                  Address
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-cream px-3 py-2">
                  <code className="min-w-0 flex-1 break-all text-sm">
                    {btcInstructions.address}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyPaymentDetail(btcInstructions.address)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink/60 transition hover:bg-ink/10 hover:text-ink"
                    aria-label="Copy BTC address"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <span className="text-xs font-semibold uppercase text-ink/45">
                  Reference
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-cream px-3 py-2">
                  <code className="min-w-0 flex-1 break-all text-sm">
                    {btcInstructions.reference}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyPaymentDetail(btcInstructions.reference)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink/60 transition hover:bg-ink/10 hover:text-ink"
                    aria-label="Copy payment reference"
                  >
                    <Copy className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-ink/45">
                Agreed amount
              </dt>
              <dd className="mt-1 font-semibold">
                {btc(btcInstructions.amountBtc)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-ink/45">
                Confirmation
              </dt>
              <dd className="mt-1 font-semibold">
                {btcInstructions.confirmationsRequired} confirmation
                {btcInstructions.confirmationsRequired === "1" ? "" : "s"}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-sm leading-6 text-ink/60">
            Send exactly {btc(btcInstructions.amountBtc)}, then message me this
            reference. This option is for people who genuinely want to use BTC
            in a real transaction. I will confirm the request only after BTC is
            received. {btcInstructions.refundPolicy}
          </p>

          <div className="mt-5 rounded-2xl border border-ink/10 bg-cream p-4">
            <label className="grid gap-2 text-sm font-semibold">
              Transaction ID
              <textarea
                value={btcTxid}
                onChange={(event) => {
                  setBtcTxid(event.target.value)
                  setBtcVerification(null)
                }}
                rows={2}
                className="resize-y rounded-xl border border-ink/10 bg-paper px-3 py-2 font-code text-sm font-normal text-ink outline-none placeholder:text-ink/35 focus:border-jade"
                placeholder="Paste the Bitcoin transaction ID after sending..."
              />
            </label>
            <button
              type="button"
              onClick={verifyBtcTransaction}
              disabled={verifyingBtc || !turnstileToken || !btcTxid.trim()}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-jade px-4 text-sm font-semibold text-white transition hover:bg-jade/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {verifyingBtc ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Checking Bitcoin ledger...
                </>
              ) : (
                <>
                  <SearchCheck className="size-4" />
                  Verify BTC transaction
                </>
              )}
            </button>
          </div>

          {btcVerification && (
            <div className="mt-4 rounded-2xl border border-jade/20 bg-jade/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-jade">
                <BadgeCheck className="size-4" />
                {btcVerification.status === "success"
                  ? "BTC payment confirmed"
                  : "BTC payment seen, waiting for confirmation"}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                {btcVerification.confirmations} of{" "}
                {btcVerification.confirmationsRequired} required confirmation
                {btcVerification.confirmationsRequired === 1 ? "" : "s"}.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={cancelBtcInstructions}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink/70 transition hover:bg-ink/5 hover:text-ink"
          >
            <RotateCcw className="size-4" />
            Cancel and edit request
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-vermilion/20 bg-vermilion/15 px-4 py-3 text-sm leading-6 text-vermilion"
        >
          {error}
        </p>
      )}

      {turnstileSiteKey ? (
        <div className="mt-6 text-ink">
          <TurnstileWidget
            key={turnstileAttempt}
            onTokenChange={handleTurnstileToken}
            siteKey={turnstileSiteKey}
          />
        </div>
      ) : (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-vermilion/20 bg-vermilion/15 px-4 py-3 text-sm leading-6 text-vermilion"
        >
          Secure checkout is temporarily unavailable.
        </p>
      )}

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-paper/15 p-4 text-sm leading-6 transition hover:bg-paper/5">
        <Checkbox.Root
          checked={termsAccepted}
          onCheckedChange={setTermsAccepted}
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-paper/30 bg-paper/10 text-white outline-none transition data-[checked]:border-vermilion data-[checked]:bg-vermilion focus-visible:ring-2 focus-visible:ring-vermilion/35"
        >
          <Checkbox.Indicator>
            <Check className="size-3.5" strokeWidth={3} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        <span>
          I confirm this custom payment was arranged with Taki and I checked the
          amount and payment method above.
        </span>
      </label>

      <button
        type="submit"
        disabled={
          !validAmount ||
          !termsAccepted ||
          !turnstileToken ||
          submitting ||
          Boolean(btcInstructions)
        }
        className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-vermilion px-6 font-semibold text-white transition hover:bg-vermilion/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            {paymentMethod === "btc"
              ? "Creating BTC instructions..."
              : "Opening secure checkout..."}
          </>
        ) : (
          <>
            {submitLabel}
            <ArrowRight className="size-4" />
          </>
        )}
      </button>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-paper/45">
        <LockKeyhole className="size-3.5" />
        {paymentMethod === "btc"
          ? "BTC details are shown only after the protected request is saved"
          : "Card details are handled securely by Stripe"}
      </p>
    </form>
  )
}
