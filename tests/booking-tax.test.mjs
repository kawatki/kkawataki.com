import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'
const load = loader({})
const { experiencePrice, TAX_RATE } = load('@/lib/experience-plans')
const { bookingPricingFromMetadata } = load('@/lib/booking-policy')
test('tax applies to subtotal and deposit, and is preserved in payment snapshot', () => {
  const p = experiencePrice(840, {peopleCount:1,faceRecordingConsent:false})
  assert.equal(TAX_RATE,0.1)
  assert.equal(p.subtotalJpy,37600)
  assert.equal(p.taxAmountJpy,3760)
  assert.equal(p.serviceTotalJpy,41360)
  assert.equal(p.depositAmountJpy,20680)
  const metadata={pricing_version:p.pricingVersion, tax_rate:String(p.taxRate), package_ids:'[]', packages_total_jpy:'0', booking_duration_minutes:'840',plan_amount_jpy:String(p.planAmountJpy),transport_fee_jpy:'4000',service_total_jpy:String(p.serviceTotalJpy),deposit_amount_jpy:String(p.depositAmountJpy),deposit_percent:String(p.depositPercent)}
  const restored=bookingPricingFromMetadata(metadata,p.depositAmountJpy,'jpy')
  assert.equal(restored.taxAmountJpy,3760)
})
