import { authProviders } from "../../../lib/auth-backend";
export async function GET() {
  const providers = await authProviders();
  return Response.json(providers, { status: providers.available ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
