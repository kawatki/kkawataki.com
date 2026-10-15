import { EXPERIENCE_PACKAGES } from "@/lib/experience-packages"
import Link from "next/link"
import { cancellationPolicyText } from "@/lib/booking-policy"
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
          {receipt.pricingVersion && <>
            <div className="flex items-center justify-between gap-4"><dt>{receipt.durationHours}-hour experience</dt><dd>{yen(receipt.planAmountJpy ?? 0)}</dd></div>
            {!!receipt.packagesTotalJpy && <div className="flex items-center justify-between gap-4"><dt>Packages: {receipt.packageIds?.map(id => EXPERIENCE_PACKAGES.find(item => item.id === id)?.name ?? id).join(", ")}</dt><dd>{yen(receipt.packagesTotalJpy)}</dd></div>}
            <div className="flex items-center justify-between gap-4"><dt>Transportation</dt><dd>{yen(receipt.transportFeeJpy ?? 0)}</dd></div>
            {!!receipt.taxAmountJpy && <div className="flex items-center justify-between gap-4"><dt>Tax ({(receipt.taxRate ?? 0) * 100}%)</dt><dd>{yen(receipt.taxAmountJpy)}</dd></div>}
          </>}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink/55">
              {receipt.pricingVersion ? "Booking total (including transportation)" : `Service total · ${yen(receipt.rateJpyPer30Minutes ?? 0)} / 30 min`}
            </dt>
            <dd className="font-semibold">{yen(receipt.serviceTotalJpy)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink/55">{receipt.balanceDueJpy === 0 ? "Paid in full via Stripe" : "Deposit paid via Stripe"}</dt>
            <dd className="font-semibold text-jade">
              {yen(receipt.depositAmountJpy)}
            </dd>
          </div>
          {receipt.depositAmountJpy < receipt.serviceTotalJpy && receipt.balanceDueJpy > 0 ? (
          <div className="flex items-center justify-between gap-4 border-t border-ink/10 pt-3">
            <dt className="font-semibold">Remaining balance</dt>
            <dd className="font-semibold text-vermilion">
              {yen(receipt.balanceDueJpy)}
            </dd>
          </div>
          ) : null}
        </dl>

        <div className="rounded-xl bg-cream/70 px-4 py-4 text-sm leading-6 text-ink/60">
          <p>
            {cancellationPolicyText(receipt.cancellationPolicy)}
          </p>
          <Link href="/cancel" className="mt-3 inline-block underline">Cancel this booking</Link>
          {["private-experiences-v2", "private-experiences-v3", "private-experiences-v4", "private-experiences-v5"].includes(receipt.pricingVersion ?? "") && <p className="mt-2">You may finish earlier to suit your schedule. Your plan has a fixed price; unused time is not refunded.</p>}
          <p className="mt-2">
            {receipt.pricingVersion ? "Transportation is included in your booking total. Food, drinks, and activity costs are extra." : "You also cover transportation costs (approximately 3,000–4,000 JPY) and any food or drinks during our time together."} A {receipt.transportBufferMinutes / 60}-hour
            transportation buffer is reserved after your booking.
          </p>
        </div>
      </div>
    </section>
  )
}
