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
