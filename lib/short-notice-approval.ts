import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { requiredEnv } from "@/lib/server-config"

export function verifyShortNoticeApproval(token: unknown, booking: { date: string; startTime: string; endTime: string; email: string }) {
  try {
    if (typeof token !== "string" || token.length > 2000) return false
    const [body, signature, extra] = token.split(".")
    if (!body || !signature || extra) return false
    const expected = createHmac("sha256", requiredEnv("STRIPE_WEBHOOK_SECRET")).update(`short-notice:${body}`).digest()
    const received = Buffer.from(signature, "base64url")
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false
    const data = JSON.parse(Buffer.from(body, "base64url").toString())
    return Number.isFinite(data.expires) && data.expires > Date.now() && data.date === booking.date && data.startTime === booking.startTime && data.endTime === booking.endTime && data.email === booking.email.trim().toLowerCase()
  } catch { return false }
}
