// Run: npm test  (node:test via tsx; no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_LIMITS,
  decideQuota,
  refundQuota,
  usageSummary,
  periodKey,
  isPlainLogCommand,
  parsePlainLog,
  plainLogFeeling,
  plainLogReply,
  amountsInText,
  UsageDoc,
} from './plans';

const OCT20 = new Date('2026-10-20T10:00:00Z');
const OCT21 = new Date('2026-10-21T00:00:01Z');
const NOV1 = new Date('2026-11-01T00:00:01Z');

function useN(plan: 'free' | 'premium', key: Parameters<typeof decideQuota>[2], n: number, now = OCT20) {
  let doc: UsageDoc | undefined;
  let last;
  for (let i = 0; i < n; i++) {
    last = decideQuota(doc, plan, key, now);
    if (last.allowed) doc = last.next;
  }
  return { doc, last: last! };
}

test('free plan: 10 chat replies a day, the 11th is refused', () => {
  const { doc, last } = useN('free', 'chat', 10);
  assert.equal(last.allowed, true);
  assert.equal(last.used, 10);
  const eleventh = decideQuota(doc, 'free', 'chat', OCT20);
  assert.equal(eleventh.allowed, false);
  assert.equal(eleventh.used, 10);
  assert.equal(eleventh.limit, 10);
});

test('daily quota resets at 00:00 UTC', () => {
  const { doc } = useN('free', 'chat', 10);
  const nextDay = decideQuota(doc, 'free', 'chat', OCT21);
  assert.equal(nextDay.allowed, true);
  assert.equal(nextDay.used, 1);
});

test('free plan: 1 PayPal check-in a month, resets on the 1st', () => {
  const { doc, last } = useN('free', 'paypalCheckin', 1);
  assert.equal(last.allowed, true);
  assert.equal(decideQuota(doc, 'free', 'paypalCheckin', OCT21).allowed, false); // same month
  assert.equal(decideQuota(doc, 'free', 'paypalCheckin', NOV1).allowed, true);
});

test('Premium-only features have a 0 limit on free', () => {
  assert.equal(PLAN_LIMITS.free.quotas.coach, 0);
  assert.equal(decideQuota(undefined, 'free', 'coach', OCT20).allowed, false);
  assert.equal(decideQuota(undefined, 'premium', 'coach', OCT20).allowed, true);
});

test('free plan: 1 statement import a month, Premium 5 (KOVA-078)', () => {
  const { doc, last } = useN('free', 'csvImport', 1);
  assert.equal(last.allowed, true);
  assert.equal(decideQuota(doc, 'free', 'csvImport', OCT21).allowed, false);
  assert.equal(decideQuota(doc, 'free', 'csvImport', NOV1).allowed, true);
  assert.equal(useN('premium', 'csvImport', 6).last.allowed, false);
});

test('premium plan: 100 chat replies a day', () => {
  const { last } = useN('premium', 'chat', 101);
  assert.equal(last.allowed, false);
  assert.equal(last.used, 100);
});

test('counters for different features are independent', () => {
  const { doc } = useN('premium', 'chat', 5);
  const coach = decideQuota(doc, 'premium', 'coach', OCT20);
  assert.equal(coach.used, 1);
  assert.equal(coach.next.counts?.chat, 5);
});

test('refund gives one back, never below zero, ignores old periods', () => {
  const { doc } = useN('free', 'chat', 3);
  assert.equal(refundQuota(doc, 'chat', OCT20).counts?.chat, 2);
  assert.equal(refundQuota(undefined, 'chat', OCT20).counts?.chat, undefined);
  assert.equal(refundQuota(doc, 'chat', OCT21).counts?.chat, 3); // yesterday's count untouched
});

test('summary reports used, limit and reset time', () => {
  const { doc } = useN('free', 'chat', 4);
  const s = usageSummary(doc, 'free', OCT20);
  assert.equal(s.chat.used, 4);
  assert.equal(s.chat.limit, 10);
  assert.equal(s.chat.resetsAt, '2026-10-21T00:00:00.000Z');
  assert.equal(s.paypalCheckin.resetsAt, '2026-11-01T00:00:00.000Z');
  assert.equal(periodKey('month', OCT20), '2026-10');
});

