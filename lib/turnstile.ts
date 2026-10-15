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

function normalizeHostname(hostname: string) {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/u, "")
}

function hostnameVariants(hostname: string) {
  const normalized = normalizeHostname(hostname)
  if (!normalized) return []
  if (normalized.startsWith("www.")) {
    return [normalized, normalized.slice(4)]
  }
  return [normalized, `www.${normalized}`]
}

function allowedHostnames(request: Request) {
  const configuredHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAME || "")
    .split(",")
    .map(normalizeHostname)
    .filter(Boolean)
  const requestHostname = normalizeHostname(new URL(request.url).hostname)

  return new Set(
    [...configuredHostnames, requestHostname].flatMap(hostnameVariants)
  )
}

export async function verifyTurnstile(
  token: unknown,
  request: Request,
  expectedAction = TURNSTILE_ACTION
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
  const validHostnames = allowedHostnames(request)
  const verifiedHostname =
    typeof result.hostname === "string"
      ? normalizeHostname(result.hostname)
      : ""
  const testing = process.env.TURNSTILE_TESTING === "true"
  const hostnameMatches =
    testing ||
    (verifiedHostname !== "" && validHostnames.has(verifiedHostname))
  const actionMatches =
    testing ||
    (expectedAction === TURNSTILE_ACTION && !result.action) ||
    result.action === expectedAction

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
