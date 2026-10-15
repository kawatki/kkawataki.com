import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loader } from './module-loader.mjs'
const load=loader({})
const { CANCELLATION_POLICY, cancellationRefund, cancellationPolicyFromMetadata }=load('@/lib/booking-policy')
const { experiencePrice }=load('@/lib/experience-plans')
const now=Date.UTC(2026,0,1), day=86400000
const policy=cancellationPolicyFromMetadata({cancellation_policy_version:CANCELLATION_POLICY.version})
const refund=(notice,elapsed,approved=false,started=false)=>cancellationRefund(20000,new Date(now+notice).toISOString(),policy,now,{paidAt:now-elapsed,shortNoticeApproved:approved,arrangementsStarted:started})
test('new bookings collect 100 percent of the tax-inclusive total',()=>{
 const p=experiencePrice(240,{peopleCount:1,faceRecordingConsent:true})
 assert.equal(p.depositPercent,100)
 assert.equal(p.depositAmountJpy,p.serviceTotalJpy)
 assert.equal(p.balanceDueJpy,0)
})
test('normal refund uses both payment age and start time boundaries',()=>{
 assert.equal(refund(7*day,7*day).percent,90)
 assert.equal(refund(7*day,7*day+1).percent,50)
 assert.equal(refund(7*day-1,1000).percent,0)
 assert.equal(refund(100*day,8*day).amountJpy,15000)
})
test('short-notice correction requires approval, time, and no work started',()=>{
 assert.equal(refund(day,3600000,true).percent,90)
 assert.equal(refund(day,3600001,true).percent,0)
 assert.equal(refund(day,1000,true,true).percent,0)
 assert.equal(refund(day,1000,false).percent,0)
 assert.throws(()=>refund(0,1000,true),/no longer/)
 assert.throws(()=>cancellationRefund(20000,new Date(now+day).toISOString(),policy,now),/Payment time/)
})
test('previous six-tier snapshots are preserved',()=>{
 const tiers=[{days:90,percent:90},{days:30,percent:75},{days:14,percent:50},{days:7,percent:25},{days:1,percent:5},{days:0,percent:0}]
 const old=cancellationPolicyFromMetadata({cancellation_policy_version:'2026-10-14-v3',cancellation_tiers:JSON.stringify(tiers)})
 assert.equal(cancellationRefund(40000,new Date(now+7*day).toISOString(),old,now).percent,25)
})

test('75 percent tier starts exactly 30 days before service, after grace window',()=>{
 assert.equal(refund(30*day,8*day).percent,75)
 assert.equal(refund(30*day-1,8*day).percent,50)
 assert.equal(refund(30*day,7*day).percent,90)
 const old=cancellationPolicyFromMetadata({cancellation_policy_version:'2026-10-14-v4'})
 assert.equal(cancellationRefund(20000,new Date(now+30*day).toISOString(),old,now,{paidAt:now-8*day,shortNoticeApproved:false,arrangementsStarted:false}).percent,50)
})
