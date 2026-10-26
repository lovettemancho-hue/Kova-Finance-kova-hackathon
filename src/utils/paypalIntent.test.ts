import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPayPalQuestion, looksLikePayPal } from './paypalIntent';

test('PayPal questions are recognised, with one typo allowed', () => {
  for (const q of [
    'Anything I should cancel on PayPal?',
    'anything i should cancel on payapl?',
    'what did i pay for on paypall this month',
    'my pyapal subscriptions',
    'what did I spend on pay pal',
    "what's on my PayPal's account",
    'PAYPAL',
  ]) {
    assert.equal(isPayPalQuestion(q), true, q);
  }
});

test('ordinary messages stay in the normal chat', () => {
  for (const q of ['spent 12 on lunch', 'when is payday?', 'I paid the bill', 'can I afford a new laptop', 'paper towels 4', 'pay rent 1500', '']) {
    assert.equal(isPayPalQuestion(q), false, q);
  }
  assert.equal(isPayPalQuestion(`paypal ${'x'.repeat(600)}`), false); // too long for the agent
});

test('looksLikePayPal needs a close match starting with p', () => {
  assert.equal(looksLikePayPal('paypal'), true);
  assert.equal(looksLikePayPal('paypla'), true);
  assert.equal(looksLikePayPal('aypal'), false); // must start with p
  assert.equal(looksLikePayPal('payday'), false);
  assert.equal(looksLikePayPal('pay'), false);
});
