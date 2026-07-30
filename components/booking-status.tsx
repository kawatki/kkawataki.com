"use client"

import { useEffect, useState } from "react"
import {
  CalendarCheck,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
} from "lucide-react"

type BookingStatus =
  | "confirmed"
  | "delayed"
  | "error"
  | "invalid"
  | "pending"
  | "processing"

type BookingReceipt = {
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

function yen(amount: number) {
  return `¥${amount.toLocaleString("en-US")}`
}

function receiptDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value))
}

function receiptTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value))
}

export function BookingStatus({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<BookingStatus>("processing")
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null)

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
          receipt?: BookingReceipt
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
            result.status === "invalid"
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

        {receipt && (
          <section className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-ink/10 text-left">
            <div className="flex flex-col gap-3 bg-cream/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <p className="eyebrow">Booking receipt</p>
                <p className="mt-1 text-sm text-ink/55">
                  Keep this reference for questions about your booking.
                </p>
              </div>
              <code className="w-fit rounded-full border border-jade/20 bg-card px-4 py-2 font-mono text-sm font-semibold tracking-wide text-jade">
                {receipt.bookingReference}
              </code>
            </div>

            <div className="grid gap-6 px-5 py-6 sm:px-7">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink/45">Date</dt>
                  <dd className="mt-1 font-semibold">
                    {receiptDate(receipt.slotStart)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink/45">Time</dt>
                  <dd className="mt-1 font-semibold">
                    {receiptTime(receipt.slotStart)}–
                    {receiptTime(receipt.slotEnd)} JST
                  </dd>
                </div>
                <div>
                  <dt className="text-ink/45">Duration</dt>
                  <dd className="mt-1 font-semibold">
                    {receipt.durationHours} hours
                  </dd>
                </div>
                <div>
                  <dt className="text-ink/45">Email</dt>
                  <dd className="mt-1 break-all font-semibold">
                    {receipt.customerEmail}
                  </dd>
                </div>
                {receipt.requestTitle && (
                  <div className="sm:col-span-2">
                    <dt className="text-ink/45">Plan</dt>
                    <dd className="mt-1 font-semibold">
                      {receipt.requestTitle}
                    </dd>
                  </div>
                )}
              </dl>

              <dl className="grid gap-3 border-t border-ink/10 pt-5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink/55">
                    Service total · {yen(receipt.rateJpyPer30Minutes)} / 30 min
                  </dt>
                  <dd className="font-semibold">
                    {yen(receipt.serviceTotalJpy)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink/55">Deposit paid to Stripe</dt>
                  <dd className="font-semibold text-jade">
                    {yen(receipt.depositAmountJpy)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-ink/10 pt-3">
                  <dt className="font-semibold">Pay in person</dt>
                  <dd className="font-semibold text-vermilion">
                    {yen(receipt.balanceDueJpy)}
                  </dd>
                </div>
              </dl>

              <div className="rounded-xl bg-cream/70 px-4 py-4 text-sm leading-6 text-ink/60">
                <p>
                  The deposit is non-refundable if you cancel or do not attend.
                  If I cancel, it will be refunded.
                </p>
                <p className="mt-2">
                  You also cover transportation costs and any food or drinks
                  during our time together. A{" "}
                  {receipt.transportBufferMinutes / 60}-hour transportation
                  buffer is reserved after your booking.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  if (status === "invalid" || status === "error" || status === "delayed") {
    const copy =
      status === "invalid"
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
        {status !== "invalid" && (
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
