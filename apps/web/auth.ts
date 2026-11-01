import PostgresAdapter from "@auth/pg-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { Adapter } from "next-auth/adapters";
import { authConfigurationStatus } from "./app/lib/auth-environment.mjs";
import { pool } from "./app/lib/database";

const authProviders = authConfigurationStatus();
const googleProvider = authProviders.google
  ? Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Google verifies account email; this also preserves access for existing email users.
      allowDangerousEmailAccountLinking: true,
    })
  : undefined;

const configuredAdapter: Adapter | undefined = pool ? PostgresAdapter(pool) : undefined;
const providers = configuredAdapter && googleProvider ? [googleProvider] : [];
const authTables = ["users", "accounts", "sessions"];
let authSchemaReady = false;
let authSchemaCheckedAt = 0;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(configuredAdapter ? { adapter: configuredAdapter } : {}),
  providers,
  pages: { signIn: "/login" },
  session: { strategy: configuredAdapter ? "database" : "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && profile?.email_verified === true && typeof profile.email === "string";
    },
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});

export async function liveAuthConfigurationStatus() {
  const configured = authConfigurationStatus();
  if (!configured.available || !pool) return configured;

  if (Date.now() - authSchemaCheckedAt < 10_000) {
    return authSchemaReady ? configured : { ...configured, available: false, email: false, google: false, registration: false };
  }

  try {
    const result = await pool.query(
      `SELECT count(*)::int AS count
       FROM information_schema.tables
       WHERE table_schema = 'celi_auth' AND table_name = ANY($1::text[])`,
      [authTables],
    );
    authSchemaReady = result.rows[0]?.count === authTables.length;
  } catch {
    authSchemaReady = false;
  }
  authSchemaCheckedAt = Date.now();
  return authSchemaReady ? configured : { ...configured, available: false, email: false, google: false, registration: false };
}

export async function authConfigurationReady() {
  return (await liveAuthConfigurationStatus()).available;
}
