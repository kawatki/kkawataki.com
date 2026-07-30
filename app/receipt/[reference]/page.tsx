import type { Metadata } from "next"
import Link from "next/link"
import { CalendarCheck, CircleAlert } from "lucide-react"

import { BookingReceipt } from "@/components/booking-receipt"
import { buttonVariants } from "@/components/ui/button"
import { getPublicBookingReceipt } from "@/lib/booking-receipt"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Booking receipt",
  robots: { follow: false, index: false },
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  let receipt = null

  try {
    receipt = await getPublicBookingReceipt(reference)
  } catch (error) {
    console.error("Receipt page lookup failed", error)
  }

  return (
    <section className="page-shell flex min-h-[70svh] items-center justify-center py-16">
      <div className="w-full max-w-3xl rounded-3xl border border-ink/10 bg-card px-6 py-14 shadow-xl shadow-black/10 sm:px-12 sm:py-20">
        {receipt ? (
          <>
            <div className="text-center">
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-jade text-white">
                <CalendarCheck className="size-8" />
              </span>
              <p className="eyebrow mt-7">Confirmed booking</p>
              <h1 className="mt-4 font-display text-5xl sm:text-7xl">
                Your receipt.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/65">
                This payment and appointment are confirmed. Keep this private
                link so you can check the details from any browser.
              </p>
            </div>
            <BookingReceipt receipt={receipt} />
          </>
        ) : (
          <div className="text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-vermilion/10 text-vermilion">
              <CircleAlert className="size-8" />
            </span>
            <p className="eyebrow mt-7">Receipt not found</p>
            <h1 className="mt-4 font-display text-5xl sm:text-6xl">
              We can’t verify this booking.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/65">
              Check that the complete receipt link was copied. Only confirmed,
              paid bookings have a public receipt.
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
