import { parsePackageIds } from "@/lib/experience-packages"
// Independent settings. Checkout stores a snapshot so edits affect new bookings only.
export const DEPOSIT_PERCENT = 50
export const CANCELLATION_POLICY = {
  version: "2026-10-14-v5",
  tiers: [{ days: 90, percent: 90 }, { days: 30, percent: 75 }, { days: 14, percent: 50 }, { days: 7, percent: 25 }, { days: 1, percent: 5 }, { days: 0, percent: 0 }],
  earlyNoticeDays: 14,
  oneDayPercent: 5,
  thirtyDaysPercent: 50,
  sevenDaysPercent: 25,
  latePercent: 0,
} as const

export type CancellationPolicy = {
  version: string
  tiers?: readonly { days: number; percent: number }[]
  earlyNoticeDays?: number
  oneDayPercent?: number
  thirtyDaysPercent: number
  sevenDaysPercent: number
  latePercent: number
}

export function cancellationPolicyText(policy: CancellationPolicy = CANCELLATION_POLICY) {
  if (policy.version === "2026-10-14-v5") return "You can cancel online and review your refund before confirming. Cancel within 7 days after payment for 90% back. Exception: if your experience starts in less than 7 days, the short-notice rules below apply. After that window: 75% back with at least 30 days before the start, or 50% with 7 to less than 30 days. With less than 7 days before the start: no refund, except approved short-notice bookings cancelled within 1 hour of payment, before the service starts and before arrangements begin, receive 90% back. Refunds apply to the amount paid. No-shows receive no refund. If Taki cancels, you receive a full refund. Days mean exact 24-hour periods."
  if (policy.version === "2026-10-14-v4") return "Refunds are a percentage of the amount paid. With at least 7 days before the start: 90% back within 7 days after payment, otherwise 50% back. With less than 7 days before the start: no refund. Short-notice bookings require Taki’s approval before payment; these have a 1-hour correction window after payment, before the service starts and before arrangements begin, for a 90% refund. No-shows receive no refund. No unpaid balance is charged on cancellation. If Taki cancels, the amount paid is refunded in full. All day limits use exact 24-hour periods."
  if (policy.tiers) return "90% back with at least 90 days’ notice; 75% with 30 to less than 90 days; 50% with 14 to less than 30 days; 25% with 7 to less than 14 days; 5% with at least 24 hours but less than 7 days; 0% with less than 24 hours. Notice is measured from the booking start time. Refunds apply to the amount paid. No-shows receive no refund. If I cancel, you receive a full refund."
  const earlyDays = policy.earlyNoticeDays ?? 30
  const lateText = policy.oneDayPercent === undefined
    ? `${policy.latePercent}% with less than 7 days`
    : `${policy.oneDayPercent}% with at least 24 hours but less than 7 days, and ${policy.latePercent}% with less than 24 hours`
  return `${policy.thirtyDaysPercent}% back with at least ${earlyDays} days’ notice, ${policy.sevenDaysPercent}% with at least 7 days but less than ${earlyDays} days, and ${lateText}. Refunds apply to the amount paid, not the full booking price. No-shows receive no refund. If I cancel, you receive a full refund.`
}

