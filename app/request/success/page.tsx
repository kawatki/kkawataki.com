import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheck } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Custom payment received",
  robots: { follow: false, index: false },
}

function validRequestReference(value: string | undefined) {
  return /^RJG-REQ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/u.test(
    value ?? ""
  )
}

export default async function RequestSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>
}) {
  const { reference } = await searchParams
  const requestReference = validRequestReference(reference) ? reference : ""

  return (
    <section className="page-shell flex min-h-[70svh] items-center justify-center py-16">
      <div className="w-full max-w-3xl rounded-3xl border border-ink/10 bg-card px-6 py-14 text-center shadow-xl shadow-black/10 sm:px-12 sm:py-20">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-jade text-white">
          <BadgeCheck className="size-8" />
        </span>
        <p className="eyebrow mt-7">Payment received</p>
        <h1 className="mt-4 font-display text-5xl sm:text-7xl">
          Thank you.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/65">
          Your custom request payment went through. Stripe will send the receipt
          to the email address you provided. If this is connected to a booking,
          I’ll follow up in our messages.
        </p>
        {requestReference ? (
          <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-ink/10 bg-cream px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
              Request reference
            </p>
            <p className="mt-2 font-mono text-lg font-semibold text-ink">
              {requestReference}
            </p>
          </div>
        ) : null}
        <div className="mt-9">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-full border-ink/15 px-5"
            )}
          >
            Return home
          </Link>
        </div>
      </div>
    </section>
  )
}
