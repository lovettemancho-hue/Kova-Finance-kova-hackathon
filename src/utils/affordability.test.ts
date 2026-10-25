import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAffordCard, describeDelay, findAmount, isThinCard, parseAffordRequest, parseAmountReply } from './affordability';
import type { Expense, SavingsGoal } from '../types';

const NOW = new Date('2026-10-20T12:00:00Z');
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12)).toISOString();
const exp = (amount: number, ts: string, type: 'outcome' | 'income' = 'outcome', extra: Partial<Expense> = {}): Expense => ({
  id: Math.random().toString(36).slice(2),
  label: type === 'income' ? 'Salary' : 'Thing',
  category: type === 'income' ? 'Income' : 'Shopping',
  amount,
  type,
  timestamp: ts,
  nativeCurrency: 'USD',
  ...extra,
});

test('recognises affordability questions and leaves plain logs alone', () => {
  assert.deepEqual(parseAffordRequest('Can I afford headphones for $120?'), { item: 'headphones', price: { amount: 120, currency: 'USD' } });
  assert.equal(parseAffordRequest('should I buy a jacket for 45000?', 'XAF')?.item, 'jacket');
  assert.equal(parseAffordRequest('should I buy a jacket for 45000?', 'XAF')?.price?.amount, 45000);
  assert.equal(parseAffordRequest('is it ok to spend 80 on dinner?')?.item, 'dinner');
  assert.equal(parseAffordRequest('can i afford a new phone?')?.item, 'new phone');
  assert.equal(parseAffordRequest('can i afford a new phone?')?.price, null);
  assert.equal(parseAffordRequest('bought headphones 120'), null);
  assert.equal(parseAffordRequest('coffee 5'), null);
  assert.equal(parseAffordRequest('how am I doing this month?'), null);
});

test('finds the price, not a model number or a count', () => {
  assert.equal(findAmount('can I afford an iphone 15 for 900')?.amount, 900);
  assert.equal(findAmount('can i afford 2 shirts?'), null);
  assert.equal(findAmount('should I get the 45k sofa', 'XAF')?.amount, 45000);
  assert.equal(findAmount('should I buy it for 1,250.50')?.amount, 1250.5);
  assert.deepEqual(findAmount('can I afford shoes for 30000 FCFA', 'USD'), { amount: 30000, currency: 'XAF' });
  assert.deepEqual(findAmount('can I afford a book for €20', 'USD'), { amount: 20, currency: 'EUR' });
  assert.equal(findAmount('can I afford a book for $20', 'CAD')?.currency, 'CAD'); // "$" means the user's own dollars
});

test('understands the answer to "How much is it?"', () => {
  assert.equal(parseAmountReply('350')?.amount, 350);
  assert.equal(parseAmountReply('about $350')?.amount, 350);
  assert.equal(parseAmountReply('25k', 'XAF')?.amount, 25000);
  assert.equal(parseAmountReply('actually never mind, show my categories'), null);
});

test('builds the trade-off from this month, past months, income and the goal pace', () => {
  const expenses = [
    exp(1000, iso(2026, 7, 10)), exp(1200, iso(2026, 8, 10)), exp(1400, iso(2026, 9, 10)), // usual = 1200
    exp(3000, iso(2026, 9, 1), 'income'),
    exp(500, iso(2026, 10, 5)),
    exp(300, iso(2026, 10, 2), 'outcome', { label: 'Goal Contribution: Fund' }), // a transfer, not spending
  ];
  const goal: SavingsGoal = {
    id: 'g', title: 'Emergency fund', targetAmount: 2000, currentAmount: 900, status: 'active', nativeCurrency: 'USD',
    contributions: [{ id: 'c1', amount: 450, timestamp: iso(2026, 8, 22) }, { id: 'c2', amount: 450, timestamp: iso(2026, 9, 21) }],
  };
  const card = buildAffordCard({ item: 'headphones', price: 120, currency: 'USD', expenses, goals: [goal], now: NOW });
  assert.equal(card.monthLabel, 'October');
  assert.equal(card.spentSoFar, 500);
  assert.equal(card.usualMonth, 1200);
  assert.equal(card.leftAfter, 3000 - 500 - 120);
  // 900 added over the last 59 days -> ~15.25/day -> 120 / 15.25 ≈ 8 days
  assert.equal(card.goal?.title, 'Emergency fund');
  assert.equal(card.goal?.delayDays, 8);
  assert.equal(card.otherGoals, 0);
  assert.equal(isThinCard(card), false);
});

test('honest when there is little history', () => {
  const card = buildAffordCard({ item: 'phone', price: 300, currency: 'USD', expenses: [exp(40, iso(2026, 10, 3))], goals: [], now: NOW });
  assert.equal(card.usualMonth, null);
  assert.equal(card.leftAfter, null);
  assert.equal(card.goal, null);
  assert.equal(isThinCard(card), true);
});

test('picks the goal with the most progress, skips finished ones, and counts the rest', () => {
  const g = (title: string, current: number, target: number, extra: Partial<SavingsGoal> = {}): SavingsGoal =>
    ({ id: title, title, currentAmount: current, targetAmount: target, status: 'active', ...extra });
  const card = buildAffordCard({
    item: 'x', price: 10, currency: 'USD', expenses: [], now: NOW,
    goals: [g('Trip', 100, 1000), g('Laptop', 600, 1000), g('Done', 500, 500), g('Old', 1, 10, { isArchived: true }), g('Car loan', 200, 1000)],
  });
  assert.equal(card.goal?.title, 'Laptop');
  assert.equal(card.goal?.delayDays, null); // no deposits yet, so no estimate
  assert.equal(card.goal?.kind, 'savings');
  assert.equal(card.otherGoals, 2);
});

test('delays read naturally', () => {
  assert.equal(describeDelay(1), 'about 1 day');
  assert.equal(describeDelay(9), 'about 9 days');
  assert.equal(describeDelay(21), 'about 3 weeks');
  assert.equal(describeDelay(95), 'about 3 months');
});
