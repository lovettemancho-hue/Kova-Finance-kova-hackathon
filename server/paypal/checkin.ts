// Pure helpers for the Money Check-in card (KOVA-079). No PayPal or Gemini calls here, so they
// can be unit-tested (server/paypal/checkin.test.ts).
//
// The server, not the AI, decides: the numbers shown, which items are flagged, the flag titles
// (the store name as it appears on a statement) and which actions a flag allows. The AI only
// writes the short sentences.

import { looksCryptic } from '../../src/lib/paypalImport/analyze';
import type { CheckinFacts, CheckinFlag, FlagType, PayPalSubscription, PayPalTransaction, SuggestedAction } from './types';

export const MAX_FLAGS = 4;
const FLAG_TYPES: FlagType[] = ['unfamiliar_charge', 'review_subscription', 'high_spend'];
const ACTIONS: SuggestedAction[] = ['cancel_subscription', 'draft_dispute', 'none'];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function clip(value: any, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** What one subscription costs per month and per year. */
export function subscriptionCost(s: Pick<PayPalSubscription, 'amount' | 'interval'>) {
  const perMonth = s.interval === 'YEAR' ? s.amount / 12 : s.interval === 'WEEK' ? (s.amount * 52) / 12 : s.amount;
  return { perMonth: round2(perMonth), perYear: round2(perMonth * 12) };
}

/** The facts strip on the card. Computed here; the AI never does arithmetic. */
export function computeFacts(
  transactions: PayPalTransaction[],
  subscriptions: PayPalSubscription[],
  periodDays: number
): CheckinFacts {
  const outgoing = transactions.filter((t) => t.direction === 'out' && t.type !== 'refund');
  const active = subscriptions.filter((s) => s.status === 'ACTIVE');
  const currency = outgoing[0]?.currency || active[0]?.currency || 'USD';
  return {
    periodDays,
    currency,
    paymentCount: outgoing.length,
    spentTotal: round2(outgoing.reduce((sum, t) => sum + t.amount, 0)),
    activeSubscriptions: active.length,
    subscriptionsPerMonth: round2(active.reduce((sum, s) => sum + subscriptionCost(s).perMonth, 0)),
    unfamiliarCount: new Set([
      ...active.filter((s) => looksCryptic(s.merchant)).map((s) => s.merchant),
      ...outgoing.filter((t) => !t.subscriptionId && looksCryptic(t.merchant)).map((t) => t.merchant),
    ]).size,
  };
}

/**
 * The opening of the summary, written by the server from the facts so it is always right
 * (e.g. never calls cancelled subscriptions "ongoing"). The AI may add one gentle sentence after it.
 */
export function factsSentence(f: CheckinFacts, money: (amount: number, currency: string) => string): string {
  const payments = `${f.paymentCount} payment${f.paymentCount === 1 ? '' : 's'} in the last ${f.periodDays} days, ${money(f.spentTotal, f.currency)} in total.`;
  const subs = f.activeSubscriptions
    ? ` ${f.activeSubscriptions} subscription${f.activeSubscriptions === 1 ? ' is' : 's are'} active, ${money(f.subscriptionsPerMonth, f.currency)} a month.`
    : ' No subscriptions are active right now.';
  const odd = f.unfamiliarCount ? ` ${f.unfamiliarCount === 1 ? 'One name looks' : `${f.unfamiliarCount} names look`} unfamiliar.` : '';
  return `${payments}${subs}${odd}`;
}

/** Keeps the AI's closing line only if it's one short sentence with no numbers (the card shows those). */
export function gentleLine(aiText: string): string {
  const first = clip(aiText, 400).split(/(?<=[.!?])\s+/)[0] || '';
  if (!first || first.length > 160) return '';
  // No counts of any kind, in digits or words: the facts sentence already gives the right ones.
  if (/\d/.test(first) || /\b(one|two|three|four|five|six|seven|eight|nine|ten|several|many|few)\b/i.test(first)) return '';
  return first;
}

/** Latest charge for a subscription, so an unfamiliar subscription can also get a "draft a message". */
function latestChargeFor(s: PayPalSubscription, outgoing: PayPalTransaction[]): PayPalTransaction | undefined {
  return outgoing
    .filter((t) => t.subscriptionId === s.id || (!t.subscriptionId && (t.merchant === s.merchant || t.merchant === s.planName)))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

export interface RawFlag {
  type?: string;
  title?: string;
  gentleExplanation?: string;
  suggestedAction?: string;
  subscriptionId?: string;
  transactionId?: string;
}

/**
 * Turns what the AI suggested into the flags the card shows.
 * - Every flag tied to a subscription or charge is titled with the store name (the statement name,
 *   e.g. "XK*DGTL SVCS 4471"), never the AI's wording.
 * - Every unfamiliar-looking name gets flagged even if the AI skipped it, with Cancel (if it's a
 *   subscription) and Draft a message.
 * - Unfamiliar items first, then subscriptions; at most MAX_FLAGS.
 */
/** A flag for one subscription: title, price and allowed actions all set here, never by the AI. */
export function subscriptionFlag(
  s: PayPalSubscription,
  outgoing: PayPalTransaction[],
  money: (amount: number, currency: string) => string,
  explanation?: string
): Omit<CheckinFlag, 'id'> {
  const cryptic = looksCryptic(s.merchant);
  const charge = cryptic ? latestChargeFor(s, outgoing) : undefined;
  const cost = subscriptionCost(s);
  return {
    type: cryptic ? 'unfamiliar_charge' : 'review_subscription',
    title: clip(s.merchant, 90),
    amountLabel: `${money(s.amount, s.currency)} ${s.interval === 'YEAR' ? 'a year' : s.interval === 'WEEK' ? 'a week' : 'a month'}`,
    // An unfamiliar name always gets the same plain question; the AI's wording is for the rest.
    gentleExplanation: cryptic
      ? `This name doesn't say much on its own. Does it look familiar? It adds up to ${money(cost.perYear, s.currency)} a year.`
      : clip(explanation, 240) || `Renews every month. Still using it?`,
    suggestedAction: 'cancel_subscription',
    subscriptionId: s.id,
    ...(charge ? { secondaryAction: 'draft_dispute' as SuggestedAction, transactionId: charge.id } : {}),
  };
}

/** A flag for one single charge the user may not recognise: the only action is a draft message. */
export function chargeFlag(
  t: PayPalTransaction,
  money: (amount: number, currency: string) => string,
  explanation?: string
): Omit<CheckinFlag, 'id'> {
  return {
    type: 'unfamiliar_charge',
    title: clip(t.merchant, 90),
    amountLabel: `${money(t.amount, t.currency)} on ${t.date.slice(0, 10)}`,
    gentleExplanation: clip(explanation, 240) || `This name doesn't say much. Does it look familiar?`,
    suggestedAction: 'draft_dispute',
    transactionId: t.id,
  };
}

export function finalizeFlags(
  rawFlags: RawFlag[],
  activeSubs: PayPalSubscription[],
  outgoing: PayPalTransaction[],
  money: (amount: number, currency: string) => string,
  idPrefix = `flag_${Date.now().toString(36)}`
): CheckinFlag[] {
  const bySubId = new Map(activeSubs.map((s) => [s.id, s]));
  const byTxId = new Map(outgoing.map((t) => [t.id, t]));
  const out: Omit<CheckinFlag, 'id'>[] = [];
  const usedSubs = new Set<string>();
  const usedTxs = new Set<string>();

  const subFlag = (s: PayPalSubscription, explanation?: string) => subscriptionFlag(s, outgoing, money, explanation);
  const txFlag = (t: PayPalTransaction, explanation?: string) => chargeFlag(t, money, explanation);

  // 1. The AI's flags, validated and re-titled.
  for (const raw of rawFlags || []) {
    const action: SuggestedAction = ACTIONS.includes(raw?.suggestedAction as SuggestedAction)
      ? (raw!.suggestedAction as SuggestedAction)
      : 'none';
    const sub = raw?.subscriptionId ? bySubId.get(raw.subscriptionId) : undefined;
    const tx = raw?.transactionId ? byTxId.get(raw.transactionId) : undefined;
    if (sub && !usedSubs.has(sub.id)) {
      usedSubs.add(sub.id);
      out.push(subFlag(sub, raw.gentleExplanation));
    } else if (tx && !usedTxs.has(tx.id) && !tx.subscriptionId) {
      usedTxs.add(tx.id);
      out.push(txFlag(tx, raw.gentleExplanation));
    } else if (!sub && !tx && action === 'none') {
      // A general observation (e.g. high spending): no action, AI wording kept short.
      const title = clip(raw?.title, 90);
      const text = clip(raw?.gentleExplanation, 240);
      const type: FlagType = FLAG_TYPES.includes(raw?.type as FlagType) ? (raw!.type as FlagType) : 'high_spend';
      if (title && text) out.push({ type, title, gentleExplanation: text, suggestedAction: 'none' });
    }
  }

  // 2. Anything unfamiliar-looking the AI didn't flag.
  for (const s of activeSubs) {
    if (!usedSubs.has(s.id) && looksCryptic(s.merchant)) {
      usedSubs.add(s.id);
      out.push(subFlag(s));
    }
  }
  for (const t of outgoing) {
    if (!t.subscriptionId && !usedTxs.has(t.id) && looksCryptic(t.merchant)) {
      usedTxs.add(t.id);
      out.push(txFlag(t));
    }
  }

  // 3. Unfamiliar first, then subscriptions, then general notes.
  const rank = (f: Omit<CheckinFlag, 'id'>) => (f.type === 'unfamiliar_charge' ? 0 : f.subscriptionId ? 1 : 2);
  return out
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, MAX_FLAGS)
    .map(({ f }, i) => ({ id: `${idPrefix}_${i + 1}`, ...f }));
}
