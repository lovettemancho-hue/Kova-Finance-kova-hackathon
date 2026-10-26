import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calmExplanation, computeFacts, factsSentence, finalizeFlags, gentleLine, subscriptionCost, subscriptionLine } from './checkin';
import type { PayPalSubscription, PayPalTransaction } from './types';

const money = (a: number, c: string) => `${a.toFixed(2)} ${c}`;
const sub = (id: string, merchant: string, amount: number, status: PayPalSubscription['status'] = 'ACTIVE'): PayPalSubscription => ({
  id, planName: `${merchant} plan`, merchant, status, amount, currency: 'USD', interval: 'MONTH', startedAt: '2026-10-21T00:00:00Z',
});
const tx = (id: string, merchant: string, amount: number, subscriptionId?: string): PayPalTransaction => ({
  id, date: '2026-10-21T10:00:00Z', amount, currency: 'USD', direction: 'out', merchant, type: subscriptionId ? 'subscription_payment' : 'purchase', ...(subscriptionId ? { subscriptionId } : {}),
});

const subs = [sub('S1', 'StreamPlus', 12.99), sub('S2', 'CloudBox', 4.99, 'CANCELLED'), sub('S3', 'XK*DGTL SVCS 4471', 14.99)];
const txs = [tx('T1', 'StreamPlus', 12.99, 'S1'), tx('T2', 'CloudBox', 4.99, 'S2'), tx('T3', 'XK*DGTL SVCS 4471', 14.99, 'S3'), tx('T4', 'FreshMart Groceries', 38.4), tx('T5', 'GreenLeaf Cafe', 9.75), tx('T6', 'Book Corner', 18.5)];
const active = subs.filter((s) => s.status === 'ACTIVE');

test('facts are computed by the server', () => {
  const f = computeFacts(txs, subs, 30);
  assert.equal(f.paymentCount, 6);
  assert.equal(f.spentTotal, 99.62);
  assert.equal(f.activeSubscriptions, 2);
  assert.equal(f.subscriptionsPerMonth, 27.98);
  assert.equal(f.unfamiliarCount, 1);
});

test('yearly savings from a monthly subscription', () => {
  assert.deepEqual(subscriptionCost({ amount: 4.99, interval: 'MONTH' }), { perMonth: 4.99, perYear: 59.88 });
  assert.deepEqual(subscriptionCost({ amount: 120, interval: 'YEAR' }), { perMonth: 10, perYear: 120 });
});

test('cryptic name is flagged first, titled as on the statement, with cancel and draft', () => {
  const flags = finalizeFlags([{ subscriptionId: 'S1', suggestedAction: 'cancel_subscription', title: 'StreamPlus Premium', gentleExplanation: 'Still using it?' }], active, txs, money, 'f');
  assert.equal(flags[0].title, 'XK*DGTL SVCS 4471'); // added even though the AI skipped it
  assert.equal(flags[0].type, 'unfamiliar_charge');
  assert.equal(flags[0].suggestedAction, 'cancel_subscription');
  assert.equal(flags[0].secondaryAction, 'draft_dispute');
  assert.equal(flags[0].transactionId, 'T3');
  assert.equal(flags[1].title, 'StreamPlus'); // AI's "StreamPlus Premium" replaced by the store name
  assert.equal(flags[1].amountLabel, '12.99 USD a month');
});

test('the AI cannot point at unknown or cancelled items', () => {
  const flags = finalizeFlags(
    [
      { subscriptionId: 'S2', suggestedAction: 'cancel_subscription', title: 'CloudBox', gentleExplanation: 'x' },
      { transactionId: 'NOPE', suggestedAction: 'draft_dispute', title: 'Fake', gentleExplanation: 'x' },
      { subscriptionId: 'S1', suggestedAction: 'cancel_subscription', title: 'A', gentleExplanation: 'a' },
      { subscriptionId: 'S1', suggestedAction: 'cancel_subscription', title: 'B', gentleExplanation: 'b' },
    ],
    active,
    txs,
    money,
    'f'
  );
  assert.deepEqual(flags.map((f) => f.title), ['XK*DGTL SVCS 4471', 'StreamPlus']); // no CloudBox, no fake, no duplicate
});

test('long AI text is clipped to two short sentences worth', () => {
  const flags = finalizeFlags([{ subscriptionId: 'S1', suggestedAction: 'cancel_subscription', gentleExplanation: 'word '.repeat(200) }], active, txs, money, 'f');
  assert.ok(flags.every((f) => f.gentleExplanation.length <= 240));
});

