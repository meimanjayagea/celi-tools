const retryableStatuses = new Set([408, 425, 429]);
const quotaCodes = /(?:insufficient[_ -]?quota|quota[_ -]?(?:exceeded|exhausted)|resource[_ -]?exhausted|billing[_ -]?(?:hard[_ -]?limit|limit)|rate[_ -]?limit|too[_ -]?many[_ -]?requests)/i;
const networkCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET"]);

function collectFailureDetails(error) {
  const details = [];
  const queue = [{ value:error, depth:0 }];
  const seen = new Set();
  while (queue.length && details.length < 24) {
    const { value, depth } = queue.shift();
    if (!value || (typeof value !== "object" && typeof value !== "string") || seen.has(value) || depth > 3) continue;
    if (typeof value === "string") { details.push(value.slice(0, 2000)); continue; }
    seen.add(value);
    for (const field of ["status", "statusCode", "code", "message", "responseBody", "body", "error"]) {
      const child = value[field];
      if (typeof child === "number" && (field === "status" || field === "statusCode")) details.push(child);
      else if (typeof child === "string") {
        details.push(child.slice(0, 2000));
        if ((field === "responseBody" || field === "body") && child.length < 4000) {
          try { queue.push({ value:JSON.parse(child), depth:depth+1 }); } catch {}
        }
      } else if (child && typeof child === "object") queue.push({ value:child, depth:depth+1 });
    }
    if (value.cause && typeof value.cause === "object") queue.push({ value:value.cause, depth:depth+1 });
    if (value.response && typeof value.response === "object") queue.push({ value:value.response, depth:depth+1 });
  }
  return details;
}

export function classifyProviderFailure(error) {
  if (error?.name === "AbortError") return { retryable:false, category:"aborted" };
  if (error?.name === "TimeoutError") return { retryable:true, category:"network" };
  const details = collectFailureDetails(error);
  const numbers = details.filter((value) => typeof value === "number");
  const strings = details.filter((value) => typeof value === "string");
  if (strings.some((value) => quotaCodes.test(value))) return { retryable:true, category:"quota_or_rate_limit" };
  const status = numbers.find((value) => value >= 100 && value <= 599);
  if (status === 429 || (status !== undefined && retryableStatuses.has(status))) return { retryable:true, category:"rate_limit" };
  if (status !== undefined && status >= 500) return { retryable:true, category:"provider_unavailable" };
  if (strings.some((value) => networkCodes.has(value))) return { retryable:true, category:"network" };
  if (strings.some((value) => /\bfetch failed\b/i.test(value))) return { retryable:true, category:"network" };
  return { retryable:false, category:status === 401 || status === 403 ? "credentials_or_access" : "non_retryable" };
}

export async function* streamWithFallback({ profiles, signal, maxAttempts=profiles.length, createStream, classify=classifyProviderFailure }) {
  const candidates=profiles.slice(0,Math.max(0,Math.min(maxAttempts,profiles.length)));
  let lastError;
  for (const profile of candidates) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    let emittedText=false;
    try {
      const stream=await createStream(profile,signal);
      for await (const text of stream) {
        if (typeof text !== "string" || !text) continue;
        emittedText=true;
        yield text;
      }
      return;
    } catch (error) {
      lastError=error;
      if (signal?.aborted) throw signal.reason ?? error;
      const failure=classify(error);
      if (emittedText || !failure.retryable) throw error;
    }
  }
  if (lastError) throw lastError;
  throw new Error("No eligible AI provider is configured.");
}
