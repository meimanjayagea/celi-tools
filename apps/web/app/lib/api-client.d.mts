export type RequestRow = { key: string; value: string };
export type ImportedRequest = { name: string; method: string; url: string; headers: RequestRow[]; body: string };
export function replaceQuery(url: string, rows: RequestRow[]): string;
export function validateRequest(request: Pick<ImportedRequest, "method" | "url" | "headers" | "body">): { url: string; method: string; headers: Headers; body: string | undefined };
export function executeApiRequest(request: ReturnType<typeof validateRequest>, signal?: AbortSignal): Promise<{ status: number; statusText: string; milliseconds: number; bytes: number; text: string; truncated: boolean }>;
export function parseCurl(text: string): ImportedRequest;
export function parseRequestJson(text: string): ImportedRequest[];
