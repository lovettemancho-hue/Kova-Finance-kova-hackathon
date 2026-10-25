import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCategoryBreakdownRequest } from './chatIntents';

test('category breakdown requests are recognised', () => {
  for (const m of [
    'show all categories',
    'Show all categories I spend money on',
    'show my spending categories',
    'categories',
    'spending by category',
    'category breakdown',
    'where did my money go?',
    'where has all my money gone',
    'where my money went this month',
    'what are my categories',
  ]) {
    assert.equal(isCategoryBreakdownRequest(m.toLowerCase()), true, m);
  }
});

test('other questions still go to Kova', () => {
  for (const m of ['how much did i spend on groceries?', 'log coffee 5', 'hi', 'what is a budget category in accounting and how do people use it for planning ahead each month']) {
    assert.equal(isCategoryBreakdownRequest(m.toLowerCase()), false, m);
  }
});
