import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { loader } from "./module-loader.mjs"
const root = path.resolve(import.meta.dirname, "..")


function harness({ days = 40, legacy = false, priorRefund = 0 } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(fs.readFileSync(path.join(root, 'drizzle/0001_cultured_william_stryker.sql'), 'utf8'))
  const database = {
    prepare(sql) {
      const statement = db.prepare(sql)
      return { bind(...args) { return {
        async first() { return statement.get(...args) ?? null },
        async all() { return { results: statement.all(...args) } },
        async run() { return statement.run(...args) },
      } } }
    },
  }
  const reference = 'RJG-2345-ABCD'
  const email = 'guest@example.com'
  let calendarCalls = 0, refundCalls = 0, confirmCalls = 0
  let calendarFailure = false, refundFailure = false, ambiguousRefund = false
  const refunds = []
  const booking = { eventId: 'event', stripeSessionId: 'cs_paid', slotStart: new Date(Date.now() + days * 86400000).toISOString(), slotEnd: new Date(Date.now() + (days * 24 + 4) * 3600000).toISOString() }
  const session = {
    id: 'cs_paid', amount_total: 2000, currency: 'jpy', payment_status: 'paid', payment_intent: 'pi_paid',
    customer_details: { email }, metadata: {
      booking_reference: reference, booking_event_id: 'event', customer_name: 'Guest', booking_title: 'Tokyo',
      booking_duration_minutes: '240', rate_jpy_per_30_minutes: '1000', service_total_jpy: '8000', deposit_amount_jpy: '2000', deposit_percent: '25',
      ...(legacy ? {} : { cancellation_policy_version: 'test-v1', cancellation_30_days_percent: '50', cancellation_7_days_percent: '25', cancellation_late_percent: '0' }),
    },
  }
  const stripe = {
    checkout: { sessions: { async retrieve() { return session } } },
    refunds: {
      async retrieve(id) { return refunds.find(r => r.id === id) },
      async *list() { yield* refunds },
      async create(input, options) {
        refundCalls++
        assert.equal(options.idempotencyKey, 'customer-cancellation-cs_paid')
        if (refundFailure) throw new Error('simulated provider outage')
        const refund = { id: 're_1', amount: input.amount, status: 'succeeded', metadata: input.metadata }
        refunds.push(refund)
        if (ambiguousRefund) throw new Error('response lost after refund creation')
        return refund
      },
    },
    paymentIntents: { async retrieve() { return { latest_charge: { amount_refunded: priorRefund, disputed: false } } } },
    webhooks: { async constructEventAsync() { return { type: 'checkout.session.completed', created: Math.floor(Date.now() / 1000), data: { object: session } } } },
  }
  const load = loader({
    'cloudflare:workers': { env: { RATE_LIMIT_DB: database } },
    '@/lib/server-config': { requiredEnv: () => 'test-secret-not-a-real-key' },
    '@/lib/stripe': { getStripe: () => stripe, getStripeCryptoProvider: () => ({}) },
    '@/lib/google-calendar': {
      async findConfirmedBookingByReference(ref) { return ref === reference ? booking : null },
      async releaseCancelledBooking() { calendarCalls++; if (calendarFailure) throw new Error('simulated calendar outage') },
      async confirmPaidBooking() { confirmCalls++; return { confirmed: true } },
    },
    '@/lib/google-tasks': {}, '@/lib/google-commerce-tasks': {},
  })
  return { load, db, reference, email, session, booking, refunds,
    get calls() { return { calendar: calendarCalls, refunds: refundCalls, confirm: confirmCalls } },
    set calendarFailure(value) { calendarFailure = value },
    set refundFailure(value) { refundFailure = value },
    set ambiguousRefund(value) { ambiguousRefund = value },
    cancel: load('@/lib/booking-cancellation'), policy: load('@/lib/booking-policy'),
  }
}

