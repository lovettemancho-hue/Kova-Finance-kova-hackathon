// Pure helpers for the Money Check-in card (KOVA-079). No PayPal or Gemini calls here, so they
// can be unit-tested (server/paypal/checkin.test.ts).
//
// The server, not the AI, decides: the numbers shown, which items are flagged, the flag titles
// (the store name as it appears on a statement) and which actions a flag allows. The AI only
// writes the short sentences.

import { looksCryptic } from '../../src/lib/paypalImport/analyze';
import type { CheckinFacts, CheckinFlag, FlagType, PayPalSubscription, PayPalTransaction, SuggestedAction } from './types';
import { ORDERS_OR_GRADES, type Tone } from '../tone';

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
/**
 * Advice and moral words the check-in never shows (KOVA-099). The AI was told "no lectures" but still wrote
 * lines like "…to ensure your monthly outflows align with your current priorities" and "Does this service
 * still serve a purpose in your digital life?". Wider than the agent's LECTURE list on purpose: the
 * check-in only needs short neutral questions.
 */
const PREACHY = /\b(ensur\w*|align\w*|priorit\w*|make sure|should|need to|must|budget\w*|habits?|mindful\w*|responsib\w*|purpose|digital life|enjoy\w*|worth it|wise\w*|smart\w*|careful\w*|disciplin\w*|goals?|long[- ]term|wealth|on track|important|essential|crucial|remember|keep in mind|great (job|work)|well done|journey|financial (health|wellness|freedom)|outflows?|value)\b/i;

/** True when an AI sentence is a calm question with no advice in it. */
export function isCalmQuestion(sentence: string): boolean {
  const s = sentence.trim();
  return s.length > 0 && s.length <= 120 && s.endsWith('?') && !PREACHY.test(s);
}

/**
 * The AI's one line under the facts sentence, or '' to show the facts alone. Gentle: only a short, calm
 * question passes (e.g. "Want to look at these together?"). Mentor: that, or one reflective line. No numbers.
 */
export function gentleLine(aiText: string, tone: Tone = 'gentle'): string {
  // Straight and Analytic get the facts sentence alone: that is the plain, figure-led version (KOVA-100).
  if (tone === 'straight' || tone === 'analytic') return '';
  const first = clip(aiText, 400).split(/(?<=[.!?])\s+/)[0] || '';
  if (!first || first.length > 160) return '';
  // No counts of any kind, in digits or words: the facts sentence already gives the right ones.
  if (/\d/.test(first) || /\b(one|two|three|four|five|six|seven|eight|nine|ten|several|many|few)\b/i.test(first)) return '';
  if (isCalmQuestion(first)) return first;
  // Warm mentor may get one short reflective line instead, as long as it isn't an order or a grade.
  return tone === 'mentor' && first.length <= 120 && !ORDERS_OR_GRADES.test(first) ? first : '';
}

/** AI wording for a flag, kept only if every sentence is plain and it ends with a calm question; else ''. */
export function calmExplanation(aiText: string | undefined): string {
  const text = clip(aiText, 240);
  if (!text || /\d/.test(text)) return '';
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 2 || sentences.some((x) => PREACHY.test(x))) return '';
  return isCalmQuestion(sentences[sentences.length - 1]) ? text : '';
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
/** The server's sentence for a subscription flag, in the user's tone (KOVA-100). Same figures in every tone. */
export function subscriptionLine(
  s: PayPalSubscription,
  cryptic: boolean,
  money: (amount: number, currency: string) => string,
  tone: Tone = 'gentle'
): string {
  const { perYear } = subscriptionCost(s);
  const year = money(perYear, s.currency);
  const every = s.interval === 'YEAR' ? 'year' : s.interval === 'WEEK' ? 'week' : 'month';
  const maths =
    s.interval === 'YEAR' ? `${year} a year, billed yearly` : `${money(s.amount, s.currency)} a ${every} × ${s.interval === 'WEEK' ? 52 : 12} = ${year} a year`;
  if (cryptic) {
    if (tone === 'straight') return `Unclear name. Do you recognise it? It costs ${year} a year.`;
    if (tone === 'analytic') return `The statement name doesn't identify the seller. ${maths}. Recognise it?`;
    return `This name doesn't say much on its own. Does it look familiar? It adds up to ${year} a year.`;
  }
  if (tone === 'straight') return `${year} a year. Keep it or cancel it?`;
  if (tone === 'analytic') return `${maths}. Still using it?`;
  if (tone === 'mentor') return `Renews every ${every}, ${year} a year. Worth a quiet check: does it still earn its place?`;
  return `Renews every ${every}, ${year} a year. Still using it?`;
}

/** A flag for one subscription: title, price and allowed actions all set here, never by the AI. */
export function subscriptionFlag(
  s: PayPalSubscription,
  outgoing: PayPalTransaction[],
  money: (amount: number, currency: string) => string,
  _explanation?: string, // unused since KOVA-099: subscriptions use server wording
  tone: Tone = 'gentle'
): Omit<CheckinFlag, 'id'> {
  const cryptic = looksCryptic(s.merchant);
  const charge = cryptic ? latestChargeFor(s, outgoing) : undefined;
  const cost = subscriptionCost(s);
  return {
    type: cryptic ? 'unfamiliar_charge' : 'review_subscription',
    title: clip(s.merchant, 90),
    amountLabel: `${money(s.amount, s.currency)} ${s.interval === 'YEAR' ? 'a year' : s.interval === 'WEEK' ? 'a week' : 'a month'}`,
    // Server wording for every subscription (KOVA-099): the yearly cost and one plain question. The AI's
    // sentences here drifted into advice ("still serve a purpose in your digital life?").
    gentleExplanation: subscriptionLine(s, cryptic, money, tone),
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
    gentleExplanation: calmExplanation(explanation) || `This name doesn't say much. Does it look familiar?`,
    suggestedAction: 'draft_dispute',
    transactionId: t.id,
  };
}

export function finalizeFlags(
  rawFlags: RawFlag[],
  activeSubs: PayPalSubscription[],
  outgoing: PayPalTransaction[],
  money: (amount: number, currency: string) => string,
  idPrefix = `flag_${Date.now().toString(36)}`,
  tone: Tone = 'gentle'
): CheckinFlag[] {
  const bySubId = new Map(activeSubs.map((s) => [s.id, s]));
  const byTxId = new Map(outgoing.map((t) => [t.id, t]));
  const out: Omit<CheckinFlag, 'id'>[] = [];
  const usedSubs = new Set<string>();
  const usedTxs = new Set<string>();

  const subFlag = (s: PayPalSubscription, explanation?: string) => subscriptionFlag(s, outgoing, money, explanation, tone);
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
      const text = calmExplanation(raw?.gentleExplanation); // dropped when it reads as advice (KOVA-099)
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
