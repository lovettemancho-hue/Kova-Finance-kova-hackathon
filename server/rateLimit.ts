// Per-user rate limiting with no extra dependencies.
//
// Protects the routes that cost money (every call to Gemini) and keeps everything else
// from being hammered. It is called from requireAuth AFTER the token is verified, so the
// key is always a real, verified user id, never something a caller can invent.
//
// Limits are kept in server memory. If the app ever runs on several servers at once,
// each one counts separately, which is still a big improvement over no limit at all.

interface Rule {
  limit: number;
  windowMs: number;
  label: string;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Routes that call Gemini.
const AI_PATHS = new Set([
  '/api/chat',
  '/api/parse-csv',
  '/api/import/categorize',
  '/api/monthly-letter',
  '/api/goal-coach',
  '/api/grow-lesson',
  '/api/topic-opener',
  '/api/paypal/ask',
]);

const AI_RULES: Rule[] = [
  { limit: 20, windowMs: MINUTE, label: 'ai-minute' },
  { limit: 300, windowMs: HOUR, label: 'ai-hour' },
];

// The PayPal check-in is heavier (it reads a statement and calls Gemini), so it is stricter.
const CHECKIN_PATH = '/api/paypal/checkin';
const CHECKIN_RULES: Rule[] = [
  { limit: 6, windowMs: MINUTE, label: 'checkin-minute' },
  { limit: 30, windowMs: HOUR, label: 'checkin-hour' },
];

// Reporting an AI reply writes a stored document, so it is capped to stop flooding (KOVA-092).
const REPORT_PATH = '/api/ai-report';
const REPORT_RULES: Rule[] = [
  { limit: 10, windowMs: MINUTE, label: 'report-minute' },
  { limit: 50, windowMs: HOUR, label: 'report-hour' },
];

// Price lookups call Channel3, which costs credits (KOVA-101).
const PRICE_PATHS = new Set(['/api/price-lookup', '/api/price-watch', '/api/price-watch/updates']);
const PRICE_RULES: Rule[] = [
  { limit: 10, windowMs: MINUTE, label: 'price-minute' },
  { limit: 60, windowMs: HOUR, label: 'price-hour' },
];

const GENERAL_RULES: Rule[] = [{ limit: 120, windowMs: MINUTE, label: 'general-minute' }];

function rulesFor(path: string): Rule[] {
  if (path === CHECKIN_PATH) return CHECKIN_RULES;
  if (path === REPORT_PATH) return REPORT_RULES;
  if (PRICE_PATHS.has(path)) return PRICE_RULES;
  if (AI_PATHS.has(path)) return AI_RULES;
  return GENERAL_RULES;
}

// key = "<uid>|<rule label>" -> timestamps of recent allowed requests
const buckets = new Map<string, number[]>();

// A plain shape (not a union) so it also works under non-strict TypeScript settings.
export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number; // 0 when ok
  message: string; // empty when ok
}

export function checkRateLimit(uid: string, rawPath: string, now: number = Date.now()): RateLimitResult {
  const path = (rawPath || '').split('?')[0].replace(/\/+$/, '') || '/';
  const rules = rulesFor(path);

  // First pass: is any rule over its limit? (Rejected requests are NOT counted.)
  let worstWaitMs = 0;
  for (const rule of rules) {
    const key = `${uid}|${rule.label}`;
    const recent = (buckets.get(key) || []).filter((t) => now - t < rule.windowMs);
    buckets.set(key, recent);
    if (recent.length >= rule.limit) {
      const waitMs = rule.windowMs - (now - recent[0]);
      worstWaitMs = Math.max(worstWaitMs, waitMs);
    }
  }

  if (worstWaitMs > 0) {
    const retryAfterSec = Math.max(1, Math.ceil(worstWaitMs / 1000));
    return {
      ok: false,
      retryAfterSec,
      message: `You're moving fast. Please wait about ${retryAfterSec} seconds and try again.`,
    };
  }

  // Second pass: record this request against every rule.
  for (const rule of rules) {
    buckets.get(`${uid}|${rule.label}`)!.push(now);
  }
  return { ok: true, retryAfterSec: 0, message: '' };
}

/** Drops idle entries so memory can't grow forever. Exported for tests. */
export function sweepRateLimits(now: number = Date.now()): number {
  let removed = 0;
  for (const [key, stamps] of buckets) {
    const newest = stamps[stamps.length - 1];
    if (newest === undefined || now - newest > HOUR) {
      buckets.delete(key);
      removed++;
    }
  }
  return removed;
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}

const sweeper = setInterval(() => sweepRateLimits(), 5 * MINUTE);
if (typeof (sweeper as any).unref === 'function') (sweeper as any).unref();
