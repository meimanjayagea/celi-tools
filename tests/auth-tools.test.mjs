import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { safeAuthNext, completeAuth, authFeedback, authRequestError, googleAuthOptions, emailAuthOptions, isUnknownEmail } from "../apps/web/app/lib/auth-tools.mjs";

test("auth return paths reject external URLs, protocol-relative URLs and callback loops", () => {
  for (const value of [null, "https://evil.example", "//evil.example", "/\\evil.example", "/auth/callback", "/login", "/json/../auth/confirm", "/%2f%2fevil.example", "/json\n"]) assert.equal(safeAuthNext(value), "/dashboard");
  assert.equal(safeAuthNext("/json?view=tree"), "/json?view=tree");
});

test("email signup and login use different account-creation policies without passwords", () => {
  const login = emailAuthOptions("  sample@example.invalid ", "http://localhost:3000", "login");
  const signup = emailAuthOptions("sample@example.invalid", "http://localhost:3000", "register");
  assert.equal(login.email, "sample@example.invalid");
  assert.equal(login.options.shouldCreateUser, false);
  assert.equal(signup.options.shouldCreateUser, true);
  assert.equal(login.options.emailRedirectTo, "http://localhost:3000/auth/confirm");
  assert.equal("password" in signup, false);
  assert.equal(isUnknownEmail({ message: "Signups not allowed for otp" }), true);
  assert.equal(isUnknownEmail({ code: "over_email_send_rate_limit" }), false);
});

test("callback rejects missing credentials and cancelled consent before creating a client", async () => {
  const unused = () => { throw new Error("Client must not be created"); };
  for (const params of ["", "token_hash=abc&type=email", "code=abc&token_hash=def&type=email"]) assert.equal((await completeAuth(new URLSearchParams(params), unused)).destination, "/login?auth_error=invalid_link");
  const result = await completeAuth(new URLSearchParams("error=access_denied&flow=register&error_description=secret"), unused);
  assert.equal(result.destination, "/register?auth_error=oauth_cancelled");
});

test("callback exchanges supported credentials and requires an email identity plus a session", async () => {
  let received;
  let signedOut = false;
  const client = { auth: {
    verifyOtp: async value => { received = value; return { data: { session: {}, user: { email: "sample@example.invalid" } } }; },
    exchangeCodeForSession: async value => { received = value; return { data: { session: {}, user: { email: "sample@example.invalid" } } }; },
    signOut: async () => { signedOut = true; },
  } };
  assert.equal((await completeAuth(new URLSearchParams("code=abc&next=//evil.example"), async () => client)).destination, "/dashboard");
  assert.equal(received, "abc");
  assert.equal((await completeAuth(new URLSearchParams("token_hash=xyz&type=email&next=/json"), async () => client, true)).destination, "/json");
  assert.deepEqual(received, { token_hash: "xyz", type: "email" });
  assert.equal((await completeAuth(new URLSearchParams("token_hash=xyz&type=recovery"), async () => client, true)).success, false);
  client.auth.exchangeCodeForSession = async () => ({ data: { session: {}, user: {} } });
  assert.equal((await completeAuth(new URLSearchParams("code=abc"), async () => client)).success, false);
  assert.equal(signedOut, true);
});

test("expired tokens and raw provider errors produce safe actionable messages", async () => {
  const factory = async () => ({ auth: { exchangeCodeForSession: async () => ({ error: { code: "otp_expired", message: "secret-token" } }) } });
  assert.equal((await completeAuth(new URLSearchParams("code=abc"), factory)).destination, "/login?auth_error=expired_link");
  assert.match(authFeedback("expired_link"), /tautan baru/i);
  assert.equal(authFeedback("<script>secret</script>").includes("secret"), false);
  assert.equal(authRequestError(new Error("secret-token")).includes("secret"), false);
  const missingVerifier = async () => ({ auth: { exchangeCodeForSession: async () => ({ error: { code: "pkce_code_verifier_not_found" } }) } });
  assert.equal((await completeAuth(new URLSearchParams("code=abc"), missingVerifier)).destination, "/login?auth_error=missing_verifier");
});

test("Google OAuth uses S256 PKCE and the server exchanges the matching verifier into cookies", async () => {
  const jar = new Map();
  const cookies = { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: values => { values.forEach(({ name, value }) => value ? jar.set(name, value) : jar.delete(name)); } };
  const url = "https://example.supabase.co";
  const key = "sb_publishable_example";
  const browser = createBrowserClient(url, key, { isSingleton: false, cookies, auth: { detectSessionInUrl: false } });
  const oauth = await browser.auth.signInWithOAuth(googleAuthOptions("http://localhost:3000", "register"));
  assert.equal(oauth.error, null);
  const authorize = new URL(oauth.data.url);
  assert.equal(authorize.searchParams.get("provider"), "google");
  assert.equal(authorize.searchParams.get("code_challenge_method"), "s256");
  assert.equal(authorize.searchParams.get("scopes"), "openid email profile");
  assert.equal(authorize.searchParams.get("access_type"), null);
  assert.equal(new URL(authorize.searchParams.get("redirect_to")).pathname, "/auth/callback");
  assert.ok([...jar.keys()].some(name => name.endsWith("-code-verifier")));
  const verifierCookie = "sb-example-auth-token-code-verifier";
  assert.ok(jar.has(verifierCookie));
  const user = { id: "00000000-0000-4000-8000-000000000001", email: "sample@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = `${encode({ alg: "HS256" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
  let requestBody;
  const server = createServerClient(url, key, { cookies, global: { fetch: async (input, init) => {
    assert.match(String(input), /token\?grant_type=pkce$/);
    requestBody = JSON.parse(init.body);
    return Response.json({ access_token: jwt, refresh_token: "synthetic-refresh-token", expires_in: 3600, token_type: "bearer", user });
  } } });
  const result = await server.auth.exchangeCodeForSession("synthetic-auth-code");
  assert.equal(result.error, null);
  assert.equal(requestBody.auth_code, "synthetic-auth-code");
  assert.equal(createHash("sha256").update(requestBody.code_verifier).digest("base64url"), authorize.searchParams.get("code_challenge"));
  assert.ok([...jar.keys()].some(name => /^sb-.*-auth-token(?:\.\d+)?$/.test(name)));
  assert.equal(jar.has(verifierCookie), false);
});
