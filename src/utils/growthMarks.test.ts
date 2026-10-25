import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGoalMilestones, cleanGrowthMarks, milestoneKey } from './growthMarks';
import type { GrowthMark } from '../types';

const fmt = (n: number) => `$${n}`;
const D = 'Oct 20, 2026';
const pc = { id: 'g1', title: 'Buy a new pc', targetAmount: 500, currentAmount: 0 };
const first: GrowthMark = { id: 'gm-exp-1', date: 'Aug 11, 2026', title: 'Logged your first expense', description: '' };

test('jumping past 50% and 100% at once: 100% above 50%, once each', () => {
  const r = addGoalMilestones([first], { ...pc, currentAmount: 500 }, D, fmt);
  assert.deepEqual(r.added, [50, 100]);
  assert.deepEqual(r.marks.map((m) => m.title), ['Reached your Buy a new pc goal', 'Halfway to Buy a new pc', 'Logged your first expense']);
  const again = addGoalMilestones(r.marks, { ...pc, currentAmount: 700 }, D, fmt);
  assert.deepEqual(again.added, []);
  assert.equal(again.marks, r.marks);
});

test('each goal gets its own milestones', () => {
  let marks = addGoalMilestones([], { ...pc, currentAmount: 300 }, D, fmt).marks;
  marks = addGoalMilestones(marks, { id: 'g2', title: 'Trip', targetAmount: 100, currentAmount: 60 }, D, fmt).marks;
  assert.deepEqual(marks.map((m) => m.title), ['Halfway to Trip', 'Halfway to Buy a new pc']);
});

test('debt goals use debt wording', () => {
  const r = addGoalMilestones([], { id: 'd1', title: 'Credit card', kind: 'debt', targetAmount: 1000, currentAmount: 1000 }, D, fmt);
  assert.deepEqual(r.marks.map((m) => m.title), ['Paid off Credit card', 'Halfway through paying off Credit card']);
  assert.equal(r.marks[0].description, '$1000 cleared.');
});

test('old-format marks count, so nothing is re-added for existing users', () => {
  const old: GrowthMark[] = [
    { id: 'gm-100-x', date: D, title: 'Achieved your goal: Buy a new pc!', description: '' },
    { id: 'gm-50-x', date: D, title: 'Reached 50% of your Buy a new pc goal', description: '' },
  ];
  assert.deepEqual(addGoalMilestones(old, { ...pc, currentAmount: 500 }, D, fmt).added, []);
});

test('cleanup: the screenshot case becomes one 100% mark above one 50% mark', () => {
  const marks: GrowthMark[] = [
    { id: 'a', date: D, title: 'Achieved your goal: Buy a new pc!', description: '' },
    { id: 'b', date: D, title: 'Reached 50% of your Buy a new pc goal', description: '' },
    { id: 'c', date: D, title: 'Reached your Buy a new pc goal', description: '' },
    first,
  ];
  assert.deepEqual(cleanGrowthMarks(marks).map((m) => m.id), ['c', 'b', 'gm-exp-1']);
});

test('cleanup keeps clean lists untouched (same array)', () => {
  const marks: GrowthMark[] = [{ id: 'c', date: D, title: 'Reached your Trip goal', description: '' }, first];
  assert.equal(cleanGrowthMarks(marks), marks);
  assert.equal(milestoneKey(first), null);
});
