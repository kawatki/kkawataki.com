import {
  CHECKOUT_HOLD_MINUTES,
  DEPOSIT_TERMS_VERSION,
  getBookingPricing,
  parseBookingRequest,
  validateRequestedSlot,
} from "@/lib/booking"
import {
  acquireSlot,
  attachCheckoutSession,
  expireHold,
  SlotUnavailableError,
} from "@/lib/google-calendar"
import { ConfigurationError } from "@/lib/server-config"
import { getStripe } from "@/lib/stripe"

function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) {
    return false
  }
  return new URL(origin).host === new URL(request.url).host
}

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Invalid booking request." }, { status: 403 })
  }

  let slotId: string | undefined
  let holdToken: string | undefined

  try {
    const booking = parseBookingRequest(await request.json())
    const slot = validateRequestedSlot(
      booking.date,
      booking.startTime,
      booking.endTime
    )
    const pricing = getBookingPricing(slot.durationMinutes)
    slotId = slot.id
    holdToken = crypto.randomUUID()

    // Stripe requires Checkout Sessions to remain open for at least 30 minutes.
    // The extra minute prevents clock drift from making the request invalid.
    const expiresAt =
      Math.floor(Date.now() / 1_000) + CHECKOUT_HOLD_MINUTES * 60 + 60

    await acquireSlot(slot, booking, expiresAt, holdToken)

    const stripe = getStripe()
    const origin = new URL(request.url).origin
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${origin}/booking/?payment=cancelled`,
      customer_email: booking.email,
      custom_text: {
        submit: {
          message: `Service rate: ¥${pricing.rateJpyPer30Minutes.toLocaleString("en-US")} per 30 minutes (¥${pricing.serviceTotalJpy.toLocaleString("en-US")} for ${pricing.durationHours} hours). The 25% deposit of ¥${pricing.depositAmountJpy.toLocaleString("en-US")} is non-refundable if you cancel or do not attend, and is deducted from the final amount. You also cover transportation and any food or drinks during our time together.`,
        },
      },
      expires_at: expiresAt,
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              description: "Applied to the final amount paid in person.",
              name: "Rental Japanese Guy booking deposit",
            },
            unit_amount: pricing.depositAmountJpy,
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_event_id: slot.id,
        booking_notes: booking.notes,
        booking_title: booking.title,
        customer_name: booking.name,
        balance_due_jpy: String(pricing.balanceDueJpy),
        booking_duration_minutes: String(slot.durationMinutes),
        deposit_amount_jpy: String(pricing.depositAmountJpy),
        deposit_percent: String(pricing.depositPercent),
        deposit_terms_accepted: "true",
        deposit_terms_version: DEPOSIT_TERMS_VERSION,
        rate_jpy_per_30_minutes: String(pricing.rateJpyPer30Minutes),
        service_total_jpy: String(pricing.serviceTotalJpy),
        slot_end: slot.end,
        slot_start: slot.start,
      },
      mode: "payment",
      payment_intent_data: {
        description: `Rental Japanese Guy deposit — ${slot.label}`,
        metadata: {
          booking_event_id: slot.id,
          slot_start: slot.start,
        },
        receipt_email: booking.email,
      },
      payment_method_types: ["card"],
      success_url: `${origin}/booking/success/?session_id={CHECKOUT_SESSION_ID}`,
    })

    if (!session.url) {
      await expireHold(slot.id, holdToken)
      throw new Error("Stripe did not return a Checkout URL.")
    }

    try {
      await attachCheckoutSession(slot.id, session.id, expiresAt, holdToken)
    } catch (error) {
      await stripe.checkout.sessions.expire(session.id)
      await expireHold(slot.id, holdToken)
      throw error
    }

    return Response.json({ url: session.url })
  } catch (error) {
    if (slotId && holdToken && !(error instanceof SlotUnavailableError)) {
      try {
        await expireHold(slotId, holdToken)
      } catch (releaseError) {
        console.error("Could not release calendar hold", releaseError)
      }
    }

    if (error instanceof SlotUnavailableError) {
      return Response.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof ConfigurationError) {
      console.error(error.message)
      return Response.json(
        { error: "Online payment is being configured. Please check back soon." },
        { status: 503 }
      )
    }
    if (error instanceof Error && error.message.startsWith("Enter")) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Error && error.message.startsWith("Please")) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    if (
      error instanceof Error &&
      (error.message.startsWith("Choose") ||
        error.message.startsWith("That time is outside"))
    ) {
      return Response.json({ error: error.message }, { status: 400 })
    }

    console.error("Checkout creation failed", error)
    return Response.json(
      { error: "Checkout could not be started. Your card was not charged." },
      { status: 500 }
    )
  }
}
