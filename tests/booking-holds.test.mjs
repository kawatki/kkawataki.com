import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { loader } from './module-loader.mjs'
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const now = () => Math.floor(Date.now()/1000)
const slot = { id:'rjgtestslot', start:'2026-10-15T16:00:00+09:00', end:'2026-10-15T23:00:00+09:00', durationMinutes:420,date:'2026-10-15',label:'Test' }
function heldEvent(overrides={}) {
 return { id:slot.id,etag:'v1',status:'tentative',transparency:'transparent',start:{dateTime:slot.start},end:{dateTime:slot.end},extendedProperties:{private:{bookingState:'hold',stripeSessionId:'cs_test',holdExpiresAt:String(now()+600)}},...overrides }
}
function calendarHarness(initial=[]) {
 const events=new Map(initial.map(event=>[event.id,structuredClone(event)]))
 const mutations=[]
 let confirmDuringCleanup=false
 const mockFetch=async (input, options={}) => {
  const url=new URL(input)
  if(url.hostname==='oauth2.googleapis.com') return Response.json({access_token:'fake-token'})
  const method=options.method || 'GET'
  const id=url.pathname.split('/events/')[1]
  if(method==='GET') return id ? events.has(id) ? Response.json(events.get(id)) : new Response(null,{status:404}) : Response.json({items:[...events.values()]})
  const body=options.body ? JSON.parse(options.body) : null
  if(confirmDuringCleanup && method==='PATCH' && body.status==='cancelled') {
   const event=events.get(id); event.etag='new-paid'; event.extendedProperties.private.bookingState='confirmed'; event.transparency='opaque'
   confirmDuringCleanup=false
  }
  if(options.headers?.['if-match'] && options.headers['if-match']!==events.get(id)?.etag) return new Response('Changed',{status:412})
  mutations.push({id,method,body})
  if(method==='POST') { events.set(body.id,{...body,etag:'v1'}); return Response.json(events.get(body.id)) }
  const event={...events.get(id),...body,etag:'v'+(mutations.length+1)}
  events.set(id,event)
  return Response.json(event)
 }
 const load=loader({__fetch:mockFetch,'@/lib/server-config':{requiredEnv:name=> name==='GOOGLE_PRIVATE_KEY'?privateKey:'test@example.com'}})
 return { api:load('@/lib/google-calendar'),load,events,mutations,set confirmDuringCleanup(value){confirmDuringCleanup=value} }
}
const paidInput={eventId:slot.id,sessionId:'cs_test',paidAt:now(),durationHours:7,email:'guest@example.com',name:'Guest',title:'Walk',location:'',notes:'',alternateContact:'',socialPlatform:'none',socialHandle:'',depositAmountJpy:3500,depositPercent:25,balanceDueJpy:10500,rateJpyPer30Minutes:1000,serviceTotalJpy:14000}

