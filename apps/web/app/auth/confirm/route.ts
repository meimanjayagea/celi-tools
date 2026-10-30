import { authCallbackResponse } from "../../lib/auth-backend";
export async function GET(request: Request) { return authCallbackResponse(request, true); }
