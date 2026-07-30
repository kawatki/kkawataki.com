# Rental Japanese Guy

A Next.js booking site with a payment-gated Google Calendar workflow.

## Booking flow

1. The customer chooses a live four-hour slot and submits their request.
2. The server creates a temporary private hold in Google Calendar.
3. Stripe Checkout collects a ¥2,000 deposit.
4. A signed Stripe webhook changes the hold into a confirmed calendar event.
5. If an old Checkout Session pays after its hold was replaced, the deposit is
   automatically refunded instead of creating a conflicting booking.

The old public Google Appointment Schedule is not used by the website because
its URL would allow customers to bypass payment.

## Local setup

Copy the variables in `.env.example` into `.env.local` and add the real values.
Never commit `.env.local`.

For Google Calendar:

1. Create a Google Cloud project and enable **Google Calendar API**.
2. Create a service account and download its JSON key.
3. Put `client_email` into `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
4. Put `private_key` into `GOOGLE_PRIVATE_KEY`.
5. In Google Calendar settings, share the booking calendar with the service
   account email and grant **Make changes to events**.
6. Put that calendar's ID into `GOOGLE_CALENDAR_ID`.

For Stripe test mode:

1. Put the test secret key into `STRIPE_SECRET_KEY`. The publishable key is not
   needed because this project uses Stripe-hosted Checkout.
2. Run a local webhook forwarder:

   ```bash
   stripe listen --events checkout.session.completed \
     --forward-to localhost:3000/api/stripe/webhook/
   ```

3. Put the displayed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

Start the site:

```bash
pnpm dev
```

Open `http://localhost:3000/booking`. Use Stripe test card
`4242 4242 4242 4242`, any future expiry, and any CVC.

## Production

Register this webhook endpoint in Stripe test mode:

```text
https://rental-japanese-guy.kkawataki.chatgpt.site/api/stripe/webhook/
```

Subscribe it to `checkout.session.completed`, then store its signing secret and
the remaining server variables in the hosting environment before publishing.

Disable the old public Google Appointment Schedule after this flow is live.
Otherwise somebody who knows its direct Google URL can still bypass Stripe.
