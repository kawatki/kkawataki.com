import { deleteExpiredBookingHolds } from "@/lib/google-calendar"
import { ConfigurationError, requiredEnv } from "@/lib/server-config"

function cronAuthorized(request: Request) {
  const secret = requiredEnv("CRON_SECRET")
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: Request) {
  try {
    if (!cronAuthorized(request)) {
      return Response.json({ error: "Unauthorized." }, { status: 401 })
    }

    const result = await deleteExpiredBookingHolds()
    return Response.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message)
      return Response.json(
        { error: "Cleanup is not configured." },
        { status: 503 }
      )
    }

    console.error("Booking hold cleanup failed", error)
    return Response.json(
      { error: "Booking hold cleanup failed." },
      { status: 500 }
    )
  }
}
