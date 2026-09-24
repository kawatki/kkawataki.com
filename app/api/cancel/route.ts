import { CancellationInputError, confirmCancellation, parseCancellationInput, previewCancellation } from "@/lib/booking-cancellation"
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const headers = { "cache-control": "private, no-store" }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid cancellation request." }, { status: 403, headers })
  }
  try {
    const limit = await checkRateLimit(request.headers, { bucket: "booking-cancellation", limit: 10, windowSeconds: 600 })
    if (!limit.allowed) return rateLimitedResponse(limit)
    const body = await request.text()
    if (body.length > 5000) return Response.json({ error: "Invalid request." }, { status: 413, headers })
    const input = JSON.parse(body)
    const { email, reference } = parseCancellationInput(input)
    if (input.action !== "preview" && input.action !== "confirm") throw new CancellationInputError("Invalid cancellation action.")
    const result = input.action === "confirm"
      ? await confirmCancellation(email, reference, input.quote)
      : await previewCancellation(email, reference)
    return Response.json(result, { headers })
  } catch (error) {
    if (error instanceof CancellationInputError || error instanceof SyntaxError) {
      return Response.json({ error: error instanceof SyntaxError ? "Invalid request." : error.message }, { status: 400, headers })
    }
    console.error("Booking cancellation unavailable", error)
    return Response.json({ error: "Cancellation is temporarily unavailable. Please try again or contact me with your booking reference." }, { status: 503, headers })
  }
}
