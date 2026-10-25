// Account deletion (KOVA-092). Google Play requires that deleting an account also deletes its data.
//
// The app used to delete only the `users/{uid}` document from the phone. Firestore keeps subcollections
// when their parent document is deleted, so expenses, chats, goals, letters and push tokens stayed
// behind. The server now deletes everything with the Admin SDK, in this order:
//   1. users/{uid} and every subcollection (expenses, messages, goals + coachingThread, letters, devices…)
//   2. usage/{uid} (quota counters and the Grow lesson cache) and the user's aiReports
//   3. the RevenueCat customer record, when billing is configured (best effort)
//   4. the Firebase Auth user, last, so a failure above can be retried by deleting again
// Pure helpers are unit-tested in server/account.test.ts.

import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';

/** Deleting needs a sign-in from the last 10 minutes, like Firebase's own rule for deleting a user. */
export const RECENT_SIGN_IN_SEC = 10 * 60;

/** True when the ID token's `auth_time` (seconds) is recent enough to delete the account. */
export function isRecentSignIn(authTimeSec: unknown, nowMs: number = Date.now(), maxAgeSec = RECENT_SIGN_IN_SEC): boolean {
  if (typeof authTimeSec !== 'number' || !Number.isFinite(authTimeSec)) return false;
  const ageSec = nowMs / 1000 - authTimeSec;
  return ageSec >= -60 && ageSec <= maxAgeSec; // small allowance for clock skew
}

export interface DeleteAccountDeps {
  db: Firestore;
  auth: Auth;
  /** Deletes the RevenueCat customer. Returns false when billing isn't configured. */
  deleteBillingCustomer?: (uid: string) => Promise<boolean>;
}

export interface DeleteAccountResult {
  billingDeleted: boolean | 'failed';
}

export async function deleteAccountEverywhere(uid: string, deps: DeleteAccountDeps): Promise<DeleteAccountResult> {
  if (!uid) throw new Error('missing_uid');

  await deps.db.recursiveDelete(deps.db.collection('users').doc(uid));
  await deps.db.recursiveDelete(deps.db.collection('usage').doc(uid));
  const reports = await deps.db.collection('aiReports').where('uid', '==', uid).get();
  await Promise.all(reports.docs.map((d) => d.ref.delete()));

  let billingDeleted: DeleteAccountResult['billingDeleted'] = false;
  if (deps.deleteBillingCustomer) {
    try {
      billingDeleted = await deps.deleteBillingCustomer(uid);
    } catch (err: any) {
      // Not fatal: the purchase record holds no money data, and the store keeps its own receipt.
      console.error(`[Account] RevenueCat delete failed: ${err?.message || 'unknown'}`);
      billingDeleted = 'failed';
    }
  }

  try {
    await deps.auth.deleteUser(uid);
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }
  return { billingDeleted };
}

/** What the user picked when reporting (KOVA-093). Anything else is stored as 'other'. */
export const AI_REPORT_REASONS = ['wrong_numbers', 'unhelpful', 'offensive', 'other'] as const;
export type AiReportReason = (typeof AI_REPORT_REASONS)[number];

/** A reported AI reply, trimmed for storage. Null when there's nothing to report. */
export function aiReportRecord(uid: string, body: any, nowIso: string) {
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 4000) : '';
  if (!uid || !text) return null;
  const messageId = typeof body?.messageId === 'string' ? body.messageId.slice(0, 128) : '';
  const reason: AiReportReason = (AI_REPORT_REASONS as readonly string[]).includes(body?.reason) ? body.reason : 'other';
  return { uid, messageId, text, reason, status: 'new', createdAt: nowIso };
}
