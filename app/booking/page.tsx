import type { Metadata } from "next"
import { ArrowUpRight, CalendarCheck, Clock3, CreditCard, Info } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { bookingUrl, hasBookingUrl } from "@/lib/site"

export const metadata: Metadata = {
  title: "Book",
  description:
    "Choose an available four-hour time and secure your Rental Japanese Guy booking.",
}

const bookingFacts = [
  { icon: Clock3, label: "Duration", value: "4 hours" },
  { icon: CreditCard, label: "To reserve", value: "Small deposit" },
  { icon: CalendarCheck, label: "Confirmation", value: "After payment" },
]

export default function BookingPage() {
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
        {hasBookingUrl ? (
          <>
            <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-xl shadow-ink/5">
              <iframe
                src={bookingUrl}
                title="Rental Japanese Guy booking calendar"
                className="h-[820px] w-full border-0 sm:h-[900px]"
                loading="eager"
              />
            </div>
            <div className="mt-5 flex flex-col items-start justify-between gap-3 text-sm text-ink/55 sm:flex-row sm:items-center">
              <p>Times are shown by Google Calendar in your selected timezone.</p>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
              >
                Open in a new window
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          </>
        ) : (
          <div className="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-dashed border-ink/20 bg-white px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-vermilion/10 text-vermilion">
              <CalendarCheck className="size-7" />
            </span>
            <h2 className="mt-6 font-display text-4xl">Calendar ready to connect</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-ink/60">
              Add your Google Appointment Schedule URL to the local environment
              file and the live booking calendar will appear here.
            </p>
            <a
              href="https://calendar.google.com/"
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "mt-7 h-11 rounded-full px-5"
              )}
            >
              Open Google Calendar
              <ArrowUpRight />
            </a>
          </div>
        )}

        <div className="mt-10 grid gap-6 rounded-2xl bg-ink p-6 text-paper sm:grid-cols-[auto_1fr] sm:p-8">
          <Info className="size-6 text-jade-light" />
          <div>
            <h2 className="font-display text-2xl">Before you book</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-paper/65">
              The deposit reserves your time and is deducted from the final
              amount. The remaining balance is paid in person. Cancellation and
              refund terms are shown before payment.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
