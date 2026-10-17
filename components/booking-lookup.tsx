"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { TurnstileWidget } from "@/components/turnstile-widget"
import { BookingReceipt } from "@/components/booking-receipt"
import { Button } from "@/components/ui/button"
import type { LookupBooking } from "@/lib/booking-lookup"

const inputClass = "mt-2 w-full rounded-xl border border-ink/20 bg-paper px-4 py-3 text-base focus:outline-2 focus:outline-vermilion"
const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value))
const yen = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "JPY" }).format(value)

export function BookingLookup({ turnstileSiteKey, mapsKey }: { turnstileSiteKey: string; mapsKey: string }) {
  const [token, setToken] = useState("")
  const [attempt, setAttempt] = useState(0)
  const onTokenChange = useCallback((value: string) => setToken(value), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [bookings, setBookings] = useState<LookupBooking[] | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (busy) return
    const target = error ? errorRef.current : bookings !== null ? resultsRef.current : null
    if (!target) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    })
  }, [bookings, busy, error])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !token) return
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    setError("")
    setBookings(null)
    try {
      const response = await fetch("/api/lookup", {
        method: "POST", headers: { "content-type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ email: data.get("email"), last4: data.get("last4"), expiry: data.get("expiry"), turnstileToken: token }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to look up your booking.")
      setBookings(result.bookings)
      if (result.bookings.length) form.reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to connect. Please try again.")
    } finally {
      setBusy(false)
      setToken("")
      setAttempt(value => value + 1)
    }
  }

  return <>
    <form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl border border-ink/15 bg-card p-6 sm:p-8">
      <fieldset disabled={busy} className="space-y-5">
        <label className="block font-medium">Booking email
          <input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="your@email.com" className={inputClass} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block font-medium">Last 4 card digits
            <input name="last4" type="text" inputMode="numeric" autoComplete="off" required pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="1234" className={inputClass} />
          </label>
          <label className="block font-medium">Expiry date · MM/YY
            <input name="expiry" type="text" inputMode="text" autoComplete="off" required pattern="(0[1-9]|1[0-2])/[0-9]{2}" maxLength={5} placeholder="09/28" className={inputClass} />
          </label>
        </div>
      </fieldset>
      <p className="text-sm leading-6 text-ink/60">Use the card details from the time of payment, even if the card has since expired. Never enter your full card number or security code.</p>
      {turnstileSiteKey ? <TurnstileWidget key={attempt} siteKey={turnstileSiteKey} action="lookup" onTokenChange={onTokenChange} message="Verifying this request is being made by a person…" /> : <p role="alert" className="text-sm text-vermilion">The security check is unavailable. Please contact me for help with your booking.</p>}
      <Button type="submit" disabled={busy || !token} className="h-12 w-full rounded-full">{busy ? "Finding your bookings…" : "Find my bookings"}</Button>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="scroll-mt-28 text-sm text-vermilion">{error}</p>}
    </form>
    <div ref={resultsRef} tabIndex={-1} aria-label="Booking lookup results" aria-live="polite" aria-busy={busy} className="scroll-mt-28">
      {bookings?.length === 0 && <div className="mt-8 rounded-2xl bg-cream p-6"><h2 className="font-display text-2xl">No matching bookings found</h2><p className="mt-3 text-sm leading-6">Check all three details and try again. New payments can take a few minutes to appear. Apple Pay or Google Pay may use different card digits; check your wallet’s payment details.</p></div>}
      {!!bookings?.length && <div className="mt-8 flex items-center justify-between gap-4"><h2 className="font-display text-2xl">Your bookings ({bookings.length})</h2><button type="button" onClick={() => setBookings(null)} className="text-sm underline">Clear results</button></div>}
      {bookings?.map(booking => <article key={booking.reference} className="mt-6 rounded-3xl border border-ink/15 bg-card p-5 sm:p-7">
        <p className="eyebrow">{booking.status}</p>
        <h3 className="mt-3 font-display text-2xl">{booking.title || "Your experience"}</h3>
        <p className="mt-3 text-sm">{date(booking.slotStart)} JST</p>
        {booking.status === "processing" && <p className="mt-3 text-sm leading-6">Payment received. Your calendar confirmation is still being checked. Please contact me if this does not update.</p>}
        {booking.receipt ? <BookingReceipt receipt={booking.receipt} /> : <dl className="mt-5 space-y-2 text-sm"><div><dt>Reference</dt><dd className="font-mono">{booking.reference}</dd></div><div><dt>Original payment</dt><dd>{yen(booking.paidJpy)}</dd></div></dl>}
        {booking.refundedJpy > 0 && <p className="mt-4 text-sm">Refunded through Stripe: {yen(booking.refundedJpy)}. Your bank may take several days to show it.</p>}
        {booking.status === "confirmed" && booking.location && <div className="mt-6 border-t border-ink/10 pt-5">
          <h4 className="font-semibold">Meeting location</h4><p className="mt-2 whitespace-pre-wrap text-sm">{booking.location}</p>
          <a className="mt-3 inline-block text-sm underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location)}`} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
          {mapsKey && <iframe title={`Meeting location for ${booking.reference}`} className="mt-4 h-64 w-full rounded-xl border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapsKey)}&q=${encodeURIComponent(booking.location)}`} />}
        </div>}
      </article>)}
    </div>
    <p className="mt-8 text-sm leading-6 text-ink/60">Need help finding a booking? <a className="underline" href="https://www.instagram.com/kkawataki">Contact me on Instagram</a>. Have your reference already? <Link href="/cancel" className="underline">Manage cancellation</Link>.</p>
  </>
}
