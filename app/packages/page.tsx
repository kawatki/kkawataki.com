import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CalendarClock, MessageCircle, ShoppingBag } from "lucide-react"

import { PackageCart } from "@/components/package-cart"
import { buttonVariants } from "@/components/ui/button"
import { packageItems } from "@/lib/packages"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Luxury Tokyo package plans with a local guide, adjustable dates, and a local cart for package requests.",
}

const steps = [
  {
    icon: ShoppingBag,
    title: "Add a package",
    copy: "Choose the plan and guest count. The cart keeps it saved on your device.",
  },
  {
    icon: MessageCircle,
    title: "Send the request",
    copy: "We confirm preferred date, messaging app, restaurant availability, and details.",
  },
  {
    icon: CalendarClock,
    title: "Lock the plan",
    copy: "After the date and route are settled, payment and confirmation stay simple.",
  },
]

export default function PackagesPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-ink/10 bg-cream">
        <div className="absolute inset-x-0 bottom-0 h-px bg-ink/10" />
        <div className="page-shell grid gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_0.74fr] lg:items-end">
          <div>
            <p className="eyebrow">Package travel plans</p>
            <h1 className="mt-5 max-w-5xl text-balance font-display text-6xl leading-[0.9] tracking-[-0.045em] sm:text-8xl">
              Luxury Tokyo, arranged around you.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-ink/65">
              Fixed-shape package ideas for guests who want a more polished
              Tokyo day. Add a plan to cart, choose guest count, then send it
              as a request so we can adjust the date and details together.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#packages"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 rounded-full bg-ink px-6 text-paper hover:bg-vermilion"
                )}
              >
                Browse packages
                <ArrowRight />
              </a>
              <Link
                href="/request"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 rounded-full border-ink/20 bg-transparent px-6 hover:bg-paper/60"
                )}
              >
                Custom request
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-ink p-6 text-paper sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/50">
              Cart-first setup
            </p>
            <p className="mt-7 font-display text-5xl leading-none">
              Packages now, products later.
            </p>
            <p className="mt-5 text-sm leading-6 text-paper/62">
              Booking and open requests stay outside the cart. Package plans
              use local browser storage now, so future product lineups can use
              the same shopping flow without making the first version heavy.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-ink/10 bg-paper">
        <div className="page-shell grid gap-px py-10 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, copy }) => (
            <article
              key={title}
              className="border-b border-ink/10 py-6 last:border-b-0 sm:border-b-0 sm:border-r sm:px-7 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0"
            >
              <Icon className="size-6 text-vermilion" strokeWidth={1.7} />
              <h2 className="mt-5 font-display text-3xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="packages" className="page-shell py-14 pb-28 sm:py-20 sm:pb-32">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Lineup</p>
            <h2 className="mt-3 font-display text-5xl leading-none tracking-tight">
              Choose the plan.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-ink/58">
            Prices are per person in JPY. Restaurant seats and custom dates are
            confirmed after you send the cart request.
          </p>
        </div>

        <PackageCart
          packages={packageItems}
          turnstileSiteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""}
        />
      </section>
    </>
  )
}
