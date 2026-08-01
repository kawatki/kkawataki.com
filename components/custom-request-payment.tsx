"use client"

import { FormEvent, useCallback, useMemo, useState } from "react"
import { Checkbox } from "@base-ui/react/checkbox"
import {
  ArrowRight,
  Check,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
} from "lucide-react"

import {
  CUSTOM_REQUEST_MAX_AMOUNT_JPY,
  CUSTOM_REQUEST_MIN_AMOUNT_JPY,
} from "@/lib/custom-request"
import { TurnstileWidget } from "@/components/turnstile-widget"

const TURNSTILE_TOKEN_REFRESH_AFTER_MS = 4 * 60 * 1_000

function yen(amount: number) {
  return `¥${amount.toLocaleString("en-US")}`
}

function amountFromForm(formData: FormData) {
  const value = String(formData.get("amountJpy") ?? "").replaceAll(",", "")
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.floor(amount) : 0
}

export function CustomRequestPayment({
  paymentCancelled,
  turnstileSiteKey,
}: {
  paymentCancelled: boolean
  turnstileSiteKey: string
}) {
  const [amountJpy, setAmountJpy] = useState(0)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [turnstileAttempt, setTurnstileAttempt] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileTokenCreatedAt, setTurnstileTokenCreatedAt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(
    paymentCancelled ? "Payment was cancelled. Your card was not charged." : ""
  )

  const validAmount =
    Number.isInteger(amountJpy) &&
    amountJpy >= CUSTOM_REQUEST_MIN_AMOUNT_JPY &&
    amountJpy <= CUSTOM_REQUEST_MAX_AMOUNT_JPY

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
    if (!amountJpy) {
      return "Enter the yen amount we agreed on."
    }
    if (!validAmount) {
      return `${yen(CUSTOM_REQUEST_MIN_AMOUNT_JPY)}–${yen(
        CUSTOM_REQUEST_MAX_AMOUNT_JPY
      )} accepted.`
    }
    return `Stripe will charge ${yen(amountJpy)}.`
  }, [amountJpy, validAmount])

  async function requestCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

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
      const response = await fetch("/api/request-payment", {
        body: JSON.stringify({
          amountJpy: amountFromForm(formData),
          email: String(formData.get("email") ?? ""),
          name: String(formData.get("name") ?? ""),
          notes: String(formData.get("notes") ?? ""),
          requestTitle: String(formData.get("requestTitle") ?? ""),
          termsAccepted,
          turnstileToken,
        }),
        cache: "no-store",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const result = (await response.json()) as {
        error?: string
        url?: string
      }

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Checkout could not be started.")
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
          : "Checkout could not be started. Your card was not charged."
      )
    }
  }

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
        does not create a public booking slot or calendar event by itself.
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
        <label className="grid gap-2 text-sm font-semibold">
          Custom payment amount
          <input
            name="amountJpy"
            required
            type="number"
            inputMode="numeric"
            min={CUSTOM_REQUEST_MIN_AMOUNT_JPY}
            max={CUSTOM_REQUEST_MAX_AMOUNT_JPY}
            step={1}
            onChange={(event) => setAmountJpy(Number(event.target.value))}
            className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
            placeholder="5000"
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
            placeholder="Anything useful for the request…"
          />
        </label>
      </div>

      <div className="mt-6 rounded-2xl border border-jade-light/20 bg-jade-light/10 p-5">
        <p className="text-sm font-semibold">Before you pay</p>
        <p className="mt-2 text-sm leading-6 text-paper/60">
          This is a custom payment arranged directly with me. Stripe will send
          the payment receipt to your email. If this payment is connected to a
          booking, we will handle the details in our messages.
        </p>
      </div>

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
          amount above.
        </span>
      </label>

      <button
        type="submit"
        disabled={!validAmount || !termsAccepted || !turnstileToken || submitting}
        className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-vermilion px-6 font-semibold text-white transition hover:bg-vermilion/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            Opening secure checkout…
          </>
        ) : (
          <>
            {validAmount ? `Pay ${yen(amountJpy)}` : "Enter custom amount"}
            <ArrowRight className="size-4" />
          </>
        )}
      </button>

      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-paper/45">
        <LockKeyhole className="size-3.5" />
        Card details are handled securely by Stripe
      </p>
    </form>
  )
}
