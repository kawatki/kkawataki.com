import {
  CHECKOUT_HOLD_MINUTES,
  createBookingReference,
  DEPOSIT_TERMS_VERSION,
  getBookingPricing,
  minimumDurationForAvailableTimes,
  parseBookingRequest,
  STRIPE_CHECKOUT_EXPIRY_MINUTES,
  generateCandidateSlots,
  validateRequestedSlot,
} from "@/lib/booking"
import {
  acquireSlot,
  attachCheckoutSession,
  expireHold,
  listAvailableSlots,
  SlotUnavailableError,
} from "@/lib/google-calendar"
import { ConfigurationError } from "@/lib/server-config"
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/rate-limit"
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

function formatStripeDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value))
}

function paymentDescription({
  bookingReference,
  location,
  slot,
}: {
  bookingReference: string
  location: string
  slot: { end: string; label: string; start: string }
}) {
  return `${bookingReference} - ${formatStripeDate(slot.start)} - ${slot.label} JST - ${location}`
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request.headers, {
    bucket: "checkout",
    limit: 30,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit)
  }

  if (!requestIsSameOrigin(request)) {
    return Response.json({ error: "Invalid booking request." }, { status: 403 })
  }

  let slotId: string | undefined
  let holdToken: string | undefined

  try {
    const input = await request.json()
    const turnstileToken =
      input && typeof input === "object" && "turnstileToken" in input
        ? input.turnstileToken
        : undefined
    await verifyTurnstile(turnstileToken, request)
    const booking = parseBookingRequest(input)
    const slot = validateRequestedSlot(
      booking.date,
      booking.startTime,
      booking.endTime
    )
    const dayCandidates = generateCandidateSlots().filter(
      (candidate) => candidate.date === booking.date
    )
    const availableDaySlots = await listAvailableSlots(dayCandidates)
    const allowedMinimumDuration = minimumDurationForAvailableTimes(
      availableDaySlots.map((candidate) => candidate.start.slice(11, 16))
    )
    if (
      !allowedMinimumDuration ||
      slot.durationMinutes < allowedMinimumDuration
    ) {
      return Response.json(
        {
          error: allowedMinimumDuration
            ? `This date still has a ${allowedMinimumDuration / 60}-hour booking available. Please choose at least ${allowedMinimumDuration / 60} hours.`
            : "That date has just become unavailable. Please choose another date.",
        },
        { status: 409 }
      )
    }
    const pricing = getBookingPricing(slot.durationMinutes)
    const bookingReference = createBookingReference()
    slotId = slot.id
    holdToken = crypto.randomUUID()

    // Stripe requires Checkout Sessions to remain open for at least 30 minutes.
    // The calendar hold is intentionally shorter; a late payment is refunded.
    const now = Math.floor(Date.now() / 1_000)
    const holdExpiresAt = now + CHECKOUT_HOLD_MINUTES * 60
    const stripeExpiresAt =
      now + STRIPE_CHECKOUT_EXPIRY_MINUTES * 60 + 60

    await acquireSlot(
      slot,
      booking,
      holdExpiresAt,
      holdToken,
      bookingReference
    )

    const stripe = getStripe()
    const origin = new URL(request.url).origin
    const session = await stripe.checkout.sessions.create({
      cancel_url: `${origin}/booking/?payment=cancelled`,
      customer_email: booking.email,
      custom_text: {
        submit: {
          message: `Complete payment within ${CHECKOUT_HOLD_MINUTES} minutes to keep this time. Service rate: ¥${pricing.rateJpyPer30Minutes.toLocaleString("en-US")} per 30 minutes (¥${pricing.serviceTotalJpy.toLocaleString("en-US")} for ${pricing.durationHours} hours). The 25% deposit of ¥${pricing.depositAmountJpy.toLocaleString("en-US")} is non-refundable if you cancel or do not attend, and is deducted from the final amount. You also cover transportation and any food or drinks during our time together.`,
        },
      },
      expires_at: stripeExpiresAt,
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              description: "Applied to the final amount paid in person.",
              name: `Rental Japanese Guy deposit · ${bookingReference}`,
            },
            unit_amount: pricing.depositAmountJpy,
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_reference: bookingReference,
        booking_event_id: slot.id,
        booking_location: booking.location,
        booking_notes: booking.notes,
        booking_title: booking.title,
        customer_name: booking.name,
        alternate_contact: booking.alternateContact,
        balance_due_jpy: String(pricing.balanceDueJpy),
        booking_duration_minutes: String(slot.durationMinutes),
        deposit_amount_jpy: String(pricing.depositAmountJpy),
        deposit_percent: String(pricing.depositPercent),
        deposit_terms_accepted: "true",
        deposit_terms_version: DEPOSIT_TERMS_VERSION,
        rate_jpy_per_30_minutes: String(pricing.rateJpyPer30Minutes),
        service_total_jpy: String(pricing.serviceTotalJpy),
        social_handle: booking.socialHandle,
        social_platform: booking.socialPlatform,
        hold_expires_at: String(holdExpiresAt),
        slot_end: slot.end,
        slot_start: slot.start,
      },
      mode: "payment",
      payment_intent_data: {
        description: paymentDescription({
          bookingReference,
          location: booking.location,
          slot,
        }),
        metadata: {
          booking_reference: bookingReference,
          booking_event_id: slot.id,
          booking_location: booking.location,
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
      await attachCheckoutSession(
        slot.id,
        session.id,
        holdExpiresAt,
        holdToken
      )
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
    if (error instanceof TurnstileVerificationError) {
      return Response.json(
        { error: error.message },
        { status: error.unavailable ? 503 : 400 }
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
