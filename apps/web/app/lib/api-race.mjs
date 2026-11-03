/** Validate a bounded batch and an optional future, one-time browser schedule. */
export function validateRaceOptions({ count, schedule, now = Date.now() }) {
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Jumlah request harus berupa angka 1–1000.');
  if (!schedule) return { count, scheduledAt: null };
  const scheduledAt = new Date(schedule).getTime();
  if (!Number.isFinite(scheduledAt) || scheduledAt <= now) throw new Error('Jadwal harus berada di masa depan.');
  if (scheduledAt - now > 24 * 60 * 60 * 1000) throw new Error('Jadwal maksimum 24 jam dari sekarang.');
  return { count, scheduledAt };
}

/** Start the entire bounded batch immediately; the browser may queue network connections. */
export async function runRace(request, { count, signal, fetcher = fetch, timeoutMs = 60000, onProgress } = {}) {
  validateRaceOptions({ count, schedule: '' });
  const batch = new AbortController();
  const abort = () => batch.abort(signal?.reason || 'canceled');
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => batch.abort('timeout'), timeoutMs);
  const started = performance.now(), statuses = {}, latencies = [];
  let networkErrors = 0, aborted = 0, completed = 0;
  try {
    await Promise.all(Array.from({ length: count }, async () => {
      const start = performance.now();
      try {
        if (batch.signal.aborted) throw new Error('aborted');
        const response = await fetcher(request.url, { method: request.method, headers: request.headers, body: request.body, credentials: 'omit', referrerPolicy: 'no-referrer', signal: batch.signal });
        statuses[response.status] = (statuses[response.status] || 0) + 1;
        latencies.push(performance.now() - start);
        if (response.body) void response.body.cancel().catch(() => {});
      } catch {
        if (batch.signal.aborted) aborted++; else networkErrors++;
      } finally { completed++; onProgress?.(completed); }
    }));
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  latencies.sort((a, b) => a - b);
  return { count, completed, statuses, networkErrors, aborted, canceled: batch.signal.aborted && batch.signal.reason !== 'timeout', timedOut: batch.signal.reason === 'timeout', durationMs: Math.round(performance.now() - started), minMs: latencies.length ? Math.round(latencies[0]) : null, maxMs: latencies.length ? Math.round(latencies.at(-1)) : null, averageMs: latencies.length ? Math.round(latencies.reduce((a,b) => a+b, 0) / latencies.length) : null };
}
