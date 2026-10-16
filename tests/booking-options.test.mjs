import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'
const load = loader({})
const { getBookingPricing, makeSlot, minimumDurationForAvailableTimes } = load('@/lib/booking')
const { bookingPriceMultiplier, parseBookingOptions } = load('@/lib/booking-options')
const { experienceStartTimes } = load('@/lib/experience-plans')
const { bookingPricingFromMetadata } = load('@/lib/booking-policy')
function snapshot(p) {
  return { pricing_version:p.pricingVersion, tax_rate:String(p.taxRate), package_ids:JSON.stringify(p.packageIds), packages_total_jpy:String(p.packagesTotalJpy), booking_duration_minutes:String(p.durationHours*60), plan_amount_jpy:String(p.planAmountJpy), transport_fee_jpy:String(p.transportFeeJpy), service_total_jpy:String(p.serviceTotalJpy), deposit_amount_jpy:String(p.depositAmountJpy), deposit_percent:String(p.depositPercent) }
}
test('fixed plans, group fees, transport, deposits and immutable snapshots agree', () => {
  for (const [hours, price] of [[4,8000],[8,16000],[14,28000]]) {
    for (let peopleCount=1; peopleCount<=6; peopleCount++) for (const faceRecordingConsent of [false,true]) {
      const multiplier = (peopleCount<=3 ? 1 : 2) * (faceRecordingConsent ? 1 : 1.2)
      assert.equal(bookingPriceMultiplier(peopleCount,faceRecordingConsent), multiplier)
      const p = getBookingPricing(hours*60, { peopleCount,faceRecordingConsent })
      assert.equal(p.planAmountJpy, price*multiplier)
      assert.equal(p.transportFeeJpy,4000)
      assert.equal(p.serviceTotalJpy,Math.round((price*multiplier+4000)*1.1))
      assert.equal(p.depositAmountJpy,p.serviceTotalJpy / 2)
      assert.equal(p.depositAmountJpy+p.balanceDueJpy,p.serviceTotalJpy)
      assert.equal(bookingPricingFromMetadata(snapshot(p),p.depositAmountJpy,'jpy').serviceTotalJpy,p.serviceTotalJpy)
    }
  }
})
test('reject arbitrary durations and bookings outside the opening window', () => {
  for (const minutes of [30,60,120,180,270,360,420,450,510,720,750,780,0,-60,NaN]) assert.throws(()=>getBookingPricing(minutes))
  assert.throws(()=>makeSlot('2026-10-15','09:00','14:00'))
  assert.throws(()=>makeSlot('2026-10-15','12:00','24:00'))
  assert.equal(makeSlot('2026-10-15','09:00','23:00').durationMinutes,840)
})
test('availability requires the whole experience to fit, with no short-booking fallback', () => {
  const times = Array.from({length:28}, (_,i)=>`${String(9+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`)
  assert.equal(experienceStartTimes(times,240).at(-1),'19:00')
  assert.equal(experienceStartTimes(times,480).at(-1),'15:00')
  assert.deepEqual(experienceStartTimes(times,840),['09:00'])
  assert.deepEqual(experienceStartTimes(times,780),[])
  assert.deepEqual(experienceStartTimes(times,720),[])
  assert.equal(experienceStartTimes(times.filter(t=>t!=='15:00'),720).length,0)
  assert.equal(minimumDurationForAvailableTimes(times.slice(0,6)),null)
})
test('new price snapshots reject inconsistent totals, deposits, unknown versions and nonpackage durations', () => {
  const p=getBookingPricing(240)
  for (const edit of [{service_total_jpy:'25000'},{transport_fee_jpy:'-1'},{deposit_amount_jpy:'1'},{booking_duration_minutes:'300'},{pricing_version:'unknown'}]) {
    assert.throws(()=>bookingPricingFromMetadata({...snapshot(p),...edit},p.depositAmountJpy,'jpy'))
  }
})
test('server rejects invalid group sizes and missing or nonboolean recording choices', () => {
  const good={peopleCount:1,faceRecordingConsent:false}
  for(const peopleCount of [0,7,-1,1.5,NaN,Infinity,'3',undefined]) assert.throws(()=>parseBookingOptions({...good,peopleCount}))
  for(const value of ['true',undefined,0]) assert.throws(()=>parseBookingOptions({...good,faceRecordingConsent:value}))
  assert.deepEqual(parseBookingOptions(good),good)
})

