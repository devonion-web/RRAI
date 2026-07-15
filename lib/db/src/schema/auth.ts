import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

// ── Sessions ──────────────────────────────────────────────────────────────────
// IMPORTANT: This table is mandatory for Replit Auth. Do not drop it.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// ── Users ─────────────────────────────────────────────────────────────────────
// IMPORTANT: This table is mandatory for Replit Auth. Do not drop it.
//
// Organisation readiness: this model is designed so that a future
// user_organisations junction table can associate each user with one or more
// organisations without requiring a destructive schema change. The `role`
// column captures the platform-level role (user / admin). Org-scoped roles
// will be implemented as a separate join-table attribute.
export const usersTable = pgTable("users", {
  // Replit OIDC `sub` claim — not a UUID but a stable provider-assigned ID.
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),

  // Platform role. Extensible: future roles (reviewer, approver,
  // knowledge_manager, platform_admin) may be added without a breaking change.
  // Current valid values: "user" | "admin"
  role: text("role").notNull().default("user"),

  // Account lifecycle
  accountStatus: text("account_status").notNull().default("active"),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
