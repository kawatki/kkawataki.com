import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'
const load=loader({})
const {getBookingPricing}=load('@/lib/booking')
const {bookingPriceMultiplier,parseBookingOptions}=load('@/lib/booking-options')
const {bookingPricingFromMetadata}=load('@/lib/booking-policy')
test('all group sizes and recording choices produce matching checkout and refund snapshots',()=>{
 const base=getBookingPricing(120)
 for(let peopleCount=1;peopleCount<=6;peopleCount++) for(const surroundingsRecordingConsent of [false,true]) for(const faceRecordingConsent of [false,true]) {
  const options={peopleCount,surroundingsRecordingConsent,faceRecordingConsent}
  const multiplier=(peopleCount<=3?1:2)*(surroundingsRecordingConsent?1:1.2)
  assert.equal(bookingPriceMultiplier(peopleCount,surroundingsRecordingConsent),multiplier)
  const p=getBookingPricing(120,options)
  assert.equal(p.serviceTotalJpy,base.serviceTotalJpy*multiplier)
  assert.equal(p.depositAmountJpy,Math.ceil(p.serviceTotalJpy*.25))
  assert.equal(p.depositAmountJpy+p.balanceDueJpy,p.serviceTotalJpy)
  const metadata={booking_duration_minutes:'120',rate_jpy_per_30_minutes:String(p.rateJpyPer30Minutes),service_total_jpy:String(p.serviceTotalJpy),deposit_amount_jpy:String(p.depositAmountJpy),deposit_percent:String(p.depositPercent)}
  assert.equal(bookingPricingFromMetadata(metadata,p.depositAmountJpy,'jpy').serviceTotalJpy,p.serviceTotalJpy)
 }
})
test('server rejects invalid group sizes and missing or nonboolean recording choices',()=>{
 const good={peopleCount:1,faceRecordingConsent:false,surroundingsRecordingConsent:true}
 for(const peopleCount of [0,7,-1,1.5,NaN,Infinity,'3',undefined]) assert.throws(()=>parseBookingOptions({...good,peopleCount}))
 for(const field of ['faceRecordingConsent','surroundingsRecordingConsent']) for(const value of ['true',undefined,0]) assert.throws(()=>parseBookingOptions({...good,[field]:value}))
 assert.deepEqual(parseBookingOptions(good),good)
})
