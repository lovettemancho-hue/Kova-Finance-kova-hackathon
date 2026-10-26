import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_EVERY_MS, priceDrop, simulatedDrop, watchAction, watchDocId, watchRecord } from './priceWatch';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const body = { productId: 'p1', title: 'Sony WH-1000XM5', price: 328, currency: 'usd', domain: 'BestBuy.com' };
const base = () => watchRecord('u1', body, new Date(NOW).toISOString())!;

test('a watch is built only from clean input (KOVA-102)', () => {
  const w = base();
  assert.equal(w.watchedPrice, 328);
  assert.equal(w.currency, 'USD');
  assert.equal(w.domain, 'bestbuy.com');
  assert.equal(w.status, 'active');
  assert.equal(watchRecord('u1', { ...body, price: -1 }, 'x'), null);
  assert.equal(watchRecord('u1', { ...body, currency: 'dollars' }, 'x'), null);
  assert.equal(watchRecord('u1', { ...body, domain: 'not a domain' }, 'x'), null);
  assert.equal(watchRecord('', body, 'x'), null);
  assert.equal(watchDocId('u1', 'a/b?c'), 'u1_a_b_c');
});

test('checks at most every 6 hours, and ends after 30 days', () => {
  const w = base();
  assert.equal(watchAction(w, NOW), 'check'); // never checked
  const checked = { ...w, lastCheckedAt: new Date(NOW).toISOString() };
  assert.equal(watchAction(checked, NOW + 60_000), 'skip');
  assert.equal(watchAction(checked, NOW + CHECK_EVERY_MS), 'check');
  assert.equal(watchAction(w, NOW + 31 * 24 * 3600 * 1000), 'expire');
  assert.equal(watchAction({ ...w, status: 'stopped' }, NOW), 'skip');
});

test('only real drops are mentioned, and never twice', () => {
  const w = base();
  assert.equal(priceDrop(w, { price: 325, currency: 'USD', domain: 'x.com' }), null); // under 3%: a wobble
  assert.equal(priceDrop(w, { price: 340, currency: 'USD', domain: 'x.com' }), null); // went up
  assert.equal(priceDrop(w, { price: 279, currency: 'EUR', domain: 'x.com' }), null); // other currency
  assert.equal(priceDrop(w, null), null);
  const d = priceDrop(w, { price: 279, currency: 'USD', domain: 'amazon.com' })!;
  assert.deepEqual([d.oldPrice, d.newPrice, d.domain], [328, 279, 'amazon.com']);
  const told = { ...w, notifiedPrice: 279 };
  assert.equal(priceDrop(told, { price: 279, currency: 'USD', domain: 'amazon.com' }), null); // already said
  assert.equal(priceDrop(told, { price: 259, currency: 'USD', domain: 'amazon.com' })!.newPrice, 259); // dropped again
  const cheap = watchRecord('u1', { ...body, price: 20 }, 'x')!;
  assert.equal(priceDrop(cheap, { price: 19.5, currency: 'USD', domain: 'x.com' }), null); // under 1 unit
});

test('a simulated drop is marked as simulated', () => {
  const s = simulatedDrop(base());
  assert.equal(s.simulated, true);
  assert.equal(s.newPrice, 278.8);
});

test('the watch keeps an https product photo for the drop card (KOVA-103)', () => {
  const w = watchRecord('u1', { ...body, imageUrl: 'https://img.example.com/sony.jpg' }, 'x')!;
  assert.equal(w.imageUrl, 'https://img.example.com/sony.jpg');
  assert.equal(priceDrop(w, { price: 279, currency: 'USD', domain: 'amazon.com' })!.imageUrl, 'https://img.example.com/sony.jpg');
  assert.equal(watchRecord('u1', { ...body, imageUrl: 'http://x.com/a.jpg' }, 'x')!.imageUrl, undefined);
});
