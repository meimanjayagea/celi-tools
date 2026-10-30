import { fileCapabilities, fileErrorResponse } from "../../../lib/file-backend";
export async function GET() {
  try { return Response.json(await fileCapabilities(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return fileErrorResponse(error); }
}
