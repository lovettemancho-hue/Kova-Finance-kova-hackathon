// Free vs Premium limits (PR 1 of the Free vs Premium plan, KOVA-072).
//
// This file is the single source of truth. The server enforces it (server/usage.ts) and the app
// reads it from GET /api/me/entitlement, so the paywall can never promise something the server
// doesn't do. Change a number here and both follow.
//
// Pure functions only (no Firebase), so they can be unit-tested: server/plans.test.ts.

import type { Tone } from './tone';

export type Plan = 'free' | 'premium';

/** Things that cost money and are counted per user. */
export type QuotaKey = 'chat' | 'coach' | 'paypalCheckin' | 'csvImport' | 'letter';

export type QuotaPeriod = 'day' | 'month';

export const QUOTA_PERIOD: Record<QuotaKey, QuotaPeriod> = {
  chat: 'day', // AI chat replies (plain expense logging never counts, see isPlainLogCommand)
  coach: 'day', // goal coach replies
  paypalCheckin: 'month',
  csvImport: 'month',
  letter: 'month', // monthly letter generations (first one + regenerations)
};

export interface PlanLimits {
  quotas: Record<QuotaKey, number>; // 0 = not included in this plan
  maxActiveGoals: number;
  analyticTone: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    quotas: { chat: 10, coach: 0, paypalCheckin: 1, csvImport: 1, letter: 1 },
    maxActiveGoals: 1,
    analyticTone: false,
  },
  premium: {
    quotas: { chat: 100, coach: 20, paypalCheckin: 30, csvImport: 5, letter: 4 },
    maxActiveGoals: 50,
    analyticTone: true,
  },
};

/** Calendar keys in UTC: daily quotas reset at 00:00 UTC, monthly ones on the 1st. */
export function periodKey(period: QuotaPeriod, now: Date): string {
  const iso = now.toISOString();
  return period === 'day' ? iso.slice(0, 10) : iso.slice(0, 7);
}

/** When the current period ends (start of the next one), as an ISO string. */
export function periodResetsAt(period: QuotaPeriod, now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const next = period === 'day' ? new Date(Date.UTC(y, m, d + 1)) : new Date(Date.UTC(y, m + 1, 1));
  return next.toISOString();
}

/**
 * Stored usage for one user (Firestore `usage/{uid}`, server-only).
 * `periods[key]` is the period the count belongs to; a different period means the count is stale.
 */
export interface UsageDoc {
  counts?: Partial<Record<QuotaKey, number>>;
  periods?: Partial<Record<QuotaKey, string>>;
}

export interface QuotaDecision {
  allowed: boolean;
  used: number; // after this request (unchanged when not allowed)
  limit: number;
  period: QuotaPeriod;
  resetsAt: string;
  next: UsageDoc; // what to store (same as input when not allowed)
}

