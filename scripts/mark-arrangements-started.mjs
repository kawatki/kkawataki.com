import { loadEnvFile } from 'node:process'
import Stripe from 'stripe'
loadEnvFile('.env.local')
const [sessionId] = process.argv.slice(2)
if (!sessionId?.startsWith('cs_')) throw new Error('Usage: node scripts/mark-arrangements-started.mjs cs_...')
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY)
const session=await stripe.checkout.sessions.retrieve(sessionId)
if (session.payment_status !== 'paid' || !['2026-10-14-v4', '2026-10-14-v5'].includes(session.metadata?.cancellation_policy_version)) throw new Error('Expected a paid booking under the current cancellation policy')
await stripe.checkout.sessions.update(sessionId,{metadata:{arrangements_started:'true',arrangements_started_at:String(Math.floor(Date.now()/1000))}})
console.log('Arrangements marked as started for this booking.')
