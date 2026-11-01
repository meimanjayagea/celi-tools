import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Keep every Vercel alias on the Auth.js origin. OAuth's short-lived PKCE
 * cookie is host-only, so starting on one alias and returning to AUTH_URL
 * would otherwise lose the cookie before Google sends the callback.
 */
export function proxy(request: NextRequest) {
  const configuredOrigin = process.env.AUTH_URL;
  if (!configuredOrigin) return NextResponse.next();

  let canonical: URL;
  try {
    canonical = new URL(configuredOrigin);
  } catch {
    return NextResponse.next();
  }

  const localHttp = canonical.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(canonical.hostname);
  if ((canonical.protocol !== "https:" && !localHttp) || canonical.pathname !== "/" || canonical.search || canonical.hash) {
    return NextResponse.next();
  }

  if (request.nextUrl.origin === canonical.origin) return NextResponse.next();

  const destination = new URL(request.nextUrl.pathname + request.nextUrl.search, canonical.origin);
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
