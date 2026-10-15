// Run only after reviewing the request. Keep the signed link private.
import { createHmac } from 'node:crypto'
import { loadEnvFile } from 'node:process'
loadEnvFile('.env.local')
const [email,date,startTime,endTime] = process.argv.slice(2)
if (!email || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^\d{2}:\d{2}$/.test(startTime ?? '') || !/^\d{2}:\d{2}$/.test(endTime ?? '')) throw new Error('Usage: node scripts/approve-short-notice.mjs email YYYY-MM-DD HH:MM HH:MM')
if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is required')
const body=Buffer.from(JSON.stringify({email:email.trim().toLowerCase(),date,startTime,endTime,expires:Date.now()+24*3600000})).toString('base64url')
const signature=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(`short-notice:${body}`).digest('base64url')
console.log(`http://127.0.0.1:3000/booking?approval=${body}.${signature}`)
