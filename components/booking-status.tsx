"use client"

import { useEffect, useState } from "react"
import { CalendarCheck, LoaderCircle } from "lucide-react"

type BookingStatus = "confirmed" | "invalid" | "pending" | "processing"

export function BookingStatus({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<BookingStatus>("processing")

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
        const result = (await response.json()) as { status?: BookingStatus }
        if (!stopped && result.status) {
          setStatus(result.status)
          if (result.status === "confirmed" || attempts >= 8) {
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
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-jade text-white">
          <CalendarCheck className="size-8" />
        </span>
        <p className="eyebrow mt-7">Payment received</p>
        <h1 className="mt-4 font-display text-5xl sm:text-7xl">You’re booked.</h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/65">
          Your appointment is now in the calendar. Stripe will send the payment
          receipt to the email address you provided.
        </p>
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
