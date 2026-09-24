import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'

function harness({ allowed=true, success=true, action='cancellation', hostname='example.com' }={}) {
 const calls=[]
 const load=loader({
  '@/lib/server-config':{requiredEnv:()=> 'test-secret'},
  '@/lib/rate-limit':{checkRateLimit:async()=>({allowed}),rateLimitedResponse:()=>Response.json({error:'Too many requests'},{status:429})},
  '@/lib/booking-cancellation':{CancellationInputError:class extends Error {},parseCancellationInput:x=>x,previewCancellation:async()=>{calls.push('preview');return {}},confirmCancellation:async()=>{calls.push('confirm');return {}}},
  __fetch:async()=>{calls.push('verify');return Response.json({success,action,hostname})},
 })
 return {calls,post:(action='preview',token='test-token')=>load('@/app/api/cancel/route').POST(new Request('https://example.com/api/cancel',{method:'POST',headers:{origin:'https://example.com'},body:JSON.stringify({action,email:'guest@example.com',reference:'RJG-2345-ABCD',turnstileToken:token})}))}
}
test('cancellation preview and confirm require successful server verification',async()=>{
 for(const action of ['preview','confirm']) {const h=harness();assert.equal((await h.post(action)).status,200);assert.deepEqual(h.calls,['verify',action])}
})
test('missing, rejected, wrong-action and wrong-host tokens cannot access cancellation',async()=>{
 for(const options of [{success:false},{action:'checkout'},{hostname:'wrong.example'}]) {const h=harness(options);assert.equal((await h.post('confirm')).status,400);assert.deepEqual(h.calls,['verify'])}
 const h=harness();assert.equal((await h.post('preview','')).status,400);assert.deepEqual(h.calls,[])
})
test('rate limits apply before verification or booking access',async()=>{
 const h=harness({allowed:false});assert.equal((await h.post()).status,429);assert.deepEqual(h.calls,[])
})
