// Subscription radar (KOVA-086). Finds payments that repeat in the user's own logs and imports, predicts
// the next one from the rhythm of past charges, and decides when Kova should mention it. Runs on the
// phone: no AI, nothing sent anywhere. Tested in subscriptionRadar.test.ts.
import { Expense, SavingsGoal, SubscriptionNote, SubscriptionRadarCardData } from '../types';
import { detectRecurring, merchantKey, prettyName, Interval } from '../lib/paypalImport/analyze';
import type { ImportedTransaction } from '../lib/paypalImport/parsePayPal';
import { convertCurrency } from './currency';
import { isGoalTransfer } from './goalKind';
import { parseExpenseDate } from './expenseDates';
import { goalDailyPace, describeDelay } from './affordability';

const DAY_MS = 86_400_000;
export const WARN_DAYS = 3; // heads-up this many days before a renewal
const LATE_GRACE: Record<Interval, number> = { weekly: 2, monthly: 5, yearly: 10 };

export interface Subscription {
  key: string;
  name: string;
  amount: number; // latest charge, in the display currency
  interval: Interval;
  guess: boolean; // seen once (Subscriptions category), assumed monthly
  lastDate: string; // ISO
  nextDate: string; // YYYY-MM-DD, predicted
  monthlyCost: number;
  annualCost: number;
  note?: SubscriptionNote;
}

// "Netflix October", "Gym membership", "Spotify sub 2026" -> "Netflix", "Gym", "Spotify"
const NOISE =
  /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?|20\d\d|subscription|sub|payment|bill|monthly|annual|yearly|weekly|renewal|membership|plan|fee)\b/gi;

export function subscriptionName(label: string): string {
  const cleaned = label.replace(NOISE, ' ').replace(/\s+/g, ' ').trim() || label.trim();
  return prettyName(cleaned);
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole days from today to a YYYY-MM-DD date (negative when it's past). */
export function daysUntil(date: string, now: Date): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - startOfDay(now)) / DAY_MS);
}

export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Active subscriptions, soonest renewal first. Leaves out what the user said isn't a subscription, and
 * what they said stopped unless it has charged again since.
 */
