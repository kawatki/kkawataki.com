import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'

function harness({ email='guest@example.com', card={}, cancelled=false, state='confirmed', refunded=false, pages=1, recent=false, recentPages=1, recentError=false, missingCalendar=false }={}) {
 const calls=[]
 const charge = {id:'ch_test',paid:true,currency:'jpy',payment_method_details:{card:{last4:'1234',exp_month:9,exp_year:2025,...card}},payment_intent:'pi_test',amount:10000,amount_refunded:refunded?10000:0,refunded}
 const load=loader({
  '@/lib/stripe':{getStripe:()=>({charges:{list:async params=>{calls.push(['list',params]);if(recentError) throw new Error('Stripe unavailable');return {data:recent?[charge]:[],has_more:calls.filter(c=>c[0]==='list').length<recentPages}},search:async params=>{calls.push(['search',params]);return {data:recent?[]:[charge],has_more:calls.filter(c=>c[0]==='search').length<pages,next_page:'next'}}},checkout:{sessions:{list:async()=>{calls.push(['session']);return {data:[{id:'cs_test',payment_status:'paid',currency:'jpy',amount_total:10000,customer_email:email,metadata:{booking_event_id:'event',booking_reference:'RJG-2345-ABCD',slot_start:'2026-10-17T10:00:00+09:00',slot_end:'2026-10-17T12:00:00+09:00'}}]}}}}})},
  '@/lib/google-calendar':{getLookupBooking:async()=>{calls.push(['calendar']);return missingCalendar ? null : {state,slotStart:'2026-10-18T10:00:00+09:00',slotEnd:'2026-10-18T12:00:00+09:00',location:'Tokyo Station'}}},
  '@/lib/cancellation-store':{bookingWasCancelled:async()=>cancelled},
  '@/lib/booking-policy':{bookingPricingFromMetadata:()=>({serviceTotalJpy:20000}),cancellationPolicyFromMetadata:()=>({})},
  '@/lib/booking':{bookingTransportBufferMinutes:()=>60},
 })
 const loadedModule=load('@/lib/booking-lookup')
 return {...loadedModule,calls,run:()=>loadedModule.lookupBookings(loadedModule.parseLookupInput({email:' Guest@Example.com ',last4:'1234',expiry:'09/25'}))}
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

test('recent payments are found before Stripe Search indexes them', async()=>{
 const h=harness({recent:true,recentPages:2});const results=await h.run()
 assert.equal(results.length,1)
 assert.equal(results[0].status,'confirmed')
 const lists=h.calls.filter(c=>c[0]==='list')
 assert.equal(lists.length,2)
 assert.equal(lists[1][1].starting_after,'ch_test')
 const cutoff=lists[0][1].created.gte
 assert.match(h.calls.find(c=>c[0]==='search')[1].query,new RegExp(`created<${cutoff}$`))
})
test('recent-payment retrieval preserves all identity checks',async()=>{
 for(const options of [{email:'other@example.com'},{card:{last4:'5678'}},{card:{exp_month:10}},{card:{exp_year:2026}}]) {
  const h=harness({...options,recent:true});assert.deepEqual(await h.run(),[]);assert.ok(!h.calls.some(c=>c[0]==='calendar'))
 }
})
test('recent provider failures and pagination limits cannot become false not-found responses',async()=>{
 await assert.rejects(harness({recent:true,recentError:true}).run(),/unavailable/)
 await assert.rejects(harness({recent:true,recentPages:11}).run(),/limit reached/)
})

test('missing Calendar data never falls back to Stripe’s original schedule',async()=>{
 const result=await harness({recent:true,missingCalendar:true}).run()
 assert.equal(result.length,1)
 assert.equal(result[0].slotStart,null)
 assert.equal(result[0].slotEnd,null)
 assert.equal(result[0].receipt,undefined)
})

test('confirmation receipt uses the rescheduled Calendar time and never Stripe dates',async()=>{
 for(const calendar of [{state:'confirmed',slotStart:'2026-12-01T11:00:00+09:00',slotEnd:'2026-12-01T19:00:00+09:00'},null]) {
  const load=loader({
   '@/lib/stripe':{getStripe:()=>({checkout:{sessions:{retrieve:async()=>({id:'cs_test',payment_status:'paid',currency:'jpy',amount_total:10000,metadata:{booking_event_id:'event',booking_reference:'RJG-2345-ABCD',slot_start:'2026-10-01T09:00:00+09:00',slot_end:'2026-10-01T17:00:00+09:00'}})}}})},
   '@/lib/google-calendar':{getLookupBooking:async()=>calendar},
   '@/lib/cancellation-store':{bookingWasCancelled:async()=>false},
   '@/lib/booking-policy':{bookingPricingFromMetadata:()=>({serviceTotalJpy:10000}),cancellationPolicyFromMetadata:()=>({})},
   '@/lib/booking':{bookingTransportBufferMinutes:()=>60},
   '@/lib/rate-limit':{checkRateLimit:async()=>({allowed:true})},
  })
  const response=await load('@/app/api/booking-status/route').GET(new Request('https://example.com/api/booking-status?session_id=cs_test'))
  const result=await response.json()
  if(calendar) {assert.equal(result.receipt.slotStart,calendar.slotStart);assert.equal(result.receipt.slotEnd,calendar.slotEnd)}
  else assert.equal(result.receipt,undefined)
 }
})
