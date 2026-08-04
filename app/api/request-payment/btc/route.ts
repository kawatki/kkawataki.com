import {
  createCustomRequestReference,
  getBtcPaymentConfig,
  parseBtcCustomRequestPayment,
} from "@/lib/custom-request"
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit"
import { createBtcCustomRequestTodo } from "@/lib/google-calendar"
import { ConfigurationError } from "@/lib/server-config"
import {
  TurnstileVerificationError,
  verifyTurnstile,
} from "@/lib/turnstile"

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

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request.headers, {
    bucket: "btc-request-payment",
    limit: 20,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit)
  }

  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Invalid payment request." }, { status: 403 })
  }

  try {
    const input = await request.json()
    const turnstileToken =
      input && typeof input === "object" && "turnstileToken" in input
        ? input.turnstileToken
        : undefined
    await verifyTurnstile(turnstileToken, request)

    const btc = getBtcPaymentConfig()
    if (!btc.address) {
      throw new ConfigurationError("BTC_RECEIVING_ADDRESS")
    }
    const customRequest = parseBtcCustomRequestPayment(
      input,
      btc.minAmountBtc
    )

    const requestReference = createCustomRequestReference()
    await createBtcCustomRequestTodo({
      btc,
      request: customRequest,
      requestReference,
    })

    return Response.json({
      amountBtc: customRequest.amountBtc,
      address: btc.address,
      confirmationsRequired: btc.confirmationsRequired,
      minAmountBtc: btc.minAmountBtc,
      network: btc.network,
      reference: requestReference,
      refundPolicy: btc.refundPolicy,
    })
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message)
      return Response.json(
        { error: "BTC payment is being configured. Please check back soon." },
        { status: 503 }
      )
    }
    if (error instanceof TurnstileVerificationError) {
      return Response.json(
        { error: error.message },
        { status: error.unavailable ? 503 : 400 }
      )
    }
    if (
      error instanceof Error &&
      (error.message.startsWith("Enter") ||
        error.message.startsWith("Briefly") ||
        error.message.startsWith("Please"))
    ) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    console.error("BTC custom request creation failed", error)
    return Response.json(
      { error: "BTC payment instructions could not be created." },
      { status: 500 }
    )
  }
}
