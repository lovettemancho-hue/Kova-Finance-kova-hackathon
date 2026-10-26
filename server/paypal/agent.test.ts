import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askIntent, autoProposals, basisLine, checkNumbers, createContext, dropLectures, factsAnswer, finalAnswer, runTool, MAX_PROPOSALS } from './agent';
import type { PayPalSubscription, PayPalTransaction } from './types';

const NOW = new Date('2026-10-22T12:00:00Z');
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const money = (a: number, c: string) => `${Number.isInteger(a) ? a : a.toFixed(2)} ${c}`;
const tx = (id: string, d: number, amount: number, merchant: string, extra: Partial<PayPalTransaction> = {}): PayPalTransaction => ({
  id, date: ago(d), amount, currency: 'USD', direction: 'out', merchant, type: 'purchase', ...extra,
});
const subs: PayPalSubscription[] = [
  { id: 'I-XK', planName: 'Digital svc', merchant: 'XK*DGTL SVCS 4471', status: 'ACTIVE', amount: 14.99, currency: 'USD', interval: 'MONTH', startedAt: ago(90) },
  { id: 'I-CB', planName: 'CloudBox 200GB', merchant: 'CloudBox', status: 'CANCELLED', amount: 2.99, currency: 'USD', interval: 'MONTH', startedAt: ago(200) },
];
const txs = [
  tx('T1', 2, 48, 'ShopNow'),
  tx('T2', 5, 14.99, 'XK*DGTL SVCS 4471', { type: 'subscription_payment', subscriptionId: 'I-XK' }),
  tx('T3', 10, 20, 'ShopNow'),
  tx('T4', 40, 99, 'Old purchase'),
  tx('T5', 3, 500, 'Salary', { direction: 'in' }),
];
const ctx = () => createContext(txs, subs, money, NOW);

test('the AI sees short refs, never PayPal IDs', () => {
  const c = ctx();
  const out = JSON.stringify([runTool('list_payments', {}, c), runTool('list_subscriptions', {}, c)]);
  assert.ok(!/I-XK|I-CB|"T\d"/.test(out));
  assert.match(out, /"ref":"p1"/);
  assert.match(out, /"ref":"s1"/);
});

test('list_payments filters by days, name, amount and direction', () => {
  const c = ctx();
  const r: any = runTool('list_payments', { days: 30 }, c);
  assert.equal(r.count, 3); // T4 is too old, T5 is money in
  assert.deepEqual(r.totals, [{ currency: 'USD', total: 82.99 }]);
  assert.equal((runTool('list_payments', { name_contains: 'shop' }, c) as any).count, 2);
  assert.equal((runTool('list_payments', { min_amount: 30 }, c) as any).count, 1);
  assert.equal((runTool('list_payments', { direction: 'in' }, c) as any).count, 1);
  assert.equal((runTool('list_payments', { days: 999 }, c) as any).days, 90);
});

test('spending_summary and subscriptions compute the numbers, not the AI', () => {
  const c = ctx();
  const s: any = runTool('spending_summary', { days: 30 }, c);
  assert.equal(s.payment_count, 3);
  assert.equal(s.biggest[0].name, 'ShopNow');
  assert.equal(s.biggest[0].total, 68);
  assert.equal(s.active_subscriptions, 1);
  const l: any = runTool('list_subscriptions', {}, c);
  assert.equal(l.subscriptions[0].per_year, 179.88);
  assert.equal(l.subscriptions[0].name_is_unclear, true);
});

test('propose_action only creates valid, deduplicated proposals', () => {
  const c = ctx();
  assert.equal((runTool('propose_action', { action: 'cancel_subscription', ref: 's2' }, c) as any).proposed, false); // cancelled already
  assert.equal((runTool('propose_action', { action: 'cancel_subscription', ref: 'p1' }, c) as any).proposed, false); // not a subscription
  assert.equal((runTool('propose_action', { action: 'cancel_subscription', ref: 's1' }, c) as any).proposed, true);
  runTool('propose_action', { action: 'draft_message', ref: 's1' }, c); // same item: not added twice
  assert.equal(c.proposals.length, 1);
  assert.equal(c.proposals[0].subscriptionId, 'I-XK');
  assert.equal(c.proposals[0].secondaryAction, 'draft_dispute');
  runTool('propose_action', { action: 'draft_message', ref: 'p1' }, c);
  assert.equal(c.proposals[1].transactionId, 'T1');
  assert.equal(c.proposals[1].suggestedAction, 'draft_dispute');
  assert.equal((runTool('propose_action', { action: 'draft_message', ref: 'p3' }, c) as any).proposed, false);
  assert.equal(c.proposals.length, MAX_PROPOSALS);
});

