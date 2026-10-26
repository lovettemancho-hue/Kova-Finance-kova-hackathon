import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TONE_LABELS, chatToneStyle, longformToneStyle, resolveTone, type Tone } from './tone';

const TONES: Tone[] = ['gentle', 'straight', 'analytic', 'mentor'];

test('each stored label maps to its tone', () => {
  assert.equal(resolveTone('Gently, ease me in', 'free'), 'gentle');
  assert.equal(resolveTone('Straight, tell me the truth', 'free'), 'straight');
  assert.equal(resolveTone('Warm, like a wise mentor', 'free'), 'mentor');
  assert.equal(resolveTone('Analytic, show me the numbers', 'premium'), 'analytic');
  assert.equal(resolveTone(undefined, 'premium'), 'gentle');
  assert.equal(resolveTone(42, 'premium'), 'gentle');
});

test('Analytic is Premium on every route: Free falls back to Gentle', () => {
  assert.equal(resolveTone(TONE_LABELS.analytic, 'free'), 'gentle');
  assert.equal(resolveTone(TONE_LABELS.analytic, undefined), 'gentle');
});

test('all four tones give different instructions, naming the choice', () => {
  for (const fn of [chatToneStyle, longformToneStyle]) {
    const texts = TONES.map(fn);
    assert.equal(new Set(texts).size, 4);
    TONES.forEach((t, i) => assert.ok(texts[i].includes(TONE_LABELS[t]), t));
  }
});

test('what each tone asks for', () => {
  assert.match(chatToneStyle('straight'), /first sentence is the answer/);
  assert.match(chatToneStyle('analytic'), /label: value/);
  assert.match(chatToneStyle('mentor'), /ONE short reflective line/);
  assert.match(chatToneStyle('gentle'), /at most one figure/);
  for (const t of TONES) assert.doesNotMatch(chatToneStyle(t), /\byou must\b/i); // no tone licenses orders
});
