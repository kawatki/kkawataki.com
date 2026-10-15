import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const rateLimitCounters = sqliteTable(
  "rate_limit_counters",
  {
    count: integer("count").notNull().default(0),
    expiresAt: integer("expires_at").notNull(),
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })]
)

// Durable cancellation ledger: one immutable refund entitlement per paid booking.
export const bookingCancellations = sqliteTable("booking_cancellations", {
  reference: text("reference").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  eventId: text("event_id").notNull(),
  emailHash: text("email_hash").notNull(),
  slotStart: text("slot_start").notNull(),
  requestedAt: integer("requested_at").notNull(),
  amountPaid: integer("amount_paid").notNull(),
  refundPercent: integer("refund_percent").notNull(),
  refundAmount: integer("refund_amount").notNull(),
  paymentIntent: text("payment_intent").notNull(),
  refundId: text("refund_id"),
  refundStatus: text("refund_status").notNull().default("not_started"),
  calendarReleased: integer("calendar_released").notNull().default(0),
  lockToken: text("lock_token"),
  lockedUntil: integer("locked_until").notNull().default(0),
})