/** Current count for a key, treating counts from an older period as 0. */
export function usedInPeriod(doc: UsageDoc | undefined, key: QuotaKey, now: Date): number {
  const period = QUOTA_PERIOD[key];
  if (doc?.periods?.[key] !== periodKey(period, now)) return 0;
  const n = Number(doc?.counts?.[key] || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Decides whether one more `key` is allowed for this plan, and the usage to store if so. */
export function decideQuota(doc: UsageDoc | undefined, plan: Plan, key: QuotaKey, now: Date): QuotaDecision {
  const period = QUOTA_PERIOD[key];
  const limit = PLAN_LIMITS[plan].quotas[key];
  const used = usedInPeriod(doc, key, now);
  const resetsAt = periodResetsAt(period, now);
  const current: UsageDoc = { counts: { ...(doc?.counts || {}) }, periods: { ...(doc?.periods || {}) } };

  if (used >= limit) {
    return { allowed: false, used, limit, period, resetsAt, next: current };
  }
  current.counts![key] = used + 1;
  current.periods![key] = periodKey(period, now);
  return { allowed: true, used: used + 1, limit, period, resetsAt, next: current };
}

/** Gives one use back (e.g. the AI call failed). Never goes below 0 or touches an older period. */
export function refundQuota(doc: UsageDoc | undefined, key: QuotaKey, now: Date): UsageDoc {
  const next: UsageDoc = { counts: { ...(doc?.counts || {}) }, periods: { ...(doc?.periods || {}) } };
  const used = usedInPeriod(doc, key, now);
  if (used > 0) next.counts![key] = used - 1;
  return next;
}

/** Usage summary for the app: { chat: { used, limit, period, resetsAt }, ... }. */
export function usageSummary(doc: UsageDoc | undefined, plan: Plan, now: Date) {
  const out = {} as Record<QuotaKey, { used: number; limit: number; period: QuotaPeriod; resetsAt: string }>;
  for (const key of Object.keys(QUOTA_PERIOD) as QuotaKey[]) {
    const period = QUOTA_PERIOD[key];
    out[key] = {
      used: usedInPeriod(doc, key, now),
      limit: PLAN_LIMITS[plan].quotas[key],
      period,
      resetsAt: periodResetsAt(period, now),
    };
  }
  return out;
}

// ---- Logging without AI ------------------------------------------------------------------------

/**
 * True for messages that only log a transaction, e.g. "log coffee 50", "paid rent 1500",
 * "spent 22 on lunch", "coffee 4.50". These are handled without Gemini and never count toward the
 * chat limit (logging is always free). Questions, plans and anything ambiguous go to the AI.
 */
export function isPlainLogCommand(message: string): boolean {
  const text = (message || '').trim().toLowerCase();
  if (!text || text.length > 80) return false;
  if (text.includes('?')) return false;
  // Hypotheticals, plans and income stay with the AI (it asks about goals for income).
  if (/\b(if|would|should|could|might|plan|planning|want|need|thinking|budget|save|saving|salary|income|paid me|got paid|earned|refund)\b/.test(text)) {
    return false;
  }
  // Moving money into a goal is handled by the app's allocation flow, not here.
  if (/\b(toward|towards|into|to my|goal|fund)\b/.test(text)) return false;
  const hasAmount = /\d/.test(text);
  if (!hasAmount) return false;
  const startsWithLogVerb = /^(log|logged|add|spent|paid|bought|purchased)\b/.test(text);
  const shortLabelThenAmount = /^[a-z][a-z\s'&-]{1,30}\s+[$€£¥₦]?\d[\d,]*(\.\d{1,2})?$/.test(text);
  return startsWithLogVerb || shortLabelThenAmount;
}

/** Money-like numbers in free text: "3,000", "1500", "22.50", "5k". Ignores times, dates, percents.
 *  Spaces are not treated as thousands separators ("3 500ml" must not become 3500). (KOVA-064) */
export function amountsInText(text: string): number[] {
  if (!text) return [];
  const cleaned = text
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ') // times like 10:30
    .replace(/\b\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}\b/g, ' ') // dates like 20/10/2026
    .replace(/\d+(?:\.\d+)?\s*%/g, ' '); // percentages
  const out: number[] = [];
  const re = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?![\d,]*\d)\s*(k\b)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    let value = parseFloat(m[1].replace(/,/g, '') + (m[2] ? `.${m[2]}` : ''));
    if (m[3]) value *= 1000;
    if (Number.isFinite(value) && value > 0) out.push(Math.round(value * 100) / 100);
  }
  return out;
}

const LOG_CATEGORIES: Array<[RegExp, string]> = [
  [/\b(card payment|credit card|loan|debt|repay)/, 'Debt repayment'],
  [/\b(coffee|latte|espresso|cappuccino|starbucks)\b/, 'Coffee'],
  [/\b(grocer|groceries|supermarket|market)\b/, 'Grocery'],
  [/\b(gym|fitness|workout)\b/, 'Gym'],
  [/\b(rent|mortgage)\b/, 'Housing'],
  [/\b(uber|bolt|taxi|bus|train|fuel|petrol|gas|flight|airbnb|hotel)\b/, 'Travel'],
  [/\b(netflix|spotify|subscription|youtube|icloud|prime)\b/, 'Subscriptions'],
  [/\b(laundry|dry clean)/, 'Laundry'],
  [/\b(mechanic|car repair|tyre|tire)\b/, 'Car repair'],
  [/\b(breakfast|lunch|dinner|restaurant|pizza|burger|takeaway|food)\b/, 'Dining out'],
  [/\b(clothes|shoes|shirt|amazon|shopping|jeans|dress)\b/, 'Shopping'],
];

