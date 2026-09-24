// Independent settings. Checkout stores a snapshot so edits affect new bookings only.
export const DEPOSIT_PERCENT = 50
export const CANCELLATION_POLICY = {
  version: "2026-09-25-v2",
  earlyNoticeDays: 14,
  oneDayPercent: 5,
  thirtyDaysPercent: 50,
  sevenDaysPercent: 25,
  latePercent: 0,
} as const

export type CancellationPolicy = {
  version: string
  earlyNoticeDays?: number
  oneDayPercent?: number
  thirtyDaysPercent: number
  sevenDaysPercent: number
  latePercent: number
}

export function cancellationPolicyText(policy: CancellationPolicy = CANCELLATION_POLICY) {
  const earlyDays = policy.earlyNoticeDays ?? 30
  const lateText = policy.oneDayPercent === undefined
    ? `${policy.latePercent}% with less than 7 days`
    : `${policy.oneDayPercent}% with at least 24 hours but less than 7 days, and ${policy.latePercent}% with less than 24 hours`
  return `${policy.thirtyDaysPercent}% back with at least ${earlyDays} days’ notice, ${policy.sevenDaysPercent}% with at least 7 days but less than ${earlyDays} days, and ${lateText}. Refunds apply to the amount paid, not the full booking price. No-shows receive no refund. If I cancel, you receive a full refund.`
}

export function cancellationPolicyFromMetadata(metadata: Record<string, string>): CancellationPolicy {
  if (!metadata.cancellation_policy_version) {
    return { version: "legacy-non-refundable", thirtyDaysPercent: 0, sevenDaysPercent: 0, latePercent: 0 }
  }
  const keys = ["cancellation_30_days_percent", "cancellation_7_days_percent", "cancellation_late_percent"]
  const values = keys.map((key) => metadata[key] === undefined ? NaN : Number(metadata[key]))
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 100)) {
    throw new Error("Invalid cancellation policy snapshot.")
  }
  const hasNewTiers = metadata.cancellation_early_notice_days !== undefined || metadata.cancellation_1_day_percent !== undefined || metadata.cancellation_policy_version === "2026-09-25-v2"
  const earlyNoticeDays = Number(metadata.cancellation_early_notice_days)
  const oneDayPercent = Number(metadata.cancellation_1_day_percent)
  if (hasNewTiers && (!Number.isInteger(earlyNoticeDays) || earlyNoticeDays <= 7 || !Number.isInteger(oneDayPercent) || oneDayPercent < 0 || oneDayPercent > 100)) {
    throw new Error("Invalid cancellation policy snapshot.")
  }
  return { version: metadata.cancellation_policy_version, thirtyDaysPercent: values[0], sevenDaysPercent: values[1], latePercent: values[2], ...(hasNewTiers ? { earlyNoticeDays, oneDayPercent } : {}) }
}

export function cancellationRefund(amountPaid: number, start: string, policy: CancellationPolicy, now = Date.now()) {
  const notice = new Date(start).getTime() - now
  if (!Number.isSafeInteger(amountPaid) || amountPaid < 0 || !Number.isFinite(notice) || notice <= 0) {
    throw new Error("This booking can no longer be cancelled online.")
  }
  const day = 24 * 60 * 60 * 1000
  const percent = notice >= (policy.earlyNoticeDays ?? 30) * day ? policy.thirtyDaysPercent : notice >= 7 * day ? policy.sevenDaysPercent : notice >= day && policy.oneDayPercent !== undefined ? policy.oneDayPercent : policy.latePercent
  return { percent, amountJpy: Math.floor(amountPaid * percent / 100) }
}

// Read the immutable price agreed at checkout, never today's deposit/rate settings.
export function bookingPricingFromMetadata(metadata: Record<string, string>, amountPaid: number | null, currency: string | null) {
  const durationMinutes = Number(metadata.booking_duration_minutes)
  const rateJpyPer30Minutes = Number(metadata.rate_jpy_per_30_minutes)
  const serviceTotalJpy = Number(metadata.service_total_jpy)
  const depositAmountJpy = Number(metadata.deposit_amount_jpy)
  const depositPercent = Number(metadata.deposit_percent)
  if (currency !== "jpy" || ![durationMinutes, rateJpyPer30Minutes, serviceTotalJpy, depositAmountJpy, depositPercent].every(Number.isSafeInteger) ||
      durationMinutes < 60 || durationMinutes % 30 !== 0 || rateJpyPer30Minutes <= 0 ||
      serviceTotalJpy !== rateJpyPer30Minutes * (durationMinutes / 30) || depositPercent <= 0 || depositPercent > 100 ||
      depositAmountJpy !== Math.ceil(serviceTotalJpy * depositPercent / 100) || amountPaid !== depositAmountJpy) {
    throw new Error("Paid Checkout Session has invalid pricing metadata.")
  }
  return { durationHours: durationMinutes / 60, rateJpyPer30Minutes, serviceTotalJpy, depositAmountJpy, depositPercent, balanceDueJpy: serviceTotalJpy - depositAmountJpy }
}
