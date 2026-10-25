import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRadarCard, cancelSavingsText, daysUntil, findByName, findSubscriptions, isSubscriptionRadarRequest,
  radarNudges, renewsInText, subscriptionName,
} from './subscriptionRadar';
import type { Expense, ExpenseCategory, SavingsGoal } from '../types';

const NOW = new Date(2026, 9, 25, 10); // Oct 25, 2026, local time
const at = (m: number, d: number) => new Date(2026, m - 1, d, 9).toISOString();
let n = 0;
const exp = (label: string, amount: number, ts: string, category: ExpenseCategory = 'Other'): Expense => ({
  id: `e${n++}`, label, category, amount, type: 'outcome', timestamp: ts, nativeCurrency: 'USD',
});

const base = [
  exp('Netflix', 15.49, at(7, 28)), exp('Netflix August', 15.49, at(8, 28)), exp('Netflix', 15.49, at(9, 28)),
  exp('Gym membership', 25, at(9, 2)), exp('Gym', 25, at(10, 2)),
  exp('Groceries', 40, at(9, 5)), exp('Groceries', 63.2, at(9, 19)), exp('Groceries', 51, at(10, 3)), // varying: a habit
  exp('Spotify', 6.99, at(10, 10), 'Subscriptions'), // seen once, labelled: a guess
];

test('cleans labels so the same service matches', () => {
  assert.equal(subscriptionName('Netflix October'), 'Netflix');
  assert.equal(subscriptionName('Gym membership'), 'Gym');
  assert.equal(subscriptionName('Spotify sub 2026'), 'Spotify');
  assert.equal(subscriptionName('Subway'), 'Subway');
  assert.equal(subscriptionName('NETFLIX.COM'), 'Netflix.com');
  assert.equal(subscriptionName('PLANET FITNESS CLUB FEES'), 'Planet Fitness Club Fees');
  assert.equal(subscriptionName('SPOTIFY USA'), 'Spotify USA');
});

test('rent and two different-priced orders are not subscriptions', () => {
  const extra = [
    exp('Rent', 1200, at(8, 2), 'Housing'), exp('Rent', 1200, at(9, 2), 'Housing'), exp('Rent', 1200, at(10, 2), 'Housing'),
    exp('Amazon', 24.5, at(9, 18)), exp('Amazon', 61.2, at(10, 18)),
  ];
  const names = findSubscriptions([...base, ...extra], 'USD', {}, NOW).map((s) => s.name);
  assert.ok(!names.includes('Rent'));
  assert.ok(!names.includes('Amazon'));
});

test('finds subscriptions from the rhythm, skips habits, soonest first', () => {
  const subs = findSubscriptions(base, 'USD', {}, NOW);
  assert.deepEqual(subs.map((s) => s.name), ['Netflix', 'Gym', 'Spotify']);
  const netflix = subs[0];
  assert.equal(netflix.interval, 'monthly');
  assert.equal(netflix.guess, false);
  assert.equal(netflix.nextDate, '2026-10-28');
  assert.equal(daysUntil(netflix.nextDate, NOW), 3);
  assert.equal(subs[2].guess, true);
  const card = buildRadarCard(subs, 'USD');
  assert.equal(Math.round(card.monthlyTotal * 100) / 100, 47.48);
  assert.equal(card.rows[0].nextLabel, 'around Oct 28');
});

test('warns once, 3 days ahead, and respects the user\'s choices', () => {
  let subs = findSubscriptions(base, 'USD', {}, NOW);
  let nudges = radarNudges(subs, NOW);
  assert.equal(nudges.length, 1);
  assert.equal(nudges[0].kind, 'renews_soon');
  assert.equal(nudges[0].sub.name, 'Netflix');

  subs = findSubscriptions(base, 'USD', { netflix: { nudgedFor: '2026-10-28' } }, NOW);
  assert.equal(radarNudges(subs, NOW).length, 0); // already warned about this renewal

  subs = findSubscriptions(base, 'USD', { netflix: { status: 'kept', decidedAt: NOW.toISOString() } }, NOW);
  assert.equal(radarNudges(subs, NOW).length, 0);
  assert.equal(subs.length, 3); // kept ones stay on the radar
});

test('asks "did it renew?" when an expected charge is late', () => {
  const later = new Date(2026, 10, 8, 10); // Nov 8: Gym was due ~Nov 1, past the 5-day grace
  const subs = findSubscriptions(base, 'USD', {}, later);
  const nudges = radarNudges(subs, later);
  assert.ok(nudges.some((x) => x.kind === 'did_it_renew' && x.sub.name === 'Gym'));
});

test('"not a subscription" and "stopped" hide it until it charges again; a failed cancel comes back', () => {
  const decided = new Date(2026, 9, 20).toISOString();
  let subs = findSubscriptions(base, 'USD', { gym: { status: 'not_subscription', decidedAt: decided } }, NOW);
  assert.ok(!subs.some((s) => s.name === 'Gym'));

  const charged = [...base, exp('Netflix', 15.49, at(10, 28))];
  const after = new Date(2026, 9, 29, 10);
  subs = findSubscriptions(charged, 'USD', { netflix: { status: 'cancelling', decidedAt: decided } }, after);
  const netflix = subs.find((s) => s.name === 'Netflix');
  assert.ok(netflix);
  assert.equal(netflix!.note?.status, undefined); // charged after "I'll cancel it", so it's active again
});

test('cancel savings mention the goal when there is a pace to compare with', () => {
  const subs = findSubscriptions(base, 'USD', {}, NOW);
  const money = (x: number) => `$${Math.round(x)}`;
  assert.equal(cancelSavingsText(subs[0], 'USD', [], money, NOW), 'That frees about $186 a year.');
  const goal: SavingsGoal = {
    id: 'g', title: 'Emergency fund', targetAmount: 2000, currentAmount: 900, status: 'active',
    contributions: [{ id: 'c', amount: 450, timestamp: at(8, 26) }, { id: 'd', amount: 450, timestamp: at(9, 25) }],
  };
  assert.match(cancelSavingsText(subs[0], 'USD', [goal], money, NOW), /^That frees about \$186 a year, or your Emergency fund about \d+ (days|weeks) sooner if it went there\.$/);
});

test('matches quick replies and requests', () => {
  const subs = findSubscriptions(base, 'USD', {}, NOW);
  assert.equal(findByName(subs, 'netflix')?.name, 'Netflix');
  assert.equal(findByName(subs, 'Hulu'), undefined);
  assert.equal(isSubscriptionRadarRequest('show my subscriptions'), true);
  assert.equal(isSubscriptionRadarRequest('what am i subscribed to?'), true);
  assert.equal(isSubscriptionRadarRequest('subscriptions'), true);
  assert.equal(isSubscriptionRadarRequest('recurring payments'), true);
  assert.equal(isSubscriptionRadarRequest('netflix 15'), false);
  assert.equal(renewsInText(0), 'renews today');
  assert.equal(renewsInText(3), 'renews in about 3 days');
});
