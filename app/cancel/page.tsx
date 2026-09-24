import type { Metadata } from "next"
import { CancellationForm } from "@/components/cancellation-form"
import { CANCELLATION_POLICY } from "@/lib/booking-policy"

export const metadata: Metadata = { title: "Cancel a booking", robots: { index: false, follow: false } }

export default function CancelPage() {
  return (
    <section className="page-shell py-14 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Plans change</p>
        <h1 className="mt-4 font-display text-5xl tracking-tight sm:text-6xl">Cancel a booking.</h1>
        <p className="mt-5 text-base leading-7 text-ink/65">Enter the email used for payment and your booking reference. You’ll see the refund amount before you confirm.</p>
        <CancellationForm turnstileSiteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""} />
        <aside className="mt-10 rounded-2xl bg-cream p-6">
          <h2 className="font-display text-2xl">Cancellation policy</h2>
          <dl className="mt-4 space-y-3 text-base">
            {[["30 days or more", CANCELLATION_POLICY.thirtyDaysPercent], ["7 days to less than 30 days", CANCELLATION_POLICY.sevenDaysPercent], ["Less than 7 days", CANCELLATION_POLICY.latePercent]].map(([label, percent]) => (
              <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-semibold">{percent}% back</dd></div>
            ))}
          </dl>
          <p className="mt-5 text-sm leading-6 text-ink/65">Refunds are a percentage of the amount paid. Notice is measured from your booking’s exact start time in Japan, with one day equal to 24 hours. Your original booking terms apply if you booked under an earlier policy. No-shows receive no refund. If I cancel, you receive a full refund.</p>
        </aside>
      </div>
    </section>
  )
}