test('unfamiliar subscription without a linked charge still gets Draft a message (matched by plan name)', () => {
  const s3 = { ...sub('S3', 'XK*DGTL SVCS 4471', 14.99), planName: 'XK Digital Services (monthly)' };
  const charge = tx('T9', 'XK Digital Services (monthly)', 14.99); // no subscriptionId, as in the sandbox
  const flags = finalizeFlags([], [s3], [charge], money, 'f');
  assert.equal(flags[0].secondaryAction, 'draft_dispute');
  assert.equal(flags[0].transactionId, 'T9');
  assert.match(flags[0].gentleExplanation, /look familiar/);
});

test('summary facts come from the server; the AI only adds one clean line', () => {
  const none = computeFacts(txs, subs.map((x) => ({ ...x, status: 'CANCELLED' as const })), 30);
  assert.equal(factsSentence(none, money), '6 payments in the last 30 days, 99.62 USD in total. No subscriptions are active right now.');
  assert.equal(
    factsSentence(computeFacts(txs, subs, 30), money),
    '6 payments in the last 30 days, 99.62 USD in total. 2 subscriptions are active, 27.98 USD a month. One name looks unfamiliar.'
  );
  assert.equal(gentleLine('Want to look at these together? More text here.'), 'Want to look at these together?');
  assert.equal(gentleLine('You have three ongoing subscriptions.'), ''); // counts in words are dropped too
  assert.equal(gentleLine('You spent 99.62 this month.'), ''); // numbers are dropped
});

test('no lectures in the check-in (KOVA-099)', () => {
  // The exact line a judge would have seen on Oct 26.
  assert.equal(gentleLine("Let's review these recent transactions together to ensure your monthly outflows align with your current priorities."), '');
  assert.equal(gentleLine('Here is your activity.'), ''); // only a calm question is added
  assert.equal(gentleLine('Want to look at these together?'), 'Want to look at these together?');
  assert.equal(calmExplanation('Does this service still serve a purpose in your digital life?'), '');
  assert.equal(calmExplanation('Are you still enjoying the content provided by this subscription?'), '');
  assert.equal(calmExplanation('A one-off charge from this store. Does it look familiar?'), 'A one-off charge from this store. Does it look familiar?');
  assert.equal(calmExplanation('Charged 14.99. Does it look familiar?'), ''); // numbers come from the server
});

test('subscriptions use server wording with the yearly cost, whatever the AI wrote', () => {
  const flags = finalizeFlags(
    [{ subscriptionId: 'S1', suggestedAction: 'cancel_subscription', gentleExplanation: 'Does this service still serve a purpose in your digital life?' }],
    active,
    txs,
    money,
    'f'
  );
  const stream = flags.find((f) => f.title === 'StreamPlus')!;
  assert.equal(stream.gentleExplanation, 'Renews every month, 155.88 USD a year. Still using it?');
});

test('check-in wording follows the tone, with the same figures (KOVA-100)', () => {
  const stream = active.find((x) => x.merchant === 'StreamPlus')!;
  assert.equal(subscriptionLine(stream, false, money, 'gentle'), 'Renews every month, 155.88 USD a year. Still using it?');
  assert.equal(subscriptionLine(stream, false, money, 'straight'), '155.88 USD a year. Keep it or cancel it?');
  assert.equal(subscriptionLine(stream, false, money, 'analytic'), '12.99 USD a month × 12 = 155.88 USD a year. Still using it?');
  assert.match(subscriptionLine(stream, false, money, 'mentor'), /155\.88 USD a year\. Worth a quiet check/);
  const flags = finalizeFlags([], active, txs, money, 'f', 'straight');
  assert.match(flags[0].gentleExplanation, /^Unclear name\./);
});

test('the AI line under the facts follows the tone', () => {
  const reflective = 'Small regular costs are often the easiest to rethink.';
  assert.equal(gentleLine('Want to look at these together?', 'straight'), ''); // facts only
  assert.equal(gentleLine('Want to look at these together?', 'analytic'), '');
  assert.equal(gentleLine(reflective, 'gentle'), ''); // gentle: questions only
  assert.equal(gentleLine(reflective, 'mentor'), reflective); // mentor: one reflective line
  assert.equal(gentleLine('You should cancel the ones you forgot.', 'mentor'), ''); // never an order
});
