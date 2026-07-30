import "server-only"

type D1Database = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>
      run(): Promise<unknown>
    }
  }
}

type RateLimitOptions = {
  bucket: string
  limit: number
  windowSeconds: number
}

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

type MemoryCounter = {
  count: number
  expiresAt: number
}

const memoryCounters = new Map<string, MemoryCounter>()

async function getRateLimitDatabase() {
  try {
    const { env } = await import("cloudflare:workers")
    return (env.RATE_LIMIT_DB as D1Database | undefined) ?? null
  } catch {
    return null
  }
}

function clientAddress(headers: Headers) {
  const cloudflareAddress = headers.get("cf-connecting-ip")?.trim()
  if (cloudflareAddress) {
    return cloudflareAddress
  }

  if (process.env.NODE_ENV !== "production") {
    return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  }
  return "unknown"
}

async function hashKey(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

function memoryRateLimit(
  key: string,
  limit: number,
  resetAt: number
): RateLimitResult {
  const current = memoryCounters.get(key)
  const next =
    !current || current.expiresAt <= Date.now()
      ? { count: 1, expiresAt: resetAt * 1_000 }
      : { ...current, count: current.count + 1 }
  memoryCounters.set(key, next)

  return {
    allowed: next.count <= limit,
    limit,
    remaining: Math.max(0, limit - next.count),
    resetAt,
  }
}

export async function checkRateLimit(
  headers: Headers,
  { bucket, limit, windowSeconds }: RateLimitOptions
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1_000)
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds
  const resetAt = windowStart + windowSeconds
  const salt = process.env.RATE_LIMIT_SALT ?? "local-development"
  const key = await hashKey(`${salt}:${bucket}:${clientAddress(headers)}`)
  const database = await getRateLimitDatabase()

  if (!database) {
    return memoryRateLimit(`${key}:${windowStart}`, limit, resetAt)
  }

  try {
    const existing = await database
      .prepare(
        "SELECT count FROM rate_limit_counters WHERE key = ?1 AND window_start = ?2"
      )
      .bind(key, windowStart)
      .first<{ count: number }>()

    if ((existing?.count ?? 0) >= limit) {
      return { allowed: false, limit, remaining: 0, resetAt }
    }

    const updated = await database
      .prepare(
        `INSERT INTO rate_limit_counters (key, window_start, count, expires_at)
         VALUES (?1, ?2, 1, ?3)
         ON CONFLICT(key, window_start)
         DO UPDATE SET count = count + 1
         RETURNING count`
      )
      .bind(key, windowStart, resetAt + windowSeconds)
      .first<{ count: number }>()
    const count = updated?.count ?? limit

    if (crypto.getRandomValues(new Uint8Array(1))[0] === 0) {
      await database
        .prepare("DELETE FROM rate_limit_counters WHERE expires_at < ?1")
        .bind(now)
        .run()
    }

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    }
  } catch (error) {
    console.error("Durable rate limit check failed", error)
    return memoryRateLimit(`${key}:${windowStart}`, limit, resetAt)
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "ratelimit-limit": String(result.limit),
    "ratelimit-remaining": String(result.remaining),
    "ratelimit-reset": String(result.resetAt),
  }
}

export function rateLimitedResponse(result: RateLimitResult) {
  const retryAfter = Math.max(
    1,
    result.resetAt - Math.floor(Date.now() / 1_000)
  )
  return Response.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      headers: {
        ...rateLimitHeaders(result),
        "cache-control": "private, no-store, max-age=0",
        "retry-after": String(retryAfter),
      },
      status: 429,
    }
  )
}
