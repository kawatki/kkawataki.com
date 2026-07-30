import "server-only"

export class ConfigurationError extends Error {
  constructor(name: string) {
    super(`Missing server configuration: ${name}`)
    this.name = "ConfigurationError"
  }
}

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new ConfigurationError(name)
  }
  return value
}

export function bookingConfigurationReady() {
  return [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_CALENDAR_ID",
  ].every((name) => Boolean(process.env[name]?.trim()))
}
