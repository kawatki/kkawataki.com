import Link from "next/link"
import { DEPOSIT_PERCENT, cancellationPolicyText } from "@/lib/booking-policy"
import type { Metadata } from "next"
import { Info } from "lucide-react"

import { BookingFlow } from "@/components/booking-flow"

export const metadata: Metadata = {
  title: "Book",
  description:
    "Choose a private Short Experience, Half Day, or Full Day in Tokyo, including a fixed transportation fee.",
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{
    booking_event_id?: string
    cancel_token?: string
    approval?: string
    payment?: string
  }>
}) {
  const { booking_event_id: bookingEventId, cancel_token: cancelToken, payment, approval } =
    await searchParams

  return (
    <>
      <section className="pb-32 lg:pb-36 page-shell py-10 sm:py-16">
        <h1 className="sr-only">Book your Tokyo experience</h1>
        <BookingFlow
          approval={approval}
          bookingEventId={bookingEventId}
          cancelToken={cancelToken}
          paymentCancelled={payment === "cancelled"}
          turnstileSiteKey={process.env.TURNSTILE_SITE_KEY?.trim() ?? ""}
        />

        <div className="mt-10 grid gap-6 rounded-2xl bg-ink p-6 text-paper sm:grid-cols-[auto_1fr] sm:p-8">
          <Info className="size-6 text-jade-light" />
          <div>
            <h2 className="font-display text-2xl">Before you book</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-paper/65">
              Pay {DEPOSIT_PERCENT}% upfront to reserve your time. Your booking total includes transportation and tax.
              Separately agreed extras are paid separately. Before Stripe opens, you must review and accept the payment and cancellation policy.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-paper/65">{cancellationPolicyText()}</p>
            <Link href="/cancel" className="mt-3 inline-block underline">Cancel a booking</Link>
          </div>
        </div>
      </section>
    </>
  )
}
