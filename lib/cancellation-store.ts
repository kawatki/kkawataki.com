import "server-only"

export type CancellationRecord = {
  reference: string
  session_id: string
  event_id: string
  email_hash: string
  slot_start: string
  requested_at: number
  amount_paid: number
  refund_percent: number
  refund_amount: number
  payment_intent: string
  refund_id: string | null
  refund_status: string
  calendar_released: number
  lock_token: string | null
  locked_until: number
}

type Statement = {
  bind(...values: unknown[]): Statement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}
type Database = { prepare(query: string): Statement }

export async function cancellationDatabase(): Promise<Database> {
  const { env } = await import("cloudflare:workers")
  const database = env.RATE_LIMIT_DB as Database | undefined
  // Financial operations must never fall back to transient in-memory state.
  if (!database) throw new Error("Cancellation storage is unavailable.")
  return database
}

export async function findCancellation(reference: string) {
  const db = await cancellationDatabase()
  return db.prepare("SELECT * FROM booking_cancellations WHERE reference = ?")
    .bind(reference).first<CancellationRecord>()
}

export async function bookingWasCancelled(sessionId: string) {
  const db = await cancellationDatabase()
  return Boolean(await db.prepare("SELECT reference FROM booking_cancellations WHERE session_id = ?")
    .bind(sessionId).first())
}

export async function recordCancellation(row: CancellationRecord) {
  const db = await cancellationDatabase()
  await db.prepare(`INSERT INTO booking_cancellations
    (reference, session_id, event_id, email_hash, slot_start, requested_at, amount_paid,
     refund_percent, refund_amount, payment_intent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`)
    .bind(row.reference, row.session_id, row.event_id, row.email_hash, row.slot_start,
      row.requested_at, row.amount_paid, row.refund_percent, row.refund_amount, row.payment_intent).run()
  const saved = await findCancellation(row.reference)
  if (!saved) throw new Error("Could not save cancellation.")
  return saved
}
