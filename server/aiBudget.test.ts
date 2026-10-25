import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_BUDGET, budgetFor, isInvalidArgumentError, usageLine, LITE, FLASH } from './aiBudget';

test('free users never get the expensive model', () => {
  for (const [route, plans] of Object.entries(AI_BUDGET)) {
    assert.equal(plans.free.model, LITE, route);
  }
});

test('Premium keeps 3.6 Flash for Grow and letters', () => {
  assert.equal(budgetFor('grow', 'premium').model, FLASH);
  assert.equal(budgetFor('letter', 'premium').model, FLASH);
  assert.equal(budgetFor('letter', undefined).model, LITE); // unknown plan = free
});

test('every route has an output cap', () => {
  for (const plans of Object.values(AI_BUDGET)) {
    for (const b of Object.values(plans)) assert.ok(b.maxOutputTokens >= 1024 && b.maxOutputTokens <= 16384);
  }
});

test('invalid-argument detection', () => {
  assert.equal(isInvalidArgumentError({ status: 400 }), true);
  assert.equal(isInvalidArgumentError({ message: 'INVALID_ARGUMENT: thinking_level not supported' }), true);
  assert.equal(isInvalidArgumentError({ status: 429 }), false);
  assert.equal(isInvalidArgumentError({ status: 503 }), false);
});

test('usage line has counts only', () => {
  assert.equal(
    usageLine('grow', LITE, { promptTokenCount: 1800, candidatesTokenCount: 600, thoughtsTokenCount: 120 }),
    '[AI usage] route=grow model=gemini-3.1-flash-lite in=1800 out=600 thinking=120'
  );
  assert.equal(usageLine('chat', LITE, undefined), '[AI usage] route=chat model=gemini-3.1-flash-lite in=0 out=0 thinking=0');
});
