import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPayPalProvider, hasPayPalAccess, paypalAccessUids } from './paypalService';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

test('only allow-listed accounts have PayPal access', () => {
  const e = env({ PLAN_ADMIN_UIDS: 'admin1, admin2' });
  assert.equal(hasPayPalAccess('admin1', e), true);
  assert.equal(hasPayPalAccess('admin2', e), true);
  assert.equal(hasPayPalAccess('someone-else', e), false);
  assert.equal(hasPayPalAccess(undefined, e), false);
});

test('no allowlist means nobody sees PayPal', () => {
  assert.equal(hasPayPalAccess('anyone', env({})), false);
});

test('PAYPAL_ACCESS_UIDS replaces PLAN_ADMIN_UIDS', () => {
  const e = env({ PLAN_ADMIN_UIDS: 'admin', PAYPAL_ACCESS_UIDS: 'judges-demo;me' });
  assert.deepEqual([...paypalAccessUids(e)].sort(), ['judges-demo', 'me']);
  assert.equal(hasPayPalAccess('judges-demo', e), true);
  assert.equal(hasPayPalAccess('admin', e), false);
});

test('mode picks mock or sandbox for allowed accounts; others never reach the sandbox', () => {
  const real = env({ PAYPAL_MODE: 'REAL', PAYPAL_ACCESS_UIDS: 'me' });
  assert.equal(getPayPalProvider('me', real).mode, 'real');
  assert.equal(getPayPalProvider('stranger', real).mode, 'mock');
  assert.equal(getPayPalProvider('me', env({ PAYPAL_ACCESS_UIDS: 'me' })).mode, 'mock');
});
