const destinations = new Set(["/dashboard", "/converter", "/compress", "/json", "/crypto", "/preferences"]);

export function safeAuthNext(value) {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || /[\\\s\u0000-\u001f]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://celi.invalid");
    if (url.origin !== "https://celi.invalid" || !destinations.has(url.pathname)) return "/dashboard";
    return url.pathname + url.search;
  } catch { return "/dashboard"; }
}

export function authRedirectUrl(origin, flow, method = "google") {
  const url = new URL(method === "email" ? "/auth/confirm" : "/auth/callback", origin);
  if (method === "google") url.searchParams.set("flow", flow === "register" ? "register" : "login");
  return url.href;
}

export function googleAuthOptions(origin, flow) {
  return { provider: "google", options: { redirectTo: authRedirectUrl(origin, flow), scopes: "openid email profile", queryParams: { prompt: "select_account" }, skipBrowserRedirect: true } };
}

export function emailAuthOptions(email, origin, flow) {
  return { email: email.trim(), options: { shouldCreateUser: flow === "register", emailRedirectTo: authRedirectUrl(origin, flow, "email") } };
}

export function authFeedback(code) {
  return ({
    oauth_cancelled: "Masuk dengan Google dibatalkan. Anda dapat mencoba lagi atau menggunakan tautan email.",
    invalid_link: "Tautan masuk tidak lengkap atau tidak valid. Minta tautan baru di bawah ini.",
    expired_link: "Tautan sudah kedaluwarsa atau pernah digunakan. Minta tautan baru dan buka email yang paling baru.",
    missing_verifier: "Sesi masuk tidak ditemukan. Mulai lagi dari halaman ini dan gunakan browser yang sama.",
    callback_failed: "Masuk belum berhasil diselesaikan. Silakan coba kembali.",
    service_unavailable: "Layanan akun belum tersedia. Coba kembali beberapa saat lagi.",
  })[code] || "Masuk belum berhasil diselesaikan. Silakan coba kembali.";
}

export function authRequestError(error) {
  const code = error?.code || "";
  if (["over_email_send_rate_limit", "over_request_rate_limit"].includes(code) || /rate|too many/i.test(error?.message || "")) return "Terlalu banyak permintaan. Tunggu beberapa saat sebelum mencoba lagi.";
  if (["provider_disabled", "email_provider_disabled"].includes(code)) return "Metode masuk ini belum tersedia. Gunakan metode lain atau coba kembali nanti.";
  if (/fetch|network|timeout/i.test(error?.message || "")) return "Koneksi ke layanan akun belum berhasil. Periksa jaringan Anda dan coba kembali.";
  return "Permintaan belum berhasil. Periksa alamat email Anda atau coba kembali beberapa saat lagi.";
}

// A login request must not reveal whether an email address has an account.
export function isUnknownEmail(error) {
  return error?.code === "user_not_found" || /signups not allowed for otp/i.test(error?.message || "");
}

/** Exchange only supported credentials. Supabase validates PKCE/OIDC and email tokens. */
export async function completeAuth(params, getClient, allowEmailToken = false) {
  const entry = params.get("flow") === "register" ? "/register" : "/login";
  const fail = code => ({ destination: `${entry}?auth_error=${code}`, success: false });
  if (params.has("error")) return fail(params.get("error") === "access_denied" ? "oauth_cancelled" : "callback_failed");
  const token = params.get("token_hash");
  const code = params.get("code");
  const flowId = params.get("sb_flow_id");
  if (params.has("sb_flow_id") && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId || "")) return fail("invalid_link");
  if ((token && (!allowEmailToken || params.get("type") !== "email" || code)) || (!token && !code) || (token || code).length > 4096) return fail("invalid_link");
  try {
    const client = await getClient();
    const { data, error } = token
      ? await client.auth.verifyOtp({ token_hash: token, type: "email" })
      : await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) {
      if (["otp_expired", "flow_state_expired", "flow_state_not_found"].includes(error.code)) return fail("expired_link");
      if (["bad_code_verifier", "pkce_verifier_not_found", "pkce_code_verifier_not_found", "pkce_verifier_invalid"].includes(error.code)) return fail("missing_verifier");
      return fail("callback_failed");
    }
    if (!data?.session || !data?.user?.email) {
      if (data?.session) await client.auth.signOut({ scope: "local" });
      return fail("callback_failed");
    }
    return { destination: safeAuthNext(params.get("next")), success: true };
  } catch { return fail("service_unavailable"); }
}
