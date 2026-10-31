import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { createTransport } from "nodemailer";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "pg";
import NextAuth from "next-auth";
import type { EmailConfig } from "next-auth/providers/email";
import type { Adapter } from "next-auth/adapters";
import { authConfigurationStatus } from "./app/lib/auth-environment.mjs";

const globalForAuth = globalThis as typeof globalThis & { authPool?: Pool };
const databaseProvider = (process.env.AUTH_DATABASE_PROVIDER || "postgres").trim().toLowerCase();
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const usesPostgres = ["postgres", "postgresql", "supabase", "prisma-postgres", "neon", "vercel-postgres"]
  .includes(databaseProvider);
const hasPostgresUrl = typeof databaseUrl === "string" && /^postgres(?:ql)?:\/\//i.test(databaseUrl);
const pool = usesPostgres && hasPostgresUrl
  ? globalForAuth.authPool ?? new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    })
  : undefined;
if (pool && process.env.NODE_ENV !== "production") globalForAuth.authPool = pool;

const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpServer = {
  host: process.env.SMTP_HOST || "localhost",
  port: smtpPort,
  secure: smtpPort === 465,
  requireTLS: smtpPort !== 465,
  tls: { minVersion: "TLSv1.2" as const },
  disableFileAccess: true,
  disableUrlAccess: true,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
  },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

function rateLimitHash(scope: string, value: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return createHmac("sha256", secret).update(`${scope}:${value}`).digest("hex");
}

const emailProvider: EmailConfig = {
  id: "email",
  type: "email",
  name: "Email",
  from: process.env.EMAIL_FROM || "",
  maxAge: 10 * 60,
  async sendVerificationRequest({ identifier, url, provider, request }) {
    const forwardedIp = request.headers.get("x-vercel-forwarded-for");
    const clientIp = forwardedIp?.trim();
    if (process.env.NODE_ENV === "production" && (!clientIp || !isIP(clientIp))) {
      throw new Error("Trusted client IP is unavailable");
    }
    if (clientIp && isIP(clientIp)) {
      const ipAllowed = await pool!.query(
        `INSERT INTO auth_ip_rate_limits (ip_hash, window_started_at, request_count)
         VALUES ($1, now(), 1)
         ON CONFLICT (ip_hash) DO UPDATE
         SET request_count = CASE
               WHEN auth_ip_rate_limits.window_started_at < now() - interval '60 seconds' THEN 1
               ELSE auth_ip_rate_limits.request_count + 1
             END,
             window_started_at = CASE
               WHEN auth_ip_rate_limits.window_started_at < now() - interval '60 seconds' THEN now()
               ELSE auth_ip_rate_limits.window_started_at
             END
         WHERE auth_ip_rate_limits.window_started_at < now() - interval '60 seconds'
            OR auth_ip_rate_limits.request_count < 10
         RETURNING ip_hash`,
        [rateLimitHash("ip", clientIp)],
      );
      if (ipAllowed.rowCount !== 1) throw new Error("IP email request rate limit exceeded");
    }

    // Durable throttle: a user can request at most one sign-in link per minute.
    const allowed = await pool!.query(
      `INSERT INTO auth_email_rate_limits (email_hash, last_sent_at)
       VALUES ($1, now())
       ON CONFLICT (email_hash) DO UPDATE
       SET last_sent_at = now()
       WHERE auth_email_rate_limits.last_sent_at < now() - interval '60 seconds'
       RETURNING email_hash`,
      [rateLimitHash("email", identifier.trim().toLowerCase())],
    );
    if (allowed.rowCount !== 1) throw new Error("Email request rate limit exceeded");

    const host = new URL(url).host;
    const safeUrl = escapeHtml(url);
    const transport = createTransport(smtpServer);
    const result = await transport.sendMail({
      to: identifier,
      from: provider.from || process.env.EMAIL_FROM,
      subject: `Tautan masuk ke Celi Tools (${host})`,
      text: `Gunakan tautan ini untuk masuk ke Celi Tools. Tautan berlaku 10 menit dan hanya dapat digunakan sekali:\n\n${url}\n\nJika Anda tidak meminta tautan ini, abaikan email ini.`,
      html: `<p>Gunakan tautan berikut untuk masuk ke Celi Tools. Tautan berlaku 10 menit dan hanya dapat digunakan sekali.</p><p><a href="${safeUrl}">Masuk ke Celi Tools</a></p><p>Jika Anda tidak meminta tautan ini, abaikan email ini.</p>`,
    });
    if (result.rejected?.length || result.pending?.length) {
      throw new Error("Email provider rejected the message");
    }
  },
};

const configuredAdapter: Adapter | undefined = pool ? PostgresAdapter(pool) : undefined;
const providers = configuredAdapter ? [emailProvider] : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(configuredAdapter ? { adapter: configuredAdapter } : {}),
  providers,
  pages: { signIn: "/login" },
  session: { strategy: configuredAdapter ? "database" : "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});

export function authConfigurationReady() {
  return authConfigurationStatus().available;
}
