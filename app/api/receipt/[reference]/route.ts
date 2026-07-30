import { getPublicBookingReceipt } from "@/lib/booking-receipt"
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit"

const responseHeaders = {
  "cache-control": "private, no-store, max-age=0",
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const rateLimit = await checkRateLimit(request.headers, {
    bucket: "receipt-api",
    limit: 30,
    windowSeconds: 5 * 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit)
  }

  try {
    const { reference } = await params
    const receipt = await getPublicBookingReceipt(reference)
    if (!receipt) {
      return Response.json(
        { error: "Booking receipt not found." },
        { headers: responseHeaders, status: 404 }
      )
    }
    return Response.json({ receipt }, { headers: responseHeaders })
  } catch (error) {
    console.error("Public receipt lookup failed", error)
    return Response.json(
      { error: "Booking receipt is temporarily unavailable." },
      { headers: responseHeaders, status: 503 }
    )
  }
}
