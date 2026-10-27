import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKIN_TTL_MS, createCheckinStore, isFresh, trimForStorage, type CheckinCacheEntry } from './checkinStore';

const tx = (id: string) => ({ id, date: '2026-10-01T00:00:00Z', amount: 9.99, currency: 'USD', direction: 'out' as const, merchant: `M ${id}`, type: 'purchase' as const });
const sub = (id: string) => ({ id, planName: 'Plan', merchant: `S ${id}`, status: 'ACTIVE' as const, amount: 5, currency: 'USD', interval: 'MONTH' as const, startedAt: '2026-01-01T00:00:00Z' });

function entry(createdAt = Date.now()): CheckinCacheEntry {
  return {
    createdAt,
    flags: [
      { id: 'f1', type: 'review_subscription', title: 'S s1', gentleExplanation: '', suggestedAction: 'cancel_subscription', subscriptionId: 's1' },
      { id: 'f2', type: 'unfamiliar_charge', title: 'M t2', gentleExplanation: '', suggestedAction: 'draft_dispute', transactionId: 't2' },
    ],
    transactions: [tx('t1'), tx('t2'), tx('t3')],
    subscriptions: [sub('s1'), sub('s2')],
  };
}

test('stores only the transactions and subscriptions a flag points at', () => {
  const t = trimForStorage(entry());
  assert.deepEqual(t.transactions.map((x) => x.id), ['t2']);
  assert.deepEqual(t.subscriptions.map((x) => x.id), ['s1']);
  assert.equal(t.flags.length, 2);
});

test('fresh for 30 minutes, then expired', () => {
  const now = Date.now();
  assert.equal(isFresh({ createdAt: now - CHECKIN_TTL_MS + 1000 }, now), true);
  assert.equal(isFresh({ createdAt: now - CHECKIN_TTL_MS - 1 }, now), false);
  assert.equal(isFresh(null, now), false);
});

// A tiny Firestore stand-in: one map of docs.
function fakeDb() {
  const docs = new Map<string, any>();
  return {
    docs,
    collection: (c: string) => ({
      doc: (id: string) => ({
        get: async () => ({ exists: docs.has(`${c}/${id}`), data: () => docs.get(`${c}/${id}`) }),
        set: async (v: any) => { docs.set(`${c}/${id}`, v); },
        delete: async () => { docs.delete(`${c}/${id}`); },
      }),
    }),
  };
}

test('a check-in saved by one instance can be read by another', async () => {
  const db = fakeDb();
  await createCheckinStore(db).set('u1', entry());
  const other = await createCheckinStore(db).get('u1'); // fresh instance, empty memory
  assert.ok(other);
  assert.deepEqual(other!.flags.map((f) => f.id), ['f1', 'f2']);
  assert.ok(db.docs.get('paypalCheckins/u1').expiresAt instanceof Date);
});

test('an expired check-in is not returned', async () => {
  const db = fakeDb();
  await createCheckinStore(db).set('u1', entry(Date.now() - CHECKIN_TTL_MS - 5000));
  assert.equal(await createCheckinStore(db).get('u1'), null);
});

test('remove deletes it everywhere', async () => {
  const db = fakeDb();
  const store = createCheckinStore(db);
  await store.set('u1', entry());
  await store.remove('u1');
  assert.equal(await createCheckinStore(db).get('u1'), null);
});