export interface PlainLog {
  label: string;
  category: string;
  amount: number;
  type: 'outcome';
}

/**
 * Parses a plain logging message without AI, or returns null (then the AI handles it).
 * Needs isPlainLogCommand() to be true and exactly one amount, so nothing is guessed.
 */
/** Feelings people add to a log ("…feeling a bit guilty"). Kept out of the label; Kova answers them (KOVA-099). */
const FEELING = /\b(guilty|bad|stressed|anxious|ashamed|worried|terrible|awful|silly|dumb|stupid|nervous|regret\w*|sad|upset)\b/i;
const CLAUSE_START = /,|;|\.|!|\bfeel(?:ing)?\b|\bi'?m\b|\bim\b|\bi am\b|\bkinda\b|\bkind of\b/gi;
const TIME_WORDS = /\b(today|yesterday|tonight|this (morning|afternoon|evening|week)|earlier|just now)\b/gi;

/** Splits "spent 12 on lunch today, feeling a bit guilty" into the log part and whether a feeling was named. */
export function splitFeeling(message: string): { core: string; feeling: boolean } {
  const at = message.search(FEELING);
  if (at < 0) return { core: message, feeling: false };
  const before = message.slice(0, at);
  let cut = at;
  for (const m of before.matchAll(CLAUSE_START)) cut = m.index!; // the clause nearest the feeling word
  const lead = /\s+(?:and|but)(?:\s+i)?\s*$/i.exec(message.slice(0, cut)); // "…and I feel bad"
  if (lead) cut = lead.index;
  return { core: message.slice(0, cut).trim(), feeling: true };
}

/** True when a plain log also says how the user feels about it, so the reply can answer that calmly. */
export function plainLogFeeling(message: string): boolean {
  return splitFeeling(message).feeling;
}

export function parsePlainLog(message: string): PlainLog | null {
  const { core } = splitFeeling(message);
  if (!isPlainLogCommand(core)) return null;
  const amounts = amountsInText(core);
  if (amounts.length !== 1) return null;
  const lower = core.toLowerCase();
  const category = LOG_CATEGORIES.find(([re]) => re.test(lower))?.[1] || 'Other';
  const label = core
    .replace(/[$€£¥₦]?\s*\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\s*k?|[$€£¥₦]?\s*\d+(?:\.\d{1,2})?\s*k?/i, ' ')
    .replace(TIME_WORDS, ' ')
    .replace(/^\s*(log|logged|add|spent|paid|bought|purchased)\b/i, ' ')
    .replace(/\b(new )?(expense|purchase)\b/gi, ' ')
    .replace(/^\s*(on|for|at|a|an)\b/i, ' ')
    .replace(/\b(on|for|at)\s*$/i, ' ')
    .replace(/[,;.!]+\s*$/, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const finalLabel = label.length >= 2 ? label : category === 'Other' ? 'Expense' : category;
  return {
    label: finalLabel.charAt(0).toUpperCase() + finalLabel.slice(1),
    category,
    amount: amounts[0],
    type: 'outcome',
  };
}

/**
 * Kova's reply to a plain log. Logging is a command, so every tone confirms it in one line. A named feeling
 * gets one more line in the user's tone (KOVA-100), with no numbers beyond the logged amount and no advice.
 */
export function plainLogReply(label: string, amountText: string, feeling: boolean, tone: Tone = 'gentle'): string {
  const logged = `Logged ${label.toLowerCase()}, ${amountText}.`;
  if (!feeling) return logged;
  switch (tone) {
    case 'straight':
      return `${logged} One entry. Your month's total is in Log.`;
    case 'analytic':
      return `${logged} To see it against this month, ask "How much did I spend this month?"`;
    case 'mentor':
      return `${logged} Noticing how a purchase feels is where lasting money habits start, and you just did that.`;
    default:
      return `${logged} No judgment here. It's noted, and you can see how this month looks any time.`;
  }
}
