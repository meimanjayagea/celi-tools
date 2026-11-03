export function isPublicAddress(address: string): boolean;
export function validateProxyRequest(input: unknown): { url: URL; method: string; headers: Record<string, string>; body: string | Buffer };
export function classifyProxyBody(buffer: Buffer, contentType?: string): {text: string; base64: string; contentType: string; previewType: string | null};
export function responseHeaderRows(rawHeaders: string[]): {key: string; value: string}[];
export function executeProxyRequest(input: unknown, signal?: AbortSignal): Promise<{ status: number; statusText: string; milliseconds: number; bytes: number; headers: {key: string; value: string}[]; text: string; base64: string; contentType: string; previewType: string | null; truncated: boolean }>;
