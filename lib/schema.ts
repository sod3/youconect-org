import {
  pgTable,
  text,
  boolean,
  jsonb,
  timestamp,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
// Runtime query definitions. Versioned SQL migrations remain the schema source of truth.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  headline: text("headline").notNull(),
  bio: text("bio").notNull(),
  avatar: text("avatar").notNull(),
  interests: jsonb("interests").$type<string[]>().notNull(),
  privacy: jsonb("privacy").$type<Record<string, unknown>>().notNull(),
  emailVerified: boolean("email_verified").notNull(),
  onboardingComplete: boolean("onboarding_complete").notNull(),
  platformRole: text("platform_role").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});
export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(),
  verified: boolean("verified").notNull(),
  plan: text("plan").notNull(),
});
export const memberships = pgTable(
  "memberships",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);
