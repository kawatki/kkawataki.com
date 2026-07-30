"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react"

import type { BookingSlot } from "@/lib/booking"
import { cn } from "@/lib/utils"

type AvailabilityDay = {
  date: string
  slots: BookingSlot[]
}

type AvailabilityResponse = {
  days?: AvailabilityDay[]
  error?: string
}

function displayDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    ...options,
  }).format(new Date(`${date}T12:00:00+09:00`))
}

export function BookingFlow({
  paymentCancelled = false,
}: {
  paymentCancelled?: boolean
}) {
  const [days, setDays] = useState<AvailabilityDay[]>([])
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlot, setSelectedSlot] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function loadAvailability() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/availability/", { cache: "no-store" })
      const result = (await response.json()) as AvailabilityResponse
      if (!response.ok || !result.days) {
        throw new Error(result.error ?? "Available times could not be loaded.")
      }

      setDays(result.days)
      const firstAvailable = result.days.find((day) => day.slots.length)
      setSelectedDate((current) =>
        result.days?.some((day) => day.date === current && day.slots.length)
          ? current
          : (firstAvailable?.date ?? "")
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Available times could not be loaded."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadAvailability(), 0)
    return () => window.clearTimeout(timeout)
  }, [])

  const activeDay = useMemo(
    () => days.find((day) => day.date === selectedDate),
    [days, selectedDate]
  )

  async function startCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/checkout/", {
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name"),
          notes: form.get("notes"),
          slotId: selectedSlot,
          title: form.get("title"),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const result = (await response.json()) as { error?: string; url?: string }
      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Checkout could not be started.")
      }
      window.location.assign(result.url)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout could not be started."
      )
      setSubmitting(false)
      await loadAvailability()
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
      <section className="rounded-3xl border border-ink/10 bg-white p-5 shadow-xl shadow-ink/5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">1 · Pick a date</p>
            <h2 className="mt-2 font-display text-3xl">Available in Tokyo</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadAvailability()}
            disabled={loading}
            className="flex size-10 items-center justify-center rounded-full border border-ink/15 text-ink/60 transition hover:bg-cream disabled:opacity-50"
            aria-label="Refresh available times"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>

        {paymentCancelled && (
          <p className="mt-5 rounded-xl bg-cream px-4 py-3 text-sm text-ink/70">
            Payment was cancelled. Your card was not charged; you can choose a
            time again whenever you are ready.
          </p>
        )}

        {loading ? (
          <div className="flex min-h-72 items-center justify-center text-ink/50">
            <LoaderCircle className="mr-2 size-5 animate-spin" />
            Loading live availability…
          </div>
        ) : days.length ? (
          <>
            <div className="mt-7 grid grid-cols-7 gap-2 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-ink/40">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {days.map((day) => {
                const available = day.slots.length
                const selected = selectedDate === day.date
                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={!available}
                    onClick={() => {
                      setSelectedDate(day.date)
                      setSelectedSlot("")
                    }}
                    title={`${displayDate(day.date, {
                      dateStyle: "long",
                    })}: ${available ? `${available} available` : "full"}`}
                    className={cn(
                      "aspect-square rounded-lg border text-sm font-semibold transition",
                      available === 0 &&
                        "cursor-not-allowed border-ink/5 bg-ink/[0.035] text-ink/25",
                      available === 1 &&
                        "border-jade/20 bg-jade/15 text-jade hover:bg-jade/25",
                      available === 2 &&
                        "border-jade/25 bg-jade/30 text-jade hover:bg-jade/40",
                      available >= 3 &&
                        "border-jade bg-jade text-white hover:bg-jade/90",
                      selected && "ring-2 ring-vermilion ring-offset-2"
                    )}
                  >
                    {Number(day.date.slice(-2))}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink/45">
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm bg-jade" /> Available
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-3 rounded-sm bg-ink/5" /> Full
              </span>
              <span>Times shown in Japan Standard Time</span>
            </div>

            {activeDay && (
              <div className="mt-8 border-t border-ink/10 pt-6">
                <p className="eyebrow">2 · Choose a four-hour time</p>
                <h3 className="mt-2 font-display text-2xl">
                  {displayDate(activeDay.date, {
                    day: "numeric",
                    month: "long",
                    weekday: "long",
                  })}
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {activeDay.slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedSlot(slot.id)}
                      className={cn(
                        "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition",
                        selectedSlot === slot.id
                          ? "border-vermilion bg-vermilion text-white"
                          : "border-ink/15 bg-paper hover:border-jade hover:bg-jade/5"
                      )}
                    >
                      {selectedSlot === slot.id ? (
                        <Check className="size-4" />
                      ) : (
                        <Clock3 className="size-4" />
                      )}
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <CalendarDays className="size-8 text-ink/30" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-ink/55">
              {error || "No online times are available right now."}
            </p>
          </div>
        )}
      </section>

      <form
        onSubmit={startCheckout}
        className="rounded-3xl bg-ink p-6 text-paper shadow-2xl shadow-ink/15 sm:p-8"
      >
        <p className="eyebrow text-paper/50">3 · Tell me your plan</p>
        <h2 className="mt-3 font-display text-4xl">Secure your time.</h2>
        <p className="mt-3 text-sm leading-6 text-paper/60">
          Your slot is confirmed only after Stripe accepts the ¥2,000 deposit.
          The deposit is deducted from the amount paid in person.
        </p>

        <div className="mt-7 grid gap-5">
          <label className="grid gap-2 text-sm font-semibold">
            Your name
            <input
              name="name"
              required
              maxLength={80}
              autoComplete="name"
              className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
              placeholder="Keisuke Kawataki"
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
            What would you like to do?
            <input
              name="title"
              required
              minLength={3}
              maxLength={100}
              className="h-12 rounded-xl border border-paper/15 bg-paper/10 px-4 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
              placeholder="Explore record shops in Shimokitazawa"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Anything else? <span className="font-normal text-paper/40">Optional</span>
            <textarea
              name="notes"
              maxLength={450}
              rows={4}
              className="resize-y rounded-xl border border-paper/15 bg-paper/10 px-4 py-3 font-normal text-paper outline-none placeholder:text-paper/30 focus:border-jade-light"
              placeholder="Interests, accessibility needs, where you are staying…"
            />
          </label>
        </div>

        {error && days.length > 0 && (
          <p role="alert" className="mt-5 rounded-xl bg-vermilion/20 px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!selectedSlot || submitting || loading}
          className="mt-7 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-vermilion px-6 font-semibold text-white transition hover:bg-vermilion/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Opening secure checkout…
            </>
          ) : (
            <>
              Pay ¥2,000 deposit
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-paper/45">
          <LockKeyhole className="size-3.5" />
          Card details are handled securely by Stripe
        </p>
      </form>
    </div>
  )
}
