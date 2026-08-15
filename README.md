# Rental Japanese Guy

A Next.js booking site with a payment-gated Google Calendar workflow.

## Booking flow

1. The customer chooses a live start and end time in 30-minute increments. The
   system prefers four-hour bookings, then falls back to three, two, or one hour
   only when a longer range is unavailable.
2. Cloudflare Turnstile is verified on the server before any calendar or
   Stripe resource is created.
3. The server creates a 10-minute private hold in Google Calendar.
4. Stripe Checkout collects a non-refundable deposit equal to 25% of the
   service total.
5. A signed Stripe webhook changes the hold into a confirmed calendar event
   only when Stripe says payment completed within the 10-minute deadline.
6. A late or conflicting payment is automatically refunded instead of creating
   a conflicting booking.

Stripe-hosted Checkout has a 30-minute minimum Session expiry. The calendar
hold is still released after 10 minutes; a payment completed after that
deadline is safely refunded.

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

For Google Tasks custom-request to-do items:

1. Enable **Google Tasks API** in the same Google Cloud project.
2. For a personal Gmail account, create OAuth credentials, authorize the
   `https://www.googleapis.com/auth/tasks` scope once, then put the OAuth
   client ID, client secret, and refresh token into
   `GOOGLE_TASKS_OAUTH_CLIENT_ID`, `GOOGLE_TASKS_OAUTH_CLIENT_SECRET`, and
   `GOOGLE_TASKS_REFRESH_TOKEN`.
3. For Google Workspace only, you may instead grant the service account
   domain-wide delegation for `https://www.googleapis.com/auth/tasks`, then put
   the target user into `GOOGLE_TASKS_IMPERSONATED_USER_EMAIL`.
4. Optional: set `GOOGLE_TASKS_LIST_TITLE`. If omitted, the site creates or
   reuses a task list named `Rental Japanese Guy`.
5. Optional: set `GOOGLE_TASKS_LIST_ID` to force an existing task list.

For Stripe test mode:

1. Put the test secret key into `STRIPE_SECRET_KEY`. The publishable key is not
   needed because this project uses Stripe-hosted Checkout.
2. Run a local webhook forwarder:

   ```bash
   stripe listen --events checkout.session.completed,checkout.session.expired \
     --forward-to localhost:3000/api/stripe/webhook/
   ```

3. Put the displayed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

For Cloudflare Turnstile:

1. Create a Managed Turnstile widget restricted to the production hostname.
2. Put its public site key into `TURNSTILE_SITE_KEY`.
3. Put its secret key into `TURNSTILE_SECRET_KEY`.
4. Put the production hostnames into `TURNSTILE_ALLOWED_HOSTNAME`, separated
   by commas. Do not include `https://` or URL paths.

Turnstile tokens are validated server-side, checked for the `checkout` action
and expected hostname, and cannot be reused.

For BTC custom requests:

1. Put the on-chain BTC receiving address into `BTC_RECEIVING_ADDRESS`.
2. Keep `BTC_MIN_AMOUNT_BTC=0.01` unless the BTC starting amount changes.
3. Keep `BTC_EXPLORER_API_URL=https://blockstream.info/api` unless you use a
   different Esplora-compatible Bitcoin explorer.
4. Set `CRON_SECRET` to a long random value.
5. Schedule a request every 30-60 minutes to clean up expired unpaid booking
   holds:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://your-domain.example/api/cron/cleanup-booking-holds
   ```

6. Schedule a daily request to clean up unpaid pending BTC tasks:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     https://your-domain.example/api/cron/cleanup-btc-requests
   ```

BTC request generation creates a real Google Tasks to-do item marked pending.
It is not a confirmed booking. Expired pending tasks are deleted by the cleanup
endpoint after `BTC_PENDING_REQUEST_TTL_HOURS` hours. After sending BTC, the
customer can paste a Bitcoin transaction ID into the request page.
`/api/request-payment/btc/verify` checks the ledger for an output to
`BTC_RECEIVING_ADDRESS` of at least the expected BTC amount, then updates the
task to `paid_unconfirmed` or `success` depending on confirmations. Stripe
custom request payments create a real Google Tasks to-do item only after
Stripe confirms successful payment. Confirm actual bookings manually only after
payment is received.
The default pending TTL is 2 hours; requests with a seen transaction are kept
as `paid_unconfirmed` instead of being treated as unpaid noise.

Booking checkout creates a temporary calendar hold marked `bookingState=hold`.
Stripe webhook confirmation updates successful bookings to
`bookingState=confirmed`. If the customer returns from Stripe's cancel flow, the
booking page immediately releases the matching unpaid hold. Stripe's
`checkout.session.expired` webhook also releases abandoned unpaid holds when the
hosted Checkout Session expires. Expired unpaid holds stop blocking availability
immediately. `/api/cron/cleanup-booking-holds` deletes expired holds and any
pending hold that overlaps a real, non-hold calendar event as a backup.

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

Subscribe it to `checkout.session.completed` and `checkout.session.expired`,
then store its signing secret and the remaining server variables in the hosting
environment before publishing.

Disable the old public Google Appointment Schedule after this flow is live.
Otherwise somebody who knows its direct Google URL can still bypass Stripe.