test('sentences with numbers no tool returned are dropped', () => {
  const c = ctx();
  runTool('spending_summary', { days: 30 }, c);
  runTool('list_subscriptions', {}, c);
  assert.equal(
    checkNumbers('You made 3 payments, 82.99 USD in total. ShopNow was 68 USD.', c.numbers),
    'You made 3 payments, 82.99 USD in total. ShopNow was 68 USD.'
  );
  assert.equal(checkNumbers('That subscription is about 180 USD a year.', c.numbers), 'That subscription is about 180 USD a year.'); // rounded 179.88
  assert.equal(checkNumbers('You spend 82.99 USD. That is 995.88 USD a year!', c.numbers), 'You spend 82.99 USD.');
  assert.equal(checkNumbers('About 1,234 USD so far.', c.numbers), null);
  assert.equal(checkNumbers('On Oct 5 you paid ShopNow.', c.numbers), 'On Oct 5 you paid ShopNow.');
});

test('basis line names the period', () => {
  assert.equal(basisLine(ctx()), 'Based on 4 PayPal payments, Sep 22 – Oct 22');
});

test('lecture sentences are dropped, the answer is kept', () => {
  assert.equal(
    dropLectures('In the past 30 days, you spent a total of $199.24 through PayPal. Tracking these small daily transactions is a key step in keeping your everyday habits aligned with your long-term wealth goals.'),
    'In the past 30 days, you spent a total of $199.24 through PayPal.'
  );
  assert.equal(dropLectures('ShopNow was $48. XK*DGTL SVCS is $14.99 a month. Does it look familiar?'), 'ShopNow was $48. XK*DGTL SVCS is $14.99 a month. Does it look familiar?');
  assert.equal(dropLectures('Great job staying on track!'), ''); // nothing factual left
});

test('headline questions are recognised', () => {
  assert.equal(askIntent('What did I pay for on PayPal this month?'), 'spending');
  assert.equal(askIntent('Anything I should cancel on PayPal?'), 'cancel');
  assert.equal(askIntent('My PayPal subscriptions'), 'cancel');
  assert.equal(askIntent('Who is XK DGTL on PayPal?'), 'other');
});

test('answers without facts are replaced by the server facts', () => {
  const c = ctx();
  assert.equal(
    finalAnswer('Across all 12 payments, your total spend was $199.24.', 'spending', c),
    '3 PayPal payments in the last 30 days, 82.99 USD in total. The biggest: ShopNow (68 USD), XK*DGTL SVCS 4471 (14.99 USD).'
  );
  assert.equal(finalAnswer('ShopNow was 68 USD, the biggest.', 'spending', c), 'ShopNow was 68 USD, the biggest.');
  assert.equal(
    finalAnswer(null, 'cancel', c),
    "You have 1 active PayPal subscription: XK*DGTL SVCS 4471 (14.99 USD a month). XK*DGTL SVCS 4471 doesn't say what it is. If you'd like to cancel it, confirm below."
  );
  assert.equal(finalAnswer('Ask me anything.', 'other', c), 'Ask me anything.');
});

test('"anything to cancel?" always offers the unfamiliar subscription', () => {
  const c = ctx();
  autoProposals(c);
  assert.equal(c.proposals.length, 1);
  assert.equal(c.proposals[0].subscriptionId, 'I-XK');
  autoProposals(c); // no duplicates
  assert.equal(c.proposals.length, 1);
});

test('mentor keeps one reflective sentence; other tones keep none (KOVA-100)', () => {
  const a = 'You paid 199.24 USD through PayPal this month. Small recurring costs are where long-term habits form. Keeping habits simple helps over the long term.';
  assert.equal(dropLectures(a, 'gentle'), 'You paid 199.24 USD through PayPal this month.');
  assert.equal(dropLectures(a, 'mentor'), 'You paid 199.24 USD through PayPal this month. Small recurring costs are where long-term habits form.');
  assert.equal(dropLectures('You paid 20 USD. You should build better habits.', 'mentor'), 'You paid 20 USD.'); // orders never pass
  assert.equal(dropLectures('Great job staying on track!', 'mentor'), ''); // no reflection without an answer
});
