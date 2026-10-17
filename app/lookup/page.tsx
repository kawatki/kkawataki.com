import type { Metadata } from "next"
import { BookingLookup } from "@/components/booking-lookup"

export const metadata: Metadata = { title: "Find your booking", robots: { index: false, follow: false } }

export default function LookupPage() {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  const testMode = /^(sk|rk)_test_/.test(stripeKey)
  return (
    <section className="page-shell py-14 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Your time in Japan</p>
        <h1 className="mt-4 font-display text-5xl tracking-tight sm:text-6xl">Find your booking.</h1>
        <p className="mt-5 text-base leading-7 text-ink/65">Check your dates, meeting location, and payment details using the email and card you used to book.</p>
        {testMode && <aside role="status" className="mt-6 rounded-2xl border border-vermilion/30 bg-cream p-5 text-sm leading-6">
          <p className="font-semibold">Test mode — real bookings are not available here</p>
          <p className="mt-1">This page searches test payments only. Bookings paid for on the live website will not appear.</p>
        </aside>}
        <BookingLookup turnstileSiteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""} mapsKey={process.env.GOOGLE_MAPS_EMBED_API_KEY?.trim() ?? ""} />
      </div>
    </section>
  )
}