test('checkout charges the package deposit and its snapshot feeds the public receipt', async () => {
  let checkout
  const booking = load('@/lib/booking')
  const date = booking.generateCandidateSlots().at(-29).date
  const reference = 'RJG-2345-ABCD'
  const external = {
    '@/lib/rate-limit': {checkRateLimit:async()=>({allowed:true})},
    '@/lib/turnstile': {verifyTurnstile:async()=>{},TurnstileVerificationError:class extends Error{}},
    '@/lib/google-calendar': {
      listAvailableSlots:async slots=>slots,
      acquireSlot:async()=>{},attachCheckoutSession:async()=>{},expireHold:async()=>{},
      SlotUnavailableError:class extends Error{},
      findConfirmedBookingByReference:async()=>({stripeSessionId:'cs_mock',eventId:checkout.metadata.booking_event_id,slotStart:checkout.metadata.slot_start,slotEnd:checkout.metadata.slot_end}),
    },
    '@/lib/stripe': {getStripe:()=>({checkout:{sessions:{
      create:async input=>{checkout=input;return{id:'cs_mock',url:'https://example.com/mock-checkout'}},
      retrieve:async()=>({metadata:{...checkout.metadata,booking_reference:reference},currency:'jpy',amount_total:checkout.line_items[0].price_data.unit_amount,payment_status:'paid',customer_email:'guest@example.com'}),
    }}})},
  }
  const run=loader(external)
  for(const [hours,baseTotal] of [[4,14960],[8,25520],[14,41360]]) {
    const packageIds = []
    const extras = 0
    const total = baseTotal
    const response=await run('@/app/api/checkout/route').POST(new Request('http://localhost/api/checkout',{
      method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},
      body:JSON.stringify({packageIds,date,startTime:'09:00',endTime:`${9+hours}:00`,peopleCount:1,faceRecordingConsent:false,name:'Guest',email:'guest@example.com',title:'Explore Tokyo',location:'Shibuya',socialPlatform:'instagram',socialHandle:'guest',depositTermsAccepted:true,transportationTermsAccepted:true}),
    }))
    assert.equal(response.status,200,JSON.stringify(await response.json()))
    assert.equal(checkout.line_items[0].price_data.unit_amount,total / 2)
    assert.equal(checkout.metadata.rate_jpy_per_30_minutes,undefined)
    assert.ok(checkout.custom_text.submit.message.length<=1200)
    const receipt=await run('@/lib/booking-receipt').getPublicBookingReceipt(reference)
    assert.equal(receipt.serviceTotalJpy,total)
    assert.equal(receipt.transportFeeJpy,4000)
    assert.equal(receipt.balanceDueJpy,total / 2)
    assert.equal(receipt.packagesTotalJpy,extras)
    assert.deepEqual(receipt.packageIds,packageIds)
  }
})


test('retired packages cannot be purchased, regardless of group or video choice', () => {
 for (const peopleCount of [1,4]) for (const faceRecordingConsent of [true,false]) {
  for (const id of ['counter-sushi','custom-kimono','ghibli-museum','unknown']) {
   assert.throws(()=>getBookingPricing(840,{peopleCount,faceRecordingConsent,packageIds:[id]}), /Choose packages available/)
  }
 }
 assert.throws(()=>parseBookingOptions({peopleCount:1,faceRecordingConsent:true,packageIds:['ghibli-museum','ghibli-museum']}))
})
