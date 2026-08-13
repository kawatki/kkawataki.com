import { deleteHoldByCancelToken } from "@/lib/google-calendar"
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit"
import { ConfigurationError } from "@/lib/server-config"

function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) {
    return false
  }
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request.headers, {
    bucket: "checkout-cancel",
    limit: 20,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit)
  }

  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Invalid cancellation request." }, { status: 403 })
  }

  try {
    const input = await request.json()
    const eventId = cleanString(
      input && typeof input === "object" && "bookingEventId" in input
        ? input.bookingEventId
        : ""
    )
    const cancelToken = cleanString(
      input && typeof input === "object" && "cancelToken" in input
        ? input.cancelToken
        : ""
    )

    if (!eventId || !cancelToken) {
      return Response.json({ error: "Invalid cancellation request." }, { status: 400 })
    }

    const released = await deleteHoldByCancelToken(eventId, cancelToken)
    return Response.json({ ok: true, released })
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message)
      return Response.json(
        { error: "Online booking is being configured. Please check back soon." },
        { status: 503 }
      )
    }

    console.error("Checkout cancellation cleanup failed", error)
    return Response.json(
      { error: "Cancellation cleanup failed. Please refresh availability." },
      { status: 500 }
    )
  }
}