test('plain logging is recognised without AI', () => {
  for (const msg of ['log coffee 50', 'paid rent 1500', 'spent 22 on lunch', 'coffee 4.50', 'log new expense coffee 50', 'bought shoes for 1,250.50']) {
    assert.equal(isPlainLogCommand(msg), true, msg);
  }
});

test('questions, plans, income and goal moves still go to the AI', () => {
  for (const msg of [
    'how much did I spend this month?',
    'hi',
    'I need about $3,000',
    'what if I save 200 a month',
    'got my salary 1000',
    'put 50 toward my pc fund',
    'add 100 to my savings',
    'log coffee', // no amount
  ]) {
    assert.equal(isPlainLogCommand(msg), false, msg);
  }
});

test('parsePlainLog: clean labels, right amounts and categories', () => {
  assert.deepEqual(parsePlainLog('log coffee 50'), { label: 'Coffee', category: 'Coffee', amount: 50, type: 'outcome' });
  assert.deepEqual(parsePlainLog('spent 22 on lunch'), { label: 'Lunch', category: 'Dining out', amount: 22, type: 'outcome' });
  assert.deepEqual(parsePlainLog('paid rent 1500'), { label: 'Rent', category: 'Housing', amount: 1500, type: 'outcome' });
  assert.deepEqual(parsePlainLog('log new expense coffee 50'), { label: 'Coffee', category: 'Coffee', amount: 50, type: 'outcome' });
  assert.equal(parsePlainLog('paid card payment 200')?.category, 'Debt repayment');
  assert.equal(parsePlainLog('bought 2 shirts for 40'), null); // two numbers: let the AI decide
});

test('amountsInText (KOVA-064) still reads amounts correctly', () => {
  assert.deepEqual(amountsInText('spent 1500 on rent'), [1500]);
  assert.deepEqual(amountsInText('paid $1,250.50 for flights'), [1250.5]);
  assert.deepEqual(amountsInText('lunch at 12:30 cost 22'), [22]);
  assert.deepEqual(amountsInText('paid 5k rent'), [5000]);
});

test('plain logs with a feeling: clean label, calm reply (KOVA-099)', () => {
  assert.deepEqual(parsePlainLog('spent 12 on lunch today feeling a bit guilty'), { label: 'Lunch', category: 'Dining out', amount: 12, type: 'outcome' });
  assert.deepEqual(parsePlainLog('Spent 12 on lunch, feeling abit guilty'), { label: 'Lunch', category: 'Dining out', amount: 12, type: 'outcome' });
  assert.deepEqual(parsePlainLog('spent 40 on shoes and I feel bad'), { label: 'Shoes', category: 'Shopping', amount: 40, type: 'outcome' });
  assert.deepEqual(parsePlainLog("paid 15 for pizza yesterday, i'm so stressed"), { label: 'Pizza', category: 'Dining out', amount: 15, type: 'outcome' });
  assert.equal(parsePlainLog('spent 30 on lunch and drinks')?.label, 'Lunch and drinks'); // no feeling, nothing cut
  assert.equal(plainLogFeeling('spent 12 on lunch feeling guilty'), true);
  assert.equal(plainLogFeeling('spent 12 on lunch'), false);
  assert.equal(plainLogReply('Lunch', '$12', false), 'Logged lunch, $12.');
  const calm = plainLogReply('Lunch', '$12', true);
  assert.match(calm, /^Logged lunch, \$12\. /);
  assert.doesNotMatch(calm, /\d.*\d.*\d/); // only the logged amount
});

test('the feeling line follows the tone; the log line is the same in every tone (KOVA-100)', () => {
  const tones = ['gentle', 'straight', 'analytic', 'mentor'] as const;
  const replies = tones.map((t) => plainLogReply('Lunch', '$12', true, t));
  assert.equal(new Set(replies).size, 4);
  for (const r of replies) assert.match(r, /^Logged lunch, \$12\. /);
  for (const t of tones) assert.equal(plainLogReply('Lunch', '$12', false, t), 'Logged lunch, $12.');
});
