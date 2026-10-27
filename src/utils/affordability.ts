// "Can I afford this?" (KOVA-085). Answered on the phone from the user's own logs: no AI call, no reply
// counted, and every number is computed here, never guessed. Kova shows the trade-off; it never says yes or no.
// Tested in affordability.test.ts.
import { AffordCardData, Expense, SavingsGoal } from '../types';
import { convertCurrency, getCurrencySymbol } from './currency';
import { getGoalKind, isGoalTransfer } from './goalKind';
import { parseExpenseDate } from './expenseDates';

const DAY_MS = 86_400_000;

// ---------- Understanding the question ----------

const TRIGGERS: RegExp[] = [
  /\bcan i (really )?afford( to (buy|get|spend|pay for))?\b/,
  /\b(could|would) i afford( to (buy|get|spend|pay for))?\b/,
  /\bshould i (buy|get|spend|order|book|pay for|splurge on|treat myself to)\b/,
  /\bis it (ok|okay|fine|wise|smart|a good idea|too much) (for me )?to (buy|get|spend|pay for|order|book)\b/,
  /\bcan i (buy|get|spend)\b/,
  /\bafford\b/,
];

const CURRENCY_WORDS: Array<[RegExp, string]> = [
  [/^(fcfa|xaf|cfa|francs?)$/i, 'XAF'],
  [/^(usd|dollars?)$/i, 'USD'],
  [/^(eur|euros?)$/i, 'EUR'],
  [/^(gbp|pounds?)$/i, 'GBP'],
  [/^(ngn|naira)$/i, 'NGN'],
];
const SYMBOLS: Record<string, string> = { '€': 'EUR', '£': 'GBP', '₦': 'NGN' };

export interface ParsedAmount {
  amount: number;
  currency: string | null; // currency named in the text, if any
}

const AMOUNT_RE =
  /([$€£₦])?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(k\b)?\s*(fcfa|xaf|cfa|francs?|usd|dollars?|eur|euros?|gbp|pounds?|ngn|naira)?/gi;
const STANDALONE_AMOUNT_RE = new RegExp(`(?<![A-Za-z0-9-])(?:${AMOUNT_RE.source})(?![A-Za-z0-9-])`, 'gi');
const PRICE_WORD_BEFORE = /\b(for|at|costs?|costing|price[ds]?|worth|spend|spending|of|about|around|is|be)\s*$/i;

function currencyFrom(symbol: string | undefined, word: string | undefined, profileCurrency: string): string | null {
  if (word) {
    for (const [re, code] of CURRENCY_WORDS) if (re.test(word)) return code;
  }
  if (!symbol) return null;
  if (symbol === '$') return getCurrencySymbol(profileCurrency).includes('$') ? profileCurrency : 'USD';
  return SYMBOLS[symbol] || null;
}

/** The price in a message. Prefers a number with a currency, then one after "for/at/costs…", then the last one. */
export function findAmount(text: string, profileCurrency = 'USD'): ParsedAmount | null {
  type Candidate = ParsedAmount & { score: number; index: number };
  const candidates: Candidate[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const [, symbol, whole, cents, k, word] = m;
    let amount = Number(whole.replace(/,/g, '')) + (cents ? Number(`0.${cents}`) : 0);
    if (k) amount *= 1000;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const start = m.index ?? 0;
    const before = text.slice(0, start);
    const after = text.slice(start + m[0].length);
    const currency = currencyFrom(symbol, word, profileCurrency);
    const score =
      (symbol || word ? 4 : 0) + (k ? 2 : 0) + (PRICE_WORD_BEFORE.test(before) ? 2 : 0) + (/^[^a-z0-9]*$/i.test(after) ? 1 : 0);
    // A bare number before a word is usually a count ("2 shirts"), not a price.
    if (score === 0) continue;
    candidates.push({ amount, currency, score, index: start });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || b.index - a.index);
  const { amount, currency } = candidates[0];
  return { amount, currency };
}

export interface AffordRequest {
  item: string; // "headphones", or "it" when nothing was named
  price: ParsedAmount | null; // null: Kova asks "How much is it?"
}

