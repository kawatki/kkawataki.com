import type { Metadata } from "next"
import Link from "next/link"
import { BadgeCheck } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Package payment received",
  robots: { follow: false, index: false },
}

export default function PackageSuccessPage() {
  return (
    <section className="page-shell flex min-h-[70svh] items-center justify-center py-16">
      <div className="w-full max-w-3xl rounded-3xl border border-ink/10 bg-card px-6 py-14 text-center shadow-xl shadow-black/10 sm:px-12 sm:py-20">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-jade text-white">
          <BadgeCheck className="size-8" />
        </span>
        <p className="eyebrow mt-7">Payment received</p>
        <h1 className="mt-4 font-display text-5xl sm:text-7xl">
          Package request paid.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/65">
          Stripe will email your receipt. Your package reference is included in
          the payment details, and I’ll use your selected messaging app to
          confirm the date, restaurant availability, and meeting details.
        </p>
        <div className="mt-9">
          <Link
            href="/packages"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-full border-ink/15 px-5"
            )}
          >
            Return to packages
          </Link>
        </div>
      </div>
    </section>
  )
}
