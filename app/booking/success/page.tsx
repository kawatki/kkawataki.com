import type { Metadata } from "next"
import Link from "next/link"

import { BookingStatus } from "@/components/booking-status"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Booking confirmation",
  robots: { follow: false, index: false },
}

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams

  return (
    <section className="page-shell flex min-h-[70svh] items-center justify-center py-16">
      <div className="w-full max-w-3xl rounded-3xl border border-ink/10 bg-white px-6 py-14 shadow-xl shadow-ink/5 sm:px-12 sm:py-20">
        {sessionId ? (
          <BookingStatus sessionId={sessionId} />
        ) : (
          <div className="text-center">
            <p className="eyebrow">Booking status</p>
            <h1 className="mt-4 font-display text-5xl">No payment found.</h1>
            <p className="mt-4 text-ink/60">
              Return to booking and choose an available time.
            </p>
          </div>
        )}
        <div className="mt-9 text-center">
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-full border-ink/15"
            )}
          >
            Return home
          </Link>
        </div>
      </div>
    </section>
  )
}
