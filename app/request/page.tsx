import type { Metadata } from "next"

import { CustomRequestPayment } from "@/components/custom-request-payment"

export const metadata: Metadata = {
  title: "Custom request payment",
  description: "Private custom payment page for Rental Japanese Guy.",
  robots: { follow: false, index: false },
}

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const { payment } = await searchParams

  return (
    <section className="border-b border-ink/10 bg-cream">
      <div className="page-shell py-14 sm:py-20">
        <div className="mb-10 max-w-3xl">
          <p className="eyebrow">Private payment link</p>
          <h1 className="mt-5 text-balance font-display text-6xl leading-[0.9] tracking-[-0.045em] sm:text-8xl">
            For the thing we already talked about.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink/65">
            This hidden page is for custom payments arranged directly with me.
            It stays separate from the normal booking calendar.
          </p>
        </div>

        <CustomRequestPayment
          paymentCancelled={payment === "cancelled"}
          turnstileSiteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""}
        />
      </div>
    </section>
  )
}
