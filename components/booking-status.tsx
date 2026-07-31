"use client"

import { useEffect, useState } from "react"
import {
  CalendarCheck,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
} from "lucide-react"

import { BookingReceipt } from "@/components/booking-receipt"
import type { BookingReceipt as BookingReceiptData } from "@/lib/booking"

type BookingStatus =
  | "confirmed"
  | "delayed"
  | "error"
  | "invalid"
  | "pending"
  | "processing"
  | "refunded"

export function BookingStatus({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<BookingStatus>("processing")
  const [receipt, setReceipt] = useState<BookingReceiptData | null>(null)

  useEffect(() => {
    let stopped = false
    let attempts = 0
    let timeout: ReturnType<typeof setTimeout> | undefined

    async function check() {
      attempts += 1
      try {
        const response = await fetch(
          `/api/booking-status/?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        )
        const result = (await response.json()) as {
          receipt?: BookingReceiptData
          status?: BookingStatus
        }
        if (!stopped && result.status) {
          setStatus(result.status)
          if (result.receipt) {
            setReceipt(result.receipt)
          }
          if (
            result.status === "confirmed" ||
            result.status === "error" ||
            result.status === "invalid" ||
            result.status === "refunded"
          ) {
            return
          }
          if (attempts >= 8) {
            setStatus("delayed")
            return
          }
        }
      } catch {
        // The webhook remains authoritative; keep the customer-facing page calm.
      }
      if (!stopped && attempts < 8) {
        timeout = setTimeout(check, 2_000)
      }
    }

    void check()
    return () => {
      stopped = true
      if (timeout) clearTimeout(timeout)
    }
  }, [sessionId])

  if (status === "confirmed") {
    return (
      <div>
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-jade text-white">
            <CalendarCheck className="size-8" />
          </span>
          <p className="eyebrow mt-7">Payment received</p>
          <h1 className="mt-4 font-display text-5xl sm:text-7xl">
            You’re booked.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/65">
            Your appointment is now in the calendar. Stripe will send the
            payment receipt to the email address you provided.
          </p>
        </div>

        {receipt && <BookingReceipt receipt={receipt} showPermanentLink />}
      </div>
    )
  }

  if (
    status === "invalid" ||
    status === "error" ||
    status === "delayed" ||
    status === "refunded"
  ) {
    const copy =
      status === "refunded"
        ? {
            description:
              "Payment finished after the 10-minute reservation expired, so the deposit is being returned automatically. Please choose an available time and try again.",
            eyebrow: "Reservation expired",
            title: "Your payment is being refunded.",
          }
        : status === "invalid"
        ? {
            description:
              "This Checkout Session is not recognized by the Stripe account connected to this site. Use the complete confirmation link from Stripe, or return to booking.",
            eyebrow: "Confirmation link not found",
            title: "We can’t verify this payment.",
          }
        : status === "error"
          ? {
              description:
                "The payment service could not be reached right now. Your payment has not been marked as confirmed here. Please try again in a moment.",
              eyebrow: "Temporary confirmation error",
              title: "We couldn’t check Stripe.",
            }
          : {
              description:
                "Stripe has the payment, but the calendar is taking longer than expected to confirm it. Keep your Stripe receipt and refresh this page shortly.",
              eyebrow: "Confirmation delayed",
              title: "This is taking longer.",
            }

    return (
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-vermilion/10 text-vermilion">
          <CircleAlert className="size-8" />
        </span>
        <p className="eyebrow mt-7">{copy.eyebrow}</p>
        <h1 className="mt-4 font-display text-5xl sm:text-6xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/65">
          {copy.description}
        </p>
        {status !== "invalid" && status !== "refunded" && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mx-auto mt-7 flex h-10 items-center justify-center gap-2 rounded-full border border-ink/15 px-5 text-sm font-semibold transition hover:bg-cream"
          >
            <RefreshCw className="size-4" />
            Check again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-cream text-vermilion">
        <LoaderCircle className="size-8 animate-spin" />
      </span>
      <p className="eyebrow mt-7">Payment received</p>
      <h1 className="mt-4 font-display text-5xl sm:text-7xl">
        Confirming your time…
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/65">
        Stripe is notifying the calendar now. You can safely close this page;
        your payment receipt will arrive by email.
      </p>
    </div>
  )
}