test('hold duration stays exactly ten minutes',()=>{assert.equal(loader({})('@/lib/booking').CHECKOUT_HOLD_MINUTES,10)})
test('new calendar placeholders are tentative/free, have no reminders, but reserve website availability',async()=>{
 const h=calendarHarness()
 await h.api.acquireSlot(slot,{email:'guest@example.com',name:'Guest'},now()+600,'hold','cancel','RJG-2345-ABCD')
 const event=h.events.get(slot.id)
 assert.equal(event.status,'tentative'); assert.equal(event.transparency,'transparent'); assert.deepEqual(event.reminders,{useDefault:false})
 assert.match(event.description,/NOT A CONFIRMED BOOKING/)
 assert.equal((await h.api.listAvailableSlots([slot])).length,0)
})
test('expiry releases availability and retires the calendar hold on the next request',async()=>{
 const event=heldEvent();event.extendedProperties.private.holdExpiresAt=String(now())
 const h=calendarHarness([event]);assert.equal((await h.api.listAvailableSlots([slot])).length,1)
 assert.equal(h.events.get(slot.id).status,'cancelled')
})
test('expired and conflict records do not block slots',async()=>{
 for(const state of ['expired','conflict','cancelled']) {
  const event=heldEvent();event.extendedProperties.private.bookingState=state
  assert.equal((await calendarHarness([event]).api.listAvailableSlots([slot])).length,1)
 }
})
test('cleanup cannot remove a hold that became a confirmed booking after listing',async()=>{
 const event=heldEvent();event.extendedProperties.private.holdExpiresAt=String(now()-1)
 const h=calendarHarness([event]);h.confirmDuringCleanup=true
 const result=await h.api.deleteExpiredBookingHolds()
 assert.equal(result.deleted,0);assert.equal(h.events.get(slot.id).extendedProperties.private.bookingState,'confirmed')
})
test('availability rechecks an expired hold if a concurrent confirmation won',async()=>{
 const event=heldEvent();event.extendedProperties.private.holdExpiresAt=String(now()-1)
 const h=calendarHarness([event]);h.confirmDuringCleanup=true
 assert.equal((await h.api.listAvailableSlots([slot])).length,0)
})
test('old failed session cannot remove a reused or confirmed booking',async()=>{
 const event=heldEvent();event.extendedProperties.private.stripeSessionId='cs_new'
 const h=calendarHarness([event]);assert.equal(await h.api.deleteHoldByStripeSession(slot.id,'cs_old'),false)
 event.extendedProperties.private.bookingState='confirmed'
 const confirmed=calendarHarness([event]);assert.equal(await confirmed.api.deleteHoldByStripeSession(slot.id,'cs_new'),false)
 assert.equal(confirmed.mutations.length,0)
})
test('missing or retired hold returns a conflict for the existing full-refund path',async()=>{
 assert.deepEqual(await calendarHarness().api.confirmPaidBooking(paidInput),{conflict:true})
 const event=heldEvent({status:'cancelled'});event.extendedProperties.private.bookingState='expired'
 assert.deepEqual(await calendarHarness([event]).api.confirmPaidBooking(paidInput),{conflict:true})
})
test('successful payment within deadline turns a hold into an opaque confirmed booking',async()=>{
 const h=calendarHarness([heldEvent()]);assert.deepEqual(await h.api.confirmPaidBooking(paidInput),{confirmed:true})
 const result=h.events.get(slot.id);assert.equal(result.extendedProperties.private.bookingState,'confirmed');assert.equal(result.transparency,'opaque')
})
test('a payment at the ten-minute deadline cannot confirm a booking',async()=>{
 const event=heldEvent();event.extendedProperties.private.holdExpiresAt=String(paidInput.paidAt)
 assert.deepEqual(await calendarHarness([event]).api.confirmPaidBooking(paidInput),{conflict:true})
})
function webhookHarness({status='requires_payment_method',expireFails=false,unpaidCompleted=false}={}) {
 const calls=[]
 const intent={id:'pi_test',metadata:{booking_event_id:slot.id,booking_reference:'RJG-2345-ABCD'}}
 const session={id:'cs_test',metadata:intent.metadata,payment_status:'unpaid',status:'open'}
 const stripe={webhooks:{constructEventAsync:async()=>({type:unpaidCompleted?'checkout.session.completed':'payment_intent.payment_failed',data:{object:unpaidCompleted?session:intent}})},paymentIntents:{retrieve:async()=>({...intent,status})},checkout:{sessions:{
  list:async()=>({data:[session]}),retrieve:async()=>session,
  expire:async()=>{calls.push('expire');if(expireFails)throw Error('Concurrent payment');return {...session,status:'expired'}}
 }}}
 const load=loader({'@/lib/stripe':{getStripe:()=>stripe,getStripeCryptoProvider:()=>({})},'@/lib/server-config':{requiredEnv:()=> 'test'},'@/lib/google-calendar':{deleteHoldByStripeSession:async()=>{calls.push('release')},confirmPaidBooking:async()=>{calls.push('confirm')}},'@/lib/cancellation-store':{},'@/lib/google-tasks':{},'@/lib/google-commerce-tasks':{}})
 return {calls,post:()=>load('@/app/api/stripe/webhook/route').POST(new Request('https://example.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':'test'},body:'{}'}))}
}
test('failed payment expires its session before releasing its hold',async()=>{const h=webhookHarness();assert.equal((await h.post()).status,200);assert.deepEqual(h.calls,['expire','release'])})
test('delayed failure notification cannot release a successful retry',async()=>{const h=webhookHarness({status:'succeeded'});assert.equal((await h.post()).status,200);assert.deepEqual(h.calls,[])})
test('payment winning an expiration race preserves the hold',async()=>{const h=webhookHarness({expireFails:true});assert.equal((await h.post()).status,500);assert.deepEqual(h.calls,['expire'])})
test('unpaid completed event never makes a booking',async()=>{const h=webhookHarness({unpaidCompleted:true});assert.equal((await h.post()).status,200);assert.deepEqual(h.calls,[])})
