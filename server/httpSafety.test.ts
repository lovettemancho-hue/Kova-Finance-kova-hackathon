import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipProfile, clipText, isAllowedOrigin } from './httpSafety';

const HOST = 'kova-gkgwmqurbq-ew.a.run.app';

test('CORS: own origin, Android WebView, local dev and no origin are allowed', () => {
  assert.equal(isAllowedOrigin(`https://${HOST}`, HOST), true);
  assert.equal(isAllowedOrigin('https://kova-123.europe-west1.run.app', 'kova-123.europe-west1.run.app'), true);
  assert.equal(isAllowedOrigin('https://localhost', HOST), true);
  assert.equal(isAllowedOrigin('capacitor://localhost', HOST), true);
  assert.equal(isAllowedOrigin('http://localhost:3000', HOST), true);
  assert.equal(isAllowedOrigin(undefined, HOST), true);
});

test('CORS: other sites are refused unless listed', () => {
  assert.equal(isAllowedOrigin('https://evil.example', HOST), false);
  assert.equal(isAllowedOrigin(`http://${HOST}`, HOST), false); // not https
  assert.equal(isAllowedOrigin('https://localhost.evil.example', HOST), false);
  assert.equal(isAllowedOrigin('not a url', HOST), false);
  assert.equal(isAllowedOrigin('https://kova.example', HOST, new Set(['https://kova.example'])), true);
});

test('clipText trims, flattens and caps; non-strings become empty', () => {
  assert.equal(clipText('  a \n b  ', 10), 'a b');
  assert.equal(clipText('x'.repeat(50), 5), 'xxxxx');
  assert.equal(clipText({ evil: true }, 5), '');
});

test('clipProfile keeps only prompt fields, each capped', () => {
  const p = clipProfile({ firstName: 'Ada'.repeat(40), entitlement: { plan: 'premium' }, currency: 'USDX' });
  assert.equal(p.firstName!.length, 40);
  assert.equal(p.currency, 'USD');
  assert.equal((p as any).entitlement, undefined);
  assert.deepEqual(clipProfile(null), {});
});
