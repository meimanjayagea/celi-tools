import { liveAuthConfigurationStatus } from "../../../../auth";

export async function GET() {
  const providers = await liveAuthConfigurationStatus();
  return Response.json(
    providers,
    { status: providers.available ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