export function findSubscriptions(
  expenses: Expense[],
  currency: string,
  notes: Record<string, SubscriptionNote> = {},
  now: Date = new Date()
): Subscription[] {
  const spend: ImportedTransaction[] = [];
  for (const e of expenses) {
    if (e.type !== 'outcome' || isGoalTransfer(e) || e.amount <= 0) continue;
    if (e.category === 'Housing') continue; // rent repeats, but it isn't a subscription
    const when = parseExpenseDate(e.timestamp);
    if (when.getTime() > now.getTime()) continue;
    spend.push({
      id: e.id,
      date: when.toISOString(),
      amount: convertCurrency(e.amount, e.nativeCurrency || 'USD', currency),
      currency,
      direction: 'out',
      merchant: subscriptionName(e.label || ''),
      type: e.category === 'Subscriptions' ? 'subscription_payment' : 'purchase',
    });
  }

  const asOfDay = Math.floor(now.getTime() / DAY_MS);
  const out: Subscription[] = [];
  for (const r of detectRecurring(spend, asOfDay)) {
    if (!r.stillActive) continue;
    // Two charges at different prices is a coincidence (two Amazon orders), not a subscription.
    if (r.occurrences < 3 && r.priceChange && !r.intervalAssumed) continue;
    const note = notes[r.key];
    const chargedSinceNote = note?.decidedAt ? new Date(r.lastDate).getTime() > new Date(note.decidedAt).getTime() : false;
    if (note?.status === 'not_subscription') continue; // the user's call; repeating charges don't override it
    if (note?.status === 'stopped' && !chargedSinceNote) continue; // comes back if it charges again
    // A cancel that didn't go through: it charged again, so the note no longer applies.
    const activeNote = note?.status === 'cancelling' && chargedSinceNote ? { ...note, status: undefined } : note;
    out.push({
      key: r.key,
      name: r.merchant,
      amount: r.latestAmount,
      interval: r.interval,
      guess: r.intervalAssumed,
      lastDate: r.lastDate,
      nextDate: dayKey(new Date(r.nextExpected)),
      monthlyCost: r.monthlyCost,
      annualCost: r.annualCost,
      ...(activeNote ? { note: activeNote } : {}),
    });
  }
  return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

export function buildRadarCard(subs: Subscription[], currency: string): SubscriptionRadarCardData {
  const counted = subs.filter((s) => s.note?.status !== 'cancelling');
  return {
    currency,
    monthlyTotal: counted.reduce((sum, s) => sum + s.monthlyCost, 0),
    annualTotal: counted.reduce((sum, s) => sum + s.annualCost, 0),
    rows: subs.map((s) => ({
      name: s.name,
      amount: s.amount,
      interval: s.interval,
      nextLabel: `around ${dateLabel(s.nextDate)}`,
      guess: s.guess,
      cancelling: s.note?.status === 'cancelling',
    })),
  };
}

export type RadarNudge =
  | { kind: 'renews_soon'; sub: Subscription; inDays: number }
  | { kind: 'did_it_renew'; sub: Subscription };

/**
 * What Kova should mention when the app opens: renewals within WARN_DAYS that the user hasn't decided
 * about, and expected charges that didn't show up. Each renewal is mentioned at most once.
 */
export function radarNudges(subs: Subscription[], now: Date = new Date(), max = 2): RadarNudge[] {
  const out: RadarNudge[] = [];
  for (const sub of subs) {
    const status = sub.note?.status;
    const inDays = daysUntil(sub.nextDate, now);
    if (inDays >= 0 && inDays <= WARN_DAYS) {
      if (status === 'kept' || status === 'cancelling') continue;
      if (sub.note?.nudgedFor === sub.nextDate) continue;
      out.push({ kind: 'renews_soon', sub, inDays });
    } else if (inDays < -LATE_GRACE[sub.interval]) {
      if (status === 'cancelling') continue; // the cancel probably worked; the radar drops it soon after
      if (sub.note?.askedRenewedFor === sub.nextDate) continue;
      out.push({ kind: 'did_it_renew', sub });
    }
  }
  return out.slice(0, max);
}

export function renewsInText(inDays: number): string {
  if (inDays === 0) return 'renews today';
  if (inDays === 1) return 'renews tomorrow';
  return `renews in about ${inDays} days`;
}

/** "That frees about $186 a year, or your Emergency fund about 12 days sooner." */
export function cancelSavingsText(
  sub: Subscription,
  currency: string,
  goals: SavingsGoal[],
  money: (n: number) => string,
  now: Date = new Date()
): string {
  const base = `That frees about ${money(sub.annualCost)} a year`;
  const goal = goals
    .filter((g) => !g.isArchived && g.status === 'active' && g.targetAmount > g.currentAmount)
    .map((g) => ({ g, pace: goalDailyPace(g, currency, now) }))
    .filter((x) => x.pace > 0)
    .sort((a, b) => b.g.currentAmount / b.g.targetAmount - a.g.currentAmount / a.g.targetAmount)[0];
  if (!goal) return `${base}.`;
  const days = Math.max(1, Math.round(sub.annualCost / goal.pace));
  return `${base}, or your ${goal.g.title} ${describeDelay(days)} sooner if it went there.`;
}

/** Finds the subscription a quick reply refers to ("Keep Netflix" -> Netflix). */
export function findByName(subs: Subscription[], name: string): Subscription | undefined {
  const key = merchantKey(name);
  return subs.find((s) => s.key === key || s.name.toLowerCase() === name.toLowerCase().trim());
}

/** "Show my subscriptions", "what am I subscribed to", "recurring payments"... */
export function isSubscriptionRadarRequest(lower: string): boolean {
  const t = lower.replace(/[?.!]+$/g, '').trim();
  if (t.length > 80) return false;
  return (
    /\b(show|see|list|view|check|what are|which are)\b.*\bsubscriptions\b/.test(t) ||
    /^(my )?subscriptions( radar)?$/.test(t) ||
    /\bsubscription radar\b/.test(t) ||
    /\bwhat (am i|are i'?m|do i)( currently)? (subscribed|paying for every month|paying monthly)\b/.test(t) ||
    /\b(recurring|repeating) (charges|payments|bills)\b/.test(t)
  );
}
