import { LookupInputError, lookupBookings, parseLookupInput } from "@/lib/booking-lookup"
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit"
import { TurnstileVerificationError, verifyTurnstile } from "@/lib/turnstile"

export async function POST(request: Request) {
  const headers = { "cache-control": "private, no-store, max-age=0" }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid lookup request." }, { status: 403, headers })
  }
  try {
    const limit = await checkRateLimit(request.headers, { bucket: "booking-lookup", limit: 5, windowSeconds: 900 })
    if (!limit.allowed) return rateLimitedResponse(limit)
    const body = await request.text()
    if (body.length > 5000) return Response.json({ error: "Invalid request." }, { status: 413, headers })
    const input = JSON.parse(body)
    const parsed = parseLookupInput(input)
    await verifyTurnstile(input.turnstileToken, request, "lookup")
    // Also limit distributed guessing against the same email, using a hashed bucket key.
    const accountLimit = await checkRateLimit(new Headers(), { bucket: `booking-lookup-email:${parsed.email}`, limit: 10, windowSeconds: 3600 })
    if (!accountLimit.allowed) return rateLimitedResponse(accountLimit)
    return Response.json({ bookings: await lookupBookings(parsed) }, { headers })
  } catch (error) {
    if (error instanceof TurnstileVerificationError) return Response.json({ error: error.message }, { status: error.unavailable ? 503 : 400, headers })
    if (error instanceof LookupInputError || error instanceof SyntaxError) return Response.json({ error: error instanceof LookupInputError ? error.message : "Invalid request." }, { status: 400, headers })
    // Do not log provider errors: they can contain card search parameters or customer data.
    return Response.json({ error: "Booking lookup is temporarily unavailable. Please try again later." }, { status: 503, headers })
  }
}
