import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stateFromSubscriber, nextEntitlement, isPremiumEntitlement, webhookAuthorized, candidateUids, EXPIRY_GRACE_MS } from './billing';

const NOW = Date.parse('2026-10-21T10:00:00Z');
const sub = (expires: string | null, extra: any = {}) => ({
  entitlements: { premium: { expires_date: expires, product_identifier: 'kova_premium:annual' } },
  subscriptions: { 'kova_premium:annual': { expires_date: expires, period_type: 'normal', store: 'play_store', ...extra } },
});

test('active annual subscription', () => {
  const s = stateFromSubscriber(sub('2027-10-21T10:00:00Z'), NOW);
  assert.equal(s.active, true);
  assert.equal(s.productId, 'kova_premium:annual');
  assert.equal(s.willRenew, true);
  assert.equal(s.store, 'play_store');
});

test('trial is active and marked as trial', () => {
  const s = stateFromSubscriber(sub('2026-10-28T10:00:00Z', { period_type: 'trial' }), NOW);
  assert.equal(s.active, true);
  assert.equal(s.periodType, 'trial');
});

test('expired, cancelled and billing-grace cases', () => {
  assert.equal(stateFromSubscriber(sub('2026-10-20T10:00:00Z'), NOW).active, false);
  const cancelled = stateFromSubscriber(sub('2026-11-01T00:00:00Z', { unsubscribe_detected_at: '2026-10-10T00:00:00Z' }), NOW);
  assert.equal(cancelled.active, true); // keeps Premium until the period ends
  assert.equal(cancelled.willRenew, false);
  const grace = stateFromSubscriber(sub('2026-10-20T10:00:00Z', { grace_period_expires_date: '2026-10-25T00:00:00Z' }), NOW);
  assert.equal(grace.active, true);
  assert.equal(stateFromSubscriber({ entitlements: {} }, NOW).active, false);
  assert.equal(stateFromSubscriber(undefined, NOW).active, false);
});

test('admin grants are never removed by RevenueCat', () => {
  const inactive = stateFromSubscriber({ entitlements: {} }, NOW);
  assert.equal(nextEntitlement({ plan: 'premium', source: 'admin' }, inactive, 'x'), null);
  assert.equal(nextEntitlement({ plan: 'free', source: 'admin' }, inactive, 'x'), null);
  assert.equal(nextEntitlement(undefined, inactive, 'x'), null);
});

test('purchase grants, expiry removes', () => {
  const active = stateFromSubscriber(sub('2027-10-21T10:00:00Z'), NOW);
  assert.equal(nextEntitlement(undefined, active, 'x')?.plan, 'premium');
  assert.equal(nextEntitlement({ plan: 'premium', source: 'admin' }, active, 'x')?.source, 'revenuecat');
  const expired = stateFromSubscriber(sub('2026-10-01T00:00:00Z'), NOW);
  assert.equal(nextEntitlement({ plan: 'premium', source: 'revenuecat' }, expired, 'x')?.plan, 'free');
});

test('stored entitlement past expiry + grace counts as free', () => {
  const exp = '2026-10-20T00:00:00Z';
  const ent = { plan: 'premium', source: 'revenuecat', expiresAt: exp };
  assert.equal(isPremiumEntitlement(ent, Date.parse(exp) + EXPIRY_GRACE_MS - 1), true);
  assert.equal(isPremiumEntitlement(ent, Date.parse(exp) + EXPIRY_GRACE_MS + 1), false);
  assert.equal(isPremiumEntitlement({ plan: 'premium', source: 'admin' }, NOW), true);
  assert.equal(isPremiumEntitlement({ plan: 'free' }, NOW), false);
});

test('webhook auth and user ids', () => {
  assert.equal(webhookAuthorized('Bearer abc', 'Bearer abc'), true);
  assert.equal(webhookAuthorized('Bearer abd', 'Bearer abc'), false);
  assert.equal(webhookAuthorized(undefined, 'Bearer abc'), false);
  assert.equal(webhookAuthorized('x', undefined), false);
  assert.deepEqual(
    candidateUids({ app_user_id: 'mskNkUeEdaMdLReLuRZJt3pkyZg2', original_app_user_id: '$RCAnonymousID:123', aliases: ['mskNkUeEdaMdLReLuRZJt3pkyZg2'] }),
    ['mskNkUeEdaMdLReLuRZJt3pkyZg2']
  );
});
