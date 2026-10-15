import type { Metadata } from "next"
import { CancellationForm } from "@/components/cancellation-form"
import { cancellationPolicyText } from "@/lib/booking-policy"

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
          <p className="mt-4 text-sm leading-6 text-ink/65">Cancel within 7 days after payment for 90% back.</p>
          <p className="mt-2 text-sm leading-6 text-ink/65">Exception: if your experience starts in less than 7 days, the short-notice rules below apply.</p>
          <p className="mt-4 font-semibold">After the 7-day payment window</p>
          <dl className="mt-4 space-y-3 text-base">
            {[["30 days or more before the start", 75], ["7 to less than 30 days before the start", 50], ["Less than 7 days before the start", 0]].map(([label, percent]) => (
              <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-semibold">{percent}% back</dd></div>
            ))}
          </dl>
          <p className="mt-5 text-sm leading-6 text-ink/65">{cancellationPolicyText()}</p>
          <p className="mt-3 text-sm text-ink/65">Your original booking terms apply if you booked under an earlier policy.</p>
        </aside>
      </div>
    </section>
  )
}
