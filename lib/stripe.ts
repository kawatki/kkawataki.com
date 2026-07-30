import "server-only"

import Stripe from "stripe"

import { requiredEnv } from "@/lib/server-config"

let stripeClient: Stripe | undefined

export function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
      appInfo: {
        name: "Rental Japanese Guy",
        version: "0.1.0",
      },
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 2,
    })
  }

  return stripeClient
}

export function getStripeCryptoProvider() {
  return Stripe.createSubtleCryptoProvider()
}
