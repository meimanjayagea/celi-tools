import { authConfigurationReady, handlers } from "../../../../auth";
import type { NextRequest } from "next/server";

function unavailable() {
  return Response.json({ error: "AUTH_NOT_CONFIGURED" }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  if (!authConfigurationReady()) return unavailable();
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (!authConfigurationReady()) return unavailable();
  return handlers.POST(request);
}