const FILLER_EDGE = /^(?:for|at|on|of|to|a|an|the|some|this|that|these|those|me|my|right now|now|today|this month|costing|worth|which|that costs?|it'?s|is)\s+|\s+(?:for|at|on|of|to|which|that|costing|worth|right now|now|today|this month|costs?|is)$/i;

/** Null when the message isn't an affordability question (plain logs like "bought headphones 120" stay logs). */
export function parseAffordRequest(text: string, profileCurrency = 'USD'): AffordRequest | null {
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!lower || lower.length > 160) return null;
  const trigger = TRIGGERS.map((re) => lower.match(re)).find(Boolean);
  if (!trigger) return null;

  const price = findAmount(text, profileCurrency);
  let rest = lower.slice((trigger.index ?? 0) + trigger[0].length);
  // Only standalone numbers are prices. Numbers inside a model name stay ("WH-1000XM5", "iPhone16"),
  // so the item can be looked up exactly (KOVA-105).
  rest = rest.replace(STANDALONE_AMOUNT_RE, ' ').replace(/[?!,]+/g, ' ').replace(/\.(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 6; i++) {
    const next = rest.replace(FILLER_EDGE, '').trim();
    if (next === rest) break;
    rest = next;
  }
  if (rest.split(' ').length > 6) rest = rest.split(' ').slice(0, 6).join(' ');
  return { item: rest || 'it', price };
}

/** The answer to "How much is it?": a short message that is mostly a number. */
export function parseAmountReply(text: string, profileCurrency = 'USD'): ParsedAmount | null {
  const t = text.trim();
  if (!t || t.length > 40) return null;
  const leftover = t.replace(AMOUNT_RE, '').replace(/\b(about|around|it'?s|its|it is|roughly|like|maybe|just)\b/gi, '').replace(/[^a-z]/gi, '');
  if (leftover.length > 8) return null;
  return findAmount(t, profileCurrency);
}

// ---------- Working out the trade-off ----------

function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

function average(values: number[]): number | null {
  const v = values.filter((x) => x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function activeGoals(goals: SavingsGoal[]): SavingsGoal[] {
  return goals.filter(
    (g) =>
      !g.isArchived &&
      g.status !== 'archived' &&
      g.status !== 'achieved' &&
      Number(g.targetAmount) > 0 &&
      Number(g.currentAmount) < Number(g.targetAmount)
  );
}

/** Net amount added per day to a goal lately (last 90 days, or since the first entry if newer; at least 14 days). */
export function goalDailyPace(goal: SavingsGoal, currency: string, now: Date): number {
  const entries = (goal.contributions || [])
    .map((c) => ({ c, t: new Date(c.timestamp).getTime() }))
    .filter((x) => Number.isFinite(x.t) && x.t <= now.getTime());
  if (!entries.length) return 0;
  const first = Math.min(...entries.map((x) => x.t));
  const days = Math.min(90, Math.max(14, (now.getTime() - first) / DAY_MS));
  const since = now.getTime() - days * DAY_MS;
  const net = entries
    .filter((x) => x.t >= since)
    .reduce((sum, { c }) => sum + convertCurrency(c.amount, c.nativeCurrency || goal.nativeCurrency || currency, currency), 0);
  return net > 0 ? net / days : 0;
}

export interface AffordInput {
  item: string;
  price: number; // already in `currency`
  currency: string;
  expenses: Expense[];
  goals: SavingsGoal[];
  now?: Date;
}

export function buildAffordCard({ item, price, currency, expenses, goals, now = new Date() }: AffordInput): AffordCardData {
  const thisMonth = monthIndex(now);
  const spentByMonth = new Map<number, number>();
  const incomeByMonth = new Map<number, number>();

  for (const e of expenses) {
    if (isGoalTransfer(e)) continue;
    const d = parseExpenseDate(e.timestamp);
    if (d.getTime() > now.getTime()) continue;
    const m = monthIndex(d);
    if (m < thisMonth - 3 || m > thisMonth) continue;
    const amount = convertCurrency(e.amount, e.nativeCurrency || 'USD', currency);
    const bucket = e.type === 'income' ? incomeByMonth : spentByMonth;
    bucket.set(m, (bucket.get(m) || 0) + amount);
  }

  const previous = [1, 2, 3].map((i) => thisMonth - i);
  const spentSoFar = spentByMonth.get(thisMonth) || 0;
  const usualMonth = average(previous.map((m) => spentByMonth.get(m) || 0));
  const usualIncome = average(previous.map((m) => incomeByMonth.get(m) || 0));
  const incomeBasis = Math.max(incomeByMonth.get(thisMonth) || 0, usualIncome || 0);
  const leftAfter = incomeBasis > 0 ? incomeBasis - spentSoFar - price : null;

  const candidates = activeGoals(goals);
  const goal = [...candidates].sort(
    (a, b) => b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount
  )[0];
  let goalImpact: AffordCardData['goal'] = null;
  if (goal) {
    const pace = goalDailyPace(goal, currency, now);
    goalImpact = {
      title: goal.title,
      kind: getGoalKind(goal),
      delayDays: pace > 0 ? Math.max(1, Math.round(price / pace)) : null,
    };
  }

  return {
    item,
    price,
    currency,
    monthLabel: now.toLocaleDateString('en-US', { month: 'long' }),
    spentSoFar,
    usualMonth,
    leftAfter,
    goal: goalImpact,
    otherGoals: Math.max(0, candidates.length - 1),
  };
}

/** "about 9 days", "about 3 weeks", "about 2 months". */
export function describeDelay(days: number): string {
  if (days < 14) return `about ${days} ${days === 1 ? 'day' : 'days'}`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30);
  return `about ${months} ${months === 1 ? 'month' : 'months'}`;
}

/** True when there's too little history to say anything beyond this month's total. */
export function isThinCard(card: AffordCardData): boolean {
  return card.usualMonth === null && card.leftAfter === null && !(card.goal && card.goal.delayDays);
}
