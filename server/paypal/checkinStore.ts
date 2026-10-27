// Where a check-in's flags live between "Kova flagged this" and the user's "Yes, cancel it".
//
// This used to be a Map in server memory. Cloud Run runs up to 3 instances and scales to zero when idle,
// so the confirm tap could reach an instance that never saw the check-in (or one that had restarted) and
// answer "That check-in has expired" in the middle of a demo. It now lives in the server-only
// `paypalCheckins/{uid}` collection (no Firestore rule matches it, so clients can't read or write it),
// with a 30-minute lifetime and a small in-memory copy as a fast path.
//
// Only what an action needs is stored: the flags, plus the transactions and subscriptions those flags
// point at (for the dispute draft and the "about $60 a year back" line). Deleted on disconnect and with
// the account (server/account.ts).

import type { CheckinFlag, PayPalSubscription, PayPalTransaction } from './types';

export const CHECKIN_TTL_MS = 30 * 60 * 1000;
export const CHECKIN_COLLECTION = 'paypalCheckins';

export interface CheckinCacheEntry {
  createdAt: number;
  flags: CheckinFlag[];
  transactions: PayPalTransaction[];
  subscriptions: PayPalSubscription[];
}

/** Keeps only the transactions and subscriptions that a flag refers to. Pure; unit-tested. */
export function trimForStorage(entry: CheckinCacheEntry): CheckinCacheEntry {
  const txIds = new Set(entry.flags.map((f) => f.transactionId).filter(Boolean) as string[]);
  const subIds = new Set(entry.flags.map((f) => f.subscriptionId).filter(Boolean) as string[]);
  return {
    createdAt: entry.createdAt,
    flags: entry.flags.slice(0, 40),
    transactions: entry.transactions.filter((t) => txIds.has(t.id)),
    subscriptions: entry.subscriptions.filter((s) => subIds.has(s.id)),
  };
}

/** True while the entry is young enough to act on. */
export function isFresh(entry: Pick<CheckinCacheEntry, 'createdAt'> | null | undefined, now: number = Date.now()): boolean {
  return !!entry && Number.isFinite(entry.createdAt) && now - entry.createdAt <= CHECKIN_TTL_MS;
}

// Firestore rejects `undefined`; JSON round-trip drops those keys and keeps the shape plain.
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function createCheckinStore(db: any) {
  const memory = new Map<string, CheckinCacheEntry>();
  const ref = (uid: string) => db.collection(CHECKIN_COLLECTION).doc(uid);

  async function get(uid: string): Promise<CheckinCacheEntry | null> {
    const local = memory.get(uid);
    if (isFresh(local)) return local!;
    memory.delete(uid);
    try {
      const snap = await ref(uid).get();
      if (!snap.exists) return null;
      const data = snap.data() as CheckinCacheEntry;
      if (!isFresh(data)) {
        ref(uid).delete().catch(() => undefined);
        return null;
      }
      const entry: CheckinCacheEntry = {
        createdAt: data.createdAt,
        flags: Array.isArray(data.flags) ? data.flags : [],
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
      };
      memory.set(uid, entry);
      return entry;
    } catch (err: any) {
      console.warn(`[PayPal] Check-in read failed: code=${err?.code || 'unknown'}`);
      return null;
    }
  }

  async function set(uid: string, entry: CheckinCacheEntry): Promise<void> {
    const trimmed = trimForStorage(entry);
    memory.set(uid, trimmed);
    try {
      // expiresAt lets a Firestore TTL policy on this field clean up abandoned check-ins.
      await ref(uid).set({ ...plain(trimmed), expiresAt: new Date(trimmed.createdAt + CHECKIN_TTL_MS) });
    } catch (err: any) {
      // The in-memory copy still works on this instance.
      console.warn(`[PayPal] Check-in save failed: code=${err?.code || 'unknown'}`);
    }
  }

  async function remove(uid: string): Promise<void> {
    memory.delete(uid);
    try {
      await ref(uid).delete();
    } catch (err: any) {
      console.warn(`[PayPal] Check-in delete failed: code=${err?.code || 'unknown'}`);
    }
  }

  return { get, set, remove };
}