export function cancellationPolicyFromMetadata(metadata: Record<string, string>): CancellationPolicy {
  if (metadata.cancellation_policy_version === "2026-10-14-v5") return { version: "2026-10-14-v5", thirtyDaysPercent: 75, sevenDaysPercent: 50, latePercent: 0 }
  if (metadata.cancellation_policy_version === "2026-10-14-v4") return { version: "2026-10-14-v4", thirtyDaysPercent: 50, sevenDaysPercent: 0, latePercent: 0 }
  if (metadata.cancellation_policy_version === "2026-10-14-v3") {
    const tiers = JSON.parse(metadata.cancellation_tiers ?? "null")
    const expected = [{ days: 90, percent: 90 }, { days: 30, percent: 75 }, { days: 14, percent: 50 }, { days: 7, percent: 25 }, { days: 1, percent: 5 }, { days: 0, percent: 0 }]
    if (!Array.isArray(tiers) || tiers.length !== expected.length || tiers.some((tier, i) => !tier || tier.days !== expected[i].days || tier.percent !== expected[i].percent)) throw new Error("Invalid cancellation policy snapshot.")
    return { version: metadata.cancellation_policy_version, tiers, thirtyDaysPercent: 75, sevenDaysPercent: 25, latePercent: 0 }
  }
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

export function cancellationRefund(amountPaid: number, start: string, policy: CancellationPolicy, now = Date.now(), payment?: { paidAt: number; shortNoticeApproved: boolean; arrangementsStarted: boolean }) {
  const notice = new Date(start).getTime() - now
  if (!Number.isSafeInteger(amountPaid) || amountPaid < 0 || !Number.isFinite(notice) || notice <= 0) {
    throw new Error("This booking can no longer be cancelled online.")
  }
  const day = 24 * 60 * 60 * 1000
  if (policy.version === "2026-10-14-v4" || policy.version === "2026-10-14-v5") {
    if (!payment || !Number.isFinite(payment.paidAt) || payment.paidAt <= 0 || payment.paidAt > now) throw new Error("Payment time is unavailable. Please contact Taki.")
    const elapsed = now - payment.paidAt
    const percent = notice >= 7 * day ? (elapsed <= 7 * day ? 90 : policy.version === "2026-10-14-v5" && notice >= 30 * day ? 75 : 50) : payment.shortNoticeApproved && elapsed <= 3600000 && !payment.arrangementsStarted ? 90 : 0
    return { percent, amountJpy: Math.floor(amountPaid * percent / 100) }
  }
  const percent = policy.tiers ? (policy.tiers.find(tier => notice >= tier.days * day)?.percent ?? 0) : notice >= (policy.earlyNoticeDays ?? 30) * day ? policy.thirtyDaysPercent : notice >= 7 * day ? policy.sevenDaysPercent : notice >= day && policy.oneDayPercent !== undefined ? policy.oneDayPercent : policy.latePercent
  return { percent, amountJpy: Math.floor(amountPaid * percent / 100) }
}

// Read the immutable price agreed at checkout, never today's deposit/rate settings.
export function bookingPricingFromMetadata(metadata: Record<string, string>, amountPaid: number | null, currency: string | null) {
  const durationMinutes = Number(metadata.booking_duration_minutes)
  const rateJpyPer30Minutes = Number(metadata.rate_jpy_per_30_minutes)
  const serviceTotalJpy = Number(metadata.service_total_jpy)
  const depositAmountJpy = Number(metadata.deposit_amount_jpy)
  const depositPercent = Number(metadata.deposit_percent)
  const isExperience = ["private-experiences-v1", "private-experiences-v2", "private-experiences-v3", "private-experiences-v4", "private-experiences-v5"].includes(metadata.pricing_version)
  const planAmountJpy = Number(metadata.plan_amount_jpy)
  const transportFeeJpy = Number(metadata.transport_fee_jpy)
  const hasPackages = ["private-experiences-v4", "private-experiences-v5"].includes(metadata.pricing_version)
  const packageIds = hasPackages ? parsePackageIds(JSON.parse(metadata.package_ids ?? "[]")) : []
  const packagesTotalJpy = hasPackages ? Number(metadata.packages_total_jpy) : 0
  const subtotalJpy = planAmountJpy + transportFeeJpy + packagesTotalJpy
  const taxRate = metadata.pricing_version === "private-experiences-v5" ? Number(metadata.tax_rate) : 0
  const taxAmountJpy = Math.round(subtotalJpy * taxRate)
  const validPrice = isExperience
    ? (metadata.pricing_version === "private-experiences-v1" ? [240, 480, 720] : metadata.pricing_version === "private-experiences-v2" ? [240, 360, 420, 480, 720, 780, 840] : [240, 480, 840]).includes(durationMinutes) &&
      Number.isSafeInteger(planAmountJpy) && planAmountJpy > 0 &&
      Number.isSafeInteger(transportFeeJpy) && transportFeeJpy >= 0 &&
      Number.isSafeInteger(packagesTotalJpy) && packagesTotalJpy >= 0 &&
      (packageIds.length > 0 ? packagesTotalJpy > 0 : packagesTotalJpy === 0) &&
      Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 1 && serviceTotalJpy === subtotalJpy + taxAmountJpy
    : !metadata.pricing_version && Number.isSafeInteger(rateJpyPer30Minutes) && rateJpyPer30Minutes > 0 &&
      serviceTotalJpy === rateJpyPer30Minutes * (durationMinutes / 30)
  if (currency !== "jpy" || ![durationMinutes, serviceTotalJpy, depositAmountJpy, depositPercent].every(Number.isSafeInteger) ||
      durationMinutes < 60 || durationMinutes % 30 !== 0 || !validPrice || depositPercent <= 0 || depositPercent > 100 ||
      depositAmountJpy !== Math.ceil(serviceTotalJpy * depositPercent / 100) || amountPaid !== depositAmountJpy) {
    throw new Error("Paid Checkout Session has invalid pricing metadata.")
  }
  return {
    durationHours: durationMinutes / 60, serviceTotalJpy, depositAmountJpy, depositPercent,
    balanceDueJpy: serviceTotalJpy - depositAmountJpy,
    ...(isExperience ? { subtotalJpy, taxRate, taxAmountJpy } : {}),
    packageIds,
    packagesTotalJpy,
    pricingVersion: isExperience ? metadata.pricing_version : undefined,
    planAmountJpy: isExperience ? planAmountJpy : undefined,
    transportFeeJpy: isExperience ? transportFeeJpy : undefined,
    rateJpyPer30Minutes: isExperience ? undefined : rateJpyPer30Minutes,
  }
}
