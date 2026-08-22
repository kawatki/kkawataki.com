import {
  createCustomRequestReference,
  CUSTOM_REQUEST_TERMS_VERSION,
  parseCustomRequestPayment,
} from "@/lib/custom-request"
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit"
import { ConfigurationError } from "@/lib/server-config"
import { getStripe } from "@/lib/stripe"
import {
  TurnstileVerificationError,
  verifyTurnstile,
} from "@/lib/turnstile"
import type Stripe from "stripe"

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

function shortDescription(value: string) {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request.headers, {
    bucket: "request-payment",
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

    const customRequest = parseCustomRequestPayment(input)
    const requestReference = createCustomRequestReference()
    const stripe = getStripe()
    const origin = new URL(request.url).origin

    const successUrl = new URL("/request/success/", origin)
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}")
    successUrl.searchParams.set("reference", requestReference)
    const contactMetadata: Stripe.MetadataParam = {}
    if (
      customRequest.socialPlatform !== "none" &&
      customRequest.socialHandle
    ) {
      contactMetadata.social_handle = customRequest.socialHandle
      contactMetadata.social_platform = customRequest.socialPlatform
    }

    const session = await stripe.checkout.sessions.create({
      cancel_url: `${origin}/request/?payment=cancelled`,
      customer_email: customRequest.email,
      custom_text: {
        submit: {
          message:
            "This is a custom payment arranged directly with Taki. It does not create a calendar booking by itself.",
        },
      },
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              description: shortDescription(customRequest.requestTitle),
              name: `Rental Japanese Guy custom request · ${requestReference}`,
            },
            unit_amount: customRequest.amountJpy,
          },
          quantity: 1,
        },
      ],
      metadata: {
        amount_jpy: String(customRequest.amountJpy),
        custom_request_terms_accepted: "true",
        custom_request_terms_version: CUSTOM_REQUEST_TERMS_VERSION,
        customer_name: customRequest.name,
        request_notes: customRequest.notes,
        request_reference: requestReference,
        request_title: customRequest.requestTitle,
        ...contactMetadata,
      },
      mode: "payment",
      payment_intent_data: {
        description: `${requestReference} - ${shortDescription(
          customRequest.requestTitle
        )}`,
        metadata: {
          custom_request: "true",
          request_reference: requestReference,
          request_title: customRequest.requestTitle,
          ...contactMetadata,
        },
        receipt_email: customRequest.email,
      },
      payment_method_types: ["card"],
      success_url: successUrl.toString(),
    })

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.")
    }

    return Response.json({ url: session.url })
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message)
      return Response.json(
        { error: "Online payment is being configured. Please check back soon." },
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

    console.error("Custom request checkout creation failed", error)
    return Response.json(
      { error: "Checkout could not be started. Your card was not charged." },
      { status: 500 }
    )
  }
}
