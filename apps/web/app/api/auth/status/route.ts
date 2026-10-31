import { authConfigurationStatus } from "../../../lib/auth-environment.mjs";

export async function GET() {
  const providers = authConfigurationStatus();
  return Response.json(
    providers,
    { status: providers.available ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
