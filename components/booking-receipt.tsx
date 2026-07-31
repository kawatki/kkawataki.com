import type { BookingReceipt as BookingReceiptData } from "@/lib/booking"

function yen(amount: number) {
  return `¥${amount.toLocaleString("en-US")}`
}

function receiptDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value))
}

function receiptTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value))
}

export function BookingReceipt({ receipt }: { receipt: BookingReceiptData }) {
  return (
    <section className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-ink/10 text-left">
      <div className="flex flex-col gap-3 bg-cream/70 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="eyebrow">Booking receipt</p>
          <p className="mt-1 text-sm text-ink/55">
            Keep this reference for questions about your booking.
          </p>
        </div>
        <code className="w-fit rounded-full border border-jade/20 bg-card px-4 py-2 font-mono text-sm font-semibold tracking-wide text-jade">
          {receipt.bookingReference}
        </code>
      </div>

      <div className="grid gap-6 px-5 py-6 sm:px-7">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink/45">Date</dt>
            <dd className="mt-1 font-semibold">
              {receiptDate(receipt.slotStart)}
            </dd>
          </div>
          <div>
            <dt className="text-ink/45">Time</dt>
            <dd className="mt-1 font-semibold">
              {receiptTime(receipt.slotStart)}–{receiptTime(receipt.slotEnd)} JST
            </dd>
          </div>
          <div>
            <dt className="text-ink/45">Duration</dt>
            <dd className="mt-1 font-semibold">{receipt.durationHours} hours</dd>
          </div>
          <div>
            <dt className="text-ink/45">Email</dt>
            <dd className="mt-1 break-all font-semibold">
              {receipt.customerEmail}
            </dd>
          </div>
          {receipt.requestTitle && (
            <div className="sm:col-span-2">
              <dt className="text-ink/45">Plan</dt>
              <dd className="mt-1 font-semibold">{receipt.requestTitle}</dd>
            </div>
          )}
        </dl>

        <dl className="grid gap-3 border-t border-ink/10 pt-5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink/55">
              Service total · {yen(receipt.rateJpyPer30Minutes)} / 30 min
            </dt>
            <dd className="font-semibold">{yen(receipt.serviceTotalJpy)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink/55">Deposit paid to Stripe</dt>
            <dd className="font-semibold text-jade">
              {yen(receipt.depositAmountJpy)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-ink/10 pt-3">
            <dt className="font-semibold">Pay in person</dt>
            <dd className="font-semibold text-vermilion">
              {yen(receipt.balanceDueJpy)}
            </dd>
          </div>
        </dl>

        <div className="rounded-xl bg-cream/70 px-4 py-4 text-sm leading-6 text-ink/60">
          <p>
            The deposit is non-refundable if you cancel or do not attend. If I
            cancel, it will be refunded.
          </p>
          <p className="mt-2">
            You also cover transportation costs and any food or drinks during
            our time together. A {receipt.transportBufferMinutes / 60}-hour
            transportation buffer is reserved after your booking.
          </p>
        </div>
      </div>
    </section>
  )
}
