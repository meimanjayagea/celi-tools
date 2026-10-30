import { processFileRequest, fileErrorResponse } from "../../../lib/file-backend";
export async function POST(request: Request) {
  try { return await processFileRequest(request, "convert"); }
  catch (error) { return fileErrorResponse(error); }
}
