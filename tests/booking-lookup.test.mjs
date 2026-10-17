import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'

function harness({ email='guest@example.com', card={}, cancelled=false, state='confirmed', refunded=false, pages=1 }={}) {
 const calls=[]
 const load=loader({
  '@/lib/stripe':{getStripe:()=>({charges:{search:async params=>{calls.push(['search',params]);return {data:[{paid:true,currency:'jpy',payment_method_details:{card:{last4:'1234',exp_month:9,exp_year:2025,...card}},payment_intent:'pi_test',amount:10000,amount_refunded:refunded?10000:0,refunded}],has_more:calls.filter(c=>c[0]==='search').length<pages,next_page:'next'}}},checkout:{sessions:{list:async()=>{calls.push(['session']);return {data:[{id:'cs_test',payment_status:'paid',currency:'jpy',amount_total:10000,customer_email:email,metadata:{booking_event_id:'event',booking_reference:'RJG-2345-ABCD',slot_start:'2026-10-17T10:00:00+09:00',slot_end:'2026-10-17T12:00:00+09:00'}}]}}}}})},
  '@/lib/google-calendar':{getLookupBooking:async()=>{calls.push(['calendar']);return {state,slotStart:'2026-10-18T10:00:00+09:00',slotEnd:'2026-10-18T12:00:00+09:00',location:'Tokyo Station'}}},
  '@/lib/cancellation-store':{bookingWasCancelled:async()=>cancelled},
  '@/lib/booking-policy':{bookingPricingFromMetadata:()=>({serviceTotalJpy:20000}),cancellationPolicyFromMetadata:()=>({})},
  '@/lib/booking':{bookingTransportBufferMinutes:()=>60},
 })
 const module=load('@/lib/booking-lookup')
 return {...module,calls,run:()=>module.lookupBookings(module.parseLookupInput({email:' Guest@Example.com ',last4:'1234',expiry:'09/25'}))}
}
test('validates input strictly and allows historical expired cards',()=>{
 const h=harness()
 assert.equal(h.parseLookupInput({email:' Guest@Example.com ',last4:'0001',expiry:'09/25'}).email,'guest@example.com')
 for(const input of [null,{}, {email:'guest@example.com',last4:"1234' OR",expiry:'09/25'}, {email:'guest@example.com',last4:'1234',expiry:'13/25'}]) assert.throws(()=>h.parseLookupInput(input),h.LookupInputError)
})
test('requires exact Checkout email and all card fields before Calendar access',async()=>{
 for(const options of [{email:'other@example.com'},{card:{last4:'5678'}},{card:{exp_month:10}},{card:{exp_year:2026}}]) {
  const h=harness(options);assert.deepEqual(await h.run(),[]);assert.ok(!h.calls.some(c=>c[0]==='calendar'))
 }
})
test('guest bookings use current Calendar dates and location; paginated matches are deduplicated',async()=>{
 const h=harness({pages:2});const result=await h.run()
 assert.equal(result.length,1);assert.equal(result[0].slotStart,'2026-10-18T10:00:00+09:00');assert.equal(result[0].location,'Tokyo Station');assert.ok(result[0].receipt)
 assert.equal(h.calls.filter(c=>c[0]==='search').length,2)
})
test('cancelled and refunded bookings never show a confirmed receipt',async()=>{
 for(const options of [{cancelled:true},{state:'cancelled'},{refunded:true}]) {const result=await harness(options).run();assert.equal(result[0].receipt,undefined);assert.notEqual(result[0].status,'confirmed')}
})
test('search cap fails explicitly instead of returning incomplete results',async()=>{
 await assert.rejects(harness({pages:11}).run(),/limit reached/)
})
test('route rejects cross-origin, rate-limited, and unverified requests before lookup',async()=>{
 for(const scenario of ['origin','rate','token','success']) {
  const calls=[]
  class VerificationError extends Error {}
  const load=loader({
   '@/lib/rate-limit':{checkRateLimit:async()=>({allowed:scenario!=='rate'}),rateLimitedResponse:()=>Response.json({}, {status:429})},
   '@/lib/turnstile':{TurnstileVerificationError:VerificationError,verifyTurnstile:async()=>{calls.push('verify');if(scenario==='token') throw new VerificationError('Invalid token')}},
   '@/lib/booking-lookup':{LookupInputError:class extends Error {},parseLookupInput:x=>x,lookupBookings:async()=>{calls.push('lookup');return []}},
  })
  const response=await load('@/app/api/lookup/route').POST(new Request('https://example.com/api/lookup',{method:'POST',headers:{origin:scenario==='origin'?'https://other.com':'https://example.com'},body:JSON.stringify({email:'guest@example.com'})}))
  assert.equal(response.status,{origin:403,rate:429,token:400,success:200}[scenario])
  assert.equal(calls.includes('lookup'),scenario==='success')
  if(scenario==='success') assert.match(response.headers.get('cache-control'),/no-store/)
 }
})
