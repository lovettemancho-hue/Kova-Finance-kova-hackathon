import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRecentSignIn, deleteAccountEverywhere, aiReportRecord, RECENT_SIGN_IN_SEC } from './account';

const NOW = Date.parse('2026-10-22T16:00:00Z');
const sec = (ms: number) => Math.floor(ms / 1000);

test('recent sign-in: within the window', () => {
  assert.equal(isRecentSignIn(sec(NOW) - 30, NOW), true);
  assert.equal(isRecentSignIn(sec(NOW) - RECENT_SIGN_IN_SEC, NOW), true);
});

test('recent sign-in: too old, missing or nonsense', () => {
  assert.equal(isRecentSignIn(sec(NOW) - RECENT_SIGN_IN_SEC - 1, NOW), false);
  assert.equal(isRecentSignIn(undefined, NOW), false);
  assert.equal(isRecentSignIn('123', NOW), false);
  assert.equal(isRecentSignIn(sec(NOW) + 3600, NOW), false); // far in the future
});

function fakes(opts: { authError?: any; billing?: () => Promise<boolean> } = {}) {
  const calls: string[] = [];
  const db: any = {
    collection: (c: string) => ({
      doc: (id: string) => ({ path: `${c}/${id}` }),
      where: (_f: string, _op: string, v: string) => ({
        get: async () => ({ docs: [`${c}/r1`, `${c}/r2`].map((path) => ({ ref: { delete: async () => { calls.push(`delete ${path} of ${v}`); } } })) }),
      }),
    }),
    recursiveDelete: async (ref: any) => { calls.push(`delete ${ref.path}`); },
  };
  const auth: any = {
    deleteUser: async (uid: string) => {
      calls.push(`auth ${uid}`);
      if (opts.authError) throw opts.authError;
    },
  };
  const deleteBillingCustomer = opts.billing
    ? async (uid: string) => { calls.push(`billing ${uid}`); return opts.billing!(); }
    : undefined;
  return { calls, deps: { db, auth, deleteBillingCustomer } };
}

test('deletes the user tree, usage, billing, then the sign-in, in that order', async () => {
  const { calls, deps } = fakes({ billing: async () => true });
  const r = await deleteAccountEverywhere('u1', deps);
  assert.deepEqual(calls, [
    'delete users/u1', 'delete usage/u1', 'delete aiReports/r1 of u1', 'delete aiReports/r2 of u1', 'billing u1', 'auth u1',
  ]);
  assert.equal(r.billingDeleted, true);
});

test('a billing failure does not stop the deletion', async () => {
  const { calls, deps } = fakes({ billing: async () => { throw new Error('revenuecat_http_500'); } });
  const r = await deleteAccountEverywhere('u1', deps);
  assert.equal(r.billingDeleted, 'failed');
  assert.equal(calls.at(-1), 'auth u1');
});

test('an already-deleted sign-in counts as done; other auth errors are raised', async () => {
  await deleteAccountEverywhere('u1', fakes({ authError: { code: 'auth/user-not-found' } }).deps);
  await assert.rejects(deleteAccountEverywhere('u1', fakes({ authError: { code: 'auth/internal-error' } }).deps));
});

test('refuses an empty uid', async () => {
  await assert.rejects(deleteAccountEverywhere('', fakes().deps));
});

test('AI report record: trims, requires text', () => {
  const r = aiReportRecord('u1', { messageId: 'm1', text: '  bad reply  ', reason: 'wrong_numbers' }, '2026-10-22T16:00:00Z');
  assert.deepEqual(r, { uid: 'u1', messageId: 'm1', text: 'bad reply', reason: 'wrong_numbers', status: 'new', createdAt: '2026-10-22T16:00:00Z' });
  assert.equal(aiReportRecord('u1', { text: '   ' }, 'x'), null);
  assert.equal(aiReportRecord('u1', { text: 42 }, 'x'), null);
  assert.equal(aiReportRecord('u1', { text: 'a'.repeat(5000) }, 'x')!.text.length, 4000);
});

test('AI report record: unknown or missing reason is stored as other', () => {
  assert.equal(aiReportRecord('u1', { text: 'x', reason: 'drop table' }, 't')!.reason, 'other');
  assert.equal(aiReportRecord('u1', { text: 'x' }, 't')!.reason, 'other');
  assert.equal(aiReportRecord('u1', { text: 'x', reason: 'offensive' }, 't')!.reason, 'offensive');
});
