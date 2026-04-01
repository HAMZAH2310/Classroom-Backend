import { relations } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const timeStamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
};

export const roleEnum = pgEnum("role", ["student", "teacher", "admin"]);

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    role: roleEnum("role").default("student").notNull(),
    imageCldPubId: text("image_cld_pub_id"),
    ...timeStamps
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
    ...timeStamps
}, (table) => ({
    userIdIdx: index("session_user_id_idx").on(table.userId)
}));

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    ...timeStamps
}, (table) => ({
    userIdIdx: index("account_user_id_idx").on(table.userId),
    accountIdProviderIdIdx: uniqueIndex("account_provider_id_account_id_idx").on(table.providerId, table.accountId)
}));

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ...timeStamps
}, (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier)
}));
