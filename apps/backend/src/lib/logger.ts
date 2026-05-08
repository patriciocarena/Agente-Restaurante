// SEC-05 / D-07: customer_phone is PII under Ley 25.326 AR. Never write it raw to logs.
// This module exposes a logger that automatically redacts known PII fields from any
// structured metadata object. Routes that touch orders MUST use this logger and never
// console.* directly.

const PII_KEYS = new Set(['customer_phone', 'phone', 'caller_phone']);

export function redactPII<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((v) => redactPII(v)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (PII_KEYS.has(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactPII(v);
      }
    }
    return out as T;
  }
  return input;
}

function emit(level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) {
  const line = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...(meta ? { meta: redactPII(meta) } : {}),
  };
  // Plain stdout JSON line — Railway captures stdout.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
};
