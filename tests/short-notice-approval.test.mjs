import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { loader } from './module-loader.mjs'
const { verifyShortNoticeApproval }=loader({'@/lib/server-config':{requiredEnv:()=> 'test-only-secret'}})('@/lib/short-notice-approval')
const booking={date:'2026-10-20',startTime:'09:00',endTime:'13:00',email:'guest@example.com'}
function sign(data) {
 const body=Buffer.from(JSON.stringify(data)).toString('base64url')
 return `${body}.${createHmac('sha256','test-only-secret').update(`short-notice:${body}`).digest('base64url')}`
}
test('approval binds customer, slot and expiry; forged tokens fail',()=>{
 const token=sign({...booking,expires:Date.now()+3600000})
 assert.equal(verifyShortNoticeApproval(token,booking),true)
 assert.equal(verifyShortNoticeApproval(token,{...booking,email:'other@example.com'}),false)
 assert.equal(verifyShortNoticeApproval(token,{...booking,startTime:'10:00'}),false)
 assert.equal(verifyShortNoticeApproval(token+'fake',booking),false)
 assert.equal(verifyShortNoticeApproval(sign({...booking,expires:Date.now()-1}),booking),false)
 assert.equal(verifyShortNoticeApproval(undefined,booking),false)
})
