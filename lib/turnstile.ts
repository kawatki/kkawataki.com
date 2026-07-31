import "server-only"

import { requiredEnv } from "@/lib/server-config"

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const TURNSTILE_ACTION = "checkout"
const MAX_TOKEN_LENGTH = 2_048

type TurnstileResult = {
  action?: string
  "error-codes"?: string[]
  hostname?: string
  success?: boolean
}

export class TurnstileVerificationError extends Error {
  constructor(
    message: string,
    readonly unavailable = false
  ) {
    super(message)
    this.name = "TurnstileVerificationError"
  }
}

function clientAddress(headers: Headers) {
  return headers.get("cf-connecting-ip")?.trim() || undefined
}

export async function verifyTurnstile(
  token: unknown,
  request: Request
) {
  if (
    typeof token !== "string" ||
    !token ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    throw new TurnstileVerificationError(
      "Complete the security check before continuing."
    )
  }

  let response: Response
  try {
    response = await fetch(SITEVERIFY_URL, {
      body: new URLSearchParams({
        ...(clientAddress(request.headers)
          ? { remoteip: clientAddress(request.headers)! }
          : {}),
        response: token,
        secret: requiredEnv("TURNSTILE_SECRET_KEY"),
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(8_000),
    })
  } catch (error) {
    console.error("Turnstile verification request failed", error)
    throw new TurnstileVerificationError(
      "The security check is temporarily unavailable. Please try again.",
      true
    )
  }

  if (!response.ok) {
    console.error("Turnstile Siteverify failed", response.status)
    throw new TurnstileVerificationError(
      "The security check is temporarily unavailable. Please try again.",
      true
    )
  }

  const result = (await response.json()) as TurnstileResult
  const allowedHostnames = (
    process.env.TURNSTILE_ALLOWED_HOSTNAME ||
    new URL(request.url).hostname
  )
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)
  const testing = process.env.TURNSTILE_TESTING === "true"
  const hostnameMatches =
    testing ||
    (typeof result.hostname === "string" &&
      allowedHostnames.includes(result.hostname.toLowerCase()))
  const actionMatches =
    testing ||
    !result.action ||
    result.action === TURNSTILE_ACTION

  if (
    !result.success ||
    !actionMatches ||
    !hostnameMatches
  ) {
    console.error("Turnstile verification rejected", {
      action: result.action ?? null,
      errorCodes: result["error-codes"] ?? [],
      hostname: result.hostname ?? null,
      hostnameMatches,
      actionMatches,
      success: result.success ?? false,
    })
    throw new TurnstileVerificationError(
      "The security check expired or could not be verified. Please try again."
    )
  }
}
