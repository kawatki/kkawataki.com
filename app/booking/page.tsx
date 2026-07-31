import type { Metadata } from "next"
import { CalendarCheck, Clock3, CreditCard, Info } from "lucide-react"

import { BookingFlow } from "@/components/booking-flow"

export const metadata: Metadata = {
  title: "Book",
  description:
    "Choose an available time range and secure your Rental Japanese Guy booking.",
}

const bookingFacts = [
  { icon: Clock3, label: "Duration", value: "4h preferred, flexible" },
  { icon: CreditCard, label: "To reserve", value: "25% deposit" },
  { icon: CalendarCheck, label: "Confirmation", value: "After payment" },
]

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const { payment } = await searchParams

  return (
    <>
      <section className="border-b border-ink/10 bg-cream">
        <div className="page-shell py-14 sm:py-20">
          <p className="eyebrow">Book your time</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_0.65fr] lg:items-end">
            <h1 className="max-w-4xl text-balance font-display text-6xl leading-[0.9] tracking-[-0.045em] sm:text-8xl">
              Choose when your Tokyo story starts.
            </h1>
            <p className="max-w-lg text-base leading-7 text-ink/65 lg:pb-2">
              Available times below are live. Your appointment is confirmed
              only after the deposit payment succeeds.
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-3">
            {bookingFacts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 bg-paper p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vermilion/10 text-vermilion">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-ink/45">{label}</p>
                  <p className="mt-1 text-sm font-semibold">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell py-10 sm:py-16">
        <BookingFlow
          paymentCancelled={payment === "cancelled"}
          turnstileSiteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""}
        />

        <div className="mt-10 grid gap-6 rounded-2xl bg-ink p-6 text-paper sm:grid-cols-[auto_1fr] sm:p-8">
          <Info className="size-6 text-jade-light" />
          <div>
            <h2 className="font-display text-2xl">Before you book</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-paper/65">
              The 25% deposit reserves your time and is deducted from the final
              amount. Longer bookings have a proportionally larger deposit.
              The remaining balance is paid in person. Before Stripe opens, you
              must review and accept the non-refundable deposit policy.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