const base = loader({})('@/lib/booking-policy')
test('refund boundaries are exact and independent of the deposit setting', () => {
  const now = Date.parse('2026-09-24T00:00:00+09:00')
  for (const [offset, expected] of [[30*86400000,50],[14*86400000,50],[14*86400000-1,25],[7*86400000,25],[7*86400000-1,5],[86400000,5],[86400000-1,0]]) {
    const result = base.cancellationRefund(2000, new Date(now+offset).toISOString(), {version:'2026-09-25-v2',earlyNoticeDays:14,oneDayPercent:5,thirtyDaysPercent:50,sevenDaysPercent:25,latePercent:0}, now)
    assert.equal(result.percent, expected)
    assert.equal(result.amountJpy, 2000 * expected / 100)
  }
  assert.equal(base.cancellationRefund(2001, new Date(now+40*86400000).toISOString(), {version:'2026-09-25-v2',earlyNoticeDays:14,oneDayPercent:5,thirtyDaysPercent:50,sevenDaysPercent:25,latePercent:0}, now).amountJpy, 1000)
  assert.throws(() => base.cancellationRefund(2000, new Date(now).toISOString(), {version:'2026-09-25-v2',earlyNoticeDays:14,oneDayPercent:5,thirtyDaysPercent:50,sevenDaysPercent:25,latePercent:0}, now))
  assert.throws(() => base.cancellationRefund(-1, 'invalid', {version:'2026-09-25-v2',earlyNoticeDays:14,oneDayPercent:5,thirtyDaysPercent:50,sevenDaysPercent:25,latePercent:0}, now))
})
test('policy snapshots preserve old rates; legacy bookings remain non-refundable', () => {
  const old = base.cancellationPolicyFromMetadata({ cancellation_policy_version: 'old', cancellation_30_days_percent: '75', cancellation_7_days_percent: '50', cancellation_late_percent: '0' })
  assert.equal(old.thirtyDaysPercent, 75)
  assert.equal(base.cancellationPolicyFromMetadata({}).thirtyDaysPercent, 0)
  assert.throws(() => base.cancellationPolicyFromMetadata({ cancellation_policy_version: 'bad' }))
})
test('price snapshots accept independently changed deposits and reject inconsistent payments', () => {
  const h = harness()
  const metadata = { ...h.session.metadata, deposit_percent: '40', deposit_amount_jpy: '3200' }
  assert.equal(base.bookingPricingFromMetadata(metadata, 3200, 'jpy').balanceDueJpy, 4800)
  assert.throws(() => base.bookingPricingFromMetadata(metadata, 2000, 'jpy'))
  assert.throws(() => base.bookingPricingFromMetadata(metadata, 3200, 'usd'))
})
test('preview does not cancel or refund; mismatched email/reference rejected', async () => {
  const h = harness()
  const result = await h.cancel.previewCancellation(h.email, h.reference)
  assert.equal(result.refundAmountJpy, 1000)
  assert.deepEqual(h.calls, { calendar: 0, refunds: 0, confirm: 0 })
  await assert.rejects(h.cancel.previewCancellation('someone@example.com', h.reference), /No booking/)
  await assert.rejects(h.cancel.previewCancellation(h.email, 'RJG-9999-ABCD'), /No booking/)
  assert.deepEqual(h.cancel.parseCancellationInput({email:' GUEST@example.com ',reference:'rjg-2345-abcd'}), {email:h.email,reference:h.reference})
})
test('confirmation releases schedule and refunds once, including concurrent retries', async () => {
  const h = harness()
  const quote = await h.cancel.previewCancellation(h.email,h.reference)
  const results = await Promise.all(Array.from({length:5}, () => h.cancel.confirmCancellation(h.email,h.reference,quote.quote)))
  const result = await h.cancel.confirmCancellation(h.email,h.reference,quote.quote)
  assert.equal(result.cancelled,true)
  assert.equal(result.refundStatus,'succeeded')
  assert.equal(h.calls.refunds,1)
  assert.equal(h.calls.calendar,1)
  assert.equal(results.length,5)
  await assert.rejects(h.cancel.confirmCancellation('someone@example.com',h.reference,quote.quote), /No booking/)
})
test('zero-refund and legacy bookings still release the calendar', async () => {
  for (const options of [{days:2},{legacy:true}]) {
    const h=harness(options)
    const q=await h.cancel.previewCancellation(h.email,h.reference)
    const r=await h.cancel.confirmCancellation(h.email,h.reference,q.quote)
    assert.equal(r.refundAmountJpy,0)
    assert.equal(r.cancelled,true)
    assert.equal(r.refundStatus,'not_due')
    assert.equal(h.calls.refunds,0)
  }
})
test('tampered quote and changed start time cannot authorize cancellation', async () => {
  const h=harness()
  const q=await h.cancel.previewCancellation(h.email,h.reference)
  await assert.rejects(h.cancel.confirmCancellation(h.email,h.reference,q.quote+'x'))
  h.booking.slotStart=new Date(Date.now()+2*86400000).toISOString()
  await assert.rejects(h.cancel.confirmCancellation(h.email,h.reference,q.quote), /changed/)
  assert.equal(h.calls.refunds,0)
  assert.equal(h.calls.calendar,0)
})
test('refund outage keeps entitlement durable and retry finishes once', async () => {
  const h=harness(); h.refundFailure=true
  const q=await h.cancel.previewCancellation(h.email,h.reference)
  const r=await h.cancel.confirmCancellation(h.email,h.reference,q.quote)
  assert.equal(r.cancelled,true)
  assert.equal(r.refundStatus,'not_started')
  h.refundFailure=false
  await h.cancel.retryBookingCancellations()
  const done=await h.cancel.previewCancellation(h.email,h.reference)
  assert.equal(done.refundStatus,'succeeded')
  assert.equal(h.calls.calendar,1)
  assert.equal(h.refunds.length,1)
})
test('calendar outage is retried before the refund', async () => {
  const h=harness(); h.calendarFailure=true
  const q=await h.cancel.previewCancellation(h.email,h.reference)
  const r=await h.cancel.confirmCancellation(h.email,h.reference,q.quote)
  assert.equal(r.cancelled,false); assert.equal(h.calls.refunds,0)
  h.calendarFailure=false
  await h.cancel.retryBookingCancellations()
  assert.equal((await h.cancel.previewCancellation(h.email,h.reference)).cancelled,true)
  assert.equal(h.calls.refunds,1)
})
test('lost refund response uses Stripe history on retry, never issues another', async () => {
  const h=harness(); h.ambiguousRefund=true
  const q=await h.cancel.previewCancellation(h.email,h.reference)
  await h.cancel.confirmCancellation(h.email,h.reference,q.quote)
  h.ambiguousRefund=false
  await h.cancel.retryBookingCancellations()
  assert.equal(h.calls.refunds,1)
  assert.equal((await h.cancel.previewCancellation(h.email,h.reference)).refundStatus,'succeeded')
})
test('manual refunds are flagged for attention without another refund', async () => {
  const h=harness({priorRefund:500})
  const q=await h.cancel.previewCancellation(h.email,h.reference)
  const r=await h.cancel.confirmCancellation(h.email,h.reference,q.quote)
  assert.equal(r.cancelled,true); assert.equal(r.refundStatus,'needs_attention'); assert.equal(h.calls.refunds,0)
})
test('late payment webhook replay never restores a canceled booking or refunds twice', async () => {
  const h=harness()
  const q=await h.cancel.previewCancellation(h.email,h.reference)
  await h.cancel.confirmCancellation(h.email,h.reference,q.quote)
  const response=await h.load('@/app/api/stripe/webhook/route').POST(new Request('https://example.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'test'},body:'{}'}))
  assert.equal(response.status,200)
  assert.equal(h.calls.confirm,0)
  assert.equal(h.calls.refunds,1)
})
test('confirmation API rejects other origins and invalid actions', async () => {
  const load=loader({ '@/lib/booking-cancellation': { parseCancellationInput: () => ({email:'a@b.com',reference:'RJG-2345-ABCD'}), CancellationInputError: class extends Error {} }, '@/lib/rate-limit': { checkRateLimit: async () => ({allowed:true}) } })
  const route=load('@/app/api/cancel/route')
  const request=(origin,body) => new Request('https://example.com/api/cancel',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})
  assert.equal((await route.POST(request('https://evil.example',{}))).status,403)
  assert.equal((await route.POST(request('https://example.com',{action:'delete'}))).status,400)
})

test('new cancellation metadata round-trips and old paid bookings retain original tiers', () => {
 const snapshot=base.cancellationPolicyFromMetadata({cancellation_policy_version:'2026-09-25-v2',cancellation_early_notice_days:'14',cancellation_1_day_percent:'5',cancellation_30_days_percent:'50',cancellation_7_days_percent:'25',cancellation_late_percent:'0'})
 assert.deepEqual(snapshot,{version:'2026-09-25-v2',earlyNoticeDays:14,oneDayPercent:5,thirtyDaysPercent:50,sevenDaysPercent:25,latePercent:0})
 const old=base.cancellationPolicyFromMetadata({cancellation_policy_version:'2026-09-24-v1',cancellation_30_days_percent:'50',cancellation_7_days_percent:'25',cancellation_late_percent:'0'})
 const now=Date.now()
 assert.equal(base.cancellationRefund(2000,new Date(now+20*86400000).toISOString(),old,now).percent,25)
 assert.equal(base.cancellationRefund(2000,new Date(now+3*86400000).toISOString(),old,now).percent,0)
 assert.throws(()=>base.cancellationPolicyFromMetadata({cancellation_policy_version:'2026-09-25-v2',cancellation_30_days_percent:'50',cancellation_7_days_percent:'25',cancellation_late_percent:'0'}))
 assert.equal(base.DEPOSIT_PERCENT,50)
})
