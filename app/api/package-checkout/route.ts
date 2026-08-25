import {
  createPackageReference,
  formatYen,
  parsePackageCheckout,
} from "@/lib/packages"
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
    bucket: "package-checkout",
    limit: 20,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit)
  }

  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Invalid package checkout." }, { status: 403 })
  }

  try {
    const input = await request.json()
    const turnstileToken =
      input && typeof input === "object" && "turnstileToken" in input
        ? input.turnstileToken
        : undefined
    await verifyTurnstile(turnstileToken, request)

    const checkout = parsePackageCheckout(input)
    const packageReference = createPackageReference()
    const stripe = getStripe()
    const origin = new URL(request.url).origin
    const packageSummary = checkout.lines
      .map((line) => `${line.item.shortTitle} x ${line.quantity}`)
      .join(", ")

    const session = await stripe.checkout.sessions.create({
      cancel_url: `${origin}/packages/?payment=cancelled`,
      customer_email: checkout.email,
      custom_text: {
        submit: {
          message:
            "Package dates, restaurant availability, and meeting details are confirmed by message after payment. If the package cannot be arranged, you will receive alternatives or a refund.",
        },
      },
      line_items: checkout.lines.map((line) => ({
        price_data: {
          currency: "jpy",
          product_data: {
            description: shortDescription(
              `${line.item.durationHours}h package, max ${line.item.maxPeople} guests`
            ),
            name: `${line.item.title} · ${packageReference}`,
          },
          unit_amount: line.item.pricePerPerson,
        },
        quantity: line.quantity,
      })),
      metadata: {
        customer_name: checkout.name,
        package_checkout: "true",
        package_reference: packageReference,
        package_summary: packageSummary,
        package_total_jpy: String(checkout.totalJpy),
        package_notes: checkout.notes,
        preferred_date: checkout.preferredDate,
        social_handle: checkout.socialHandle,
        social_platform: checkout.socialPlatform,
        terms_accepted: "true",
      },
      mode: "payment",
      payment_intent_data: {
        description: `${packageReference} - ${shortDescription(packageSummary)} - ${formatYen(checkout.totalJpy)}`,
        metadata: {
          package_checkout: "true",
          package_reference: packageReference,
          package_summary: packageSummary,
        },
        receipt_email: checkout.email,
      },
      payment_method_types: ["card"],
      success_url: `${origin}/packages/success/?session_id={CHECKOUT_SESSION_ID}`,
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
        error.message.startsWith("Choose") ||
        error.message.startsWith("Add") ||
        error.message.startsWith("Please"))
    ) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    console.error("Package checkout creation failed", error)
    return Response.json(
      { error: "Checkout could not be started. Your card was not charged." },
      { status: 500 }
    )
  }
}
