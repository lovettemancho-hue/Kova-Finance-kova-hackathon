// Server-side quota enforcement (KOVA-072). Limits live in server/plans.ts.
//
// Counters are stored in the top-level `usage/{uid}` collection. Firestore rules have no match for
// it, so the app can neither read nor reset it; only the Admin SDK (this server) touches it.
// Each check runs in a transaction, so two requests at once can't both slip past a limit.

import type { Firestore } from 'firebase-admin/firestore';
import type { NextFunction, Request, Response } from 'express';
import { decideQuota, refundQuota, usageSummary, Plan, QuotaKey, QuotaDecision, UsageDoc, PLAN_LIMITS } from './plans';

type AuthedRequest = Request & { user?: { uid: string }; verifiedPlan?: Plan; quota?: { key: QuotaKey; decision: QuotaDecision } };

export function createUsageService(db: Firestore) {
  const ref = (uid: string) => db.collection('usage').doc(uid);

  /** Uses one unit of `key` if the plan allows it. Fails open (allows) if Firestore is unreachable. */
  async function consume(uid: string, plan: Plan, key: QuotaKey, now = new Date()): Promise<QuotaDecision> {
    try {
      return await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref(uid));
        const decision = decideQuota(snap.exists ? (snap.data() as UsageDoc) : undefined, plan, key, now);
        if (decision.allowed) tx.set(ref(uid), { ...decision.next, updatedAt: now.toISOString() }, { merge: true });
        return decision;
      });
    } catch (err: any) {
      // A Firestore outage must not lock everyone out of Kova. The per-minute/hour rate limits in
      // server/rateLimit.ts still apply, so the cost exposure stays bounded.
      console.error(`[Usage] Quota check failed, allowing request: code=${err?.code || 'unknown'}`);
      const limit = PLAN_LIMITS[plan].quotas[key];
      return { allowed: limit > 0, used: 0, limit, period: 'day', resetsAt: now.toISOString(), next: {} };
    }
  }

  /** Gives one unit back, e.g. when the AI call failed after the quota was taken. Best effort. */
  async function refund(uid: string, key: QuotaKey, now = new Date()): Promise<void> {
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref(uid));
        if (!snap.exists) return;
        tx.set(ref(uid), { ...refundQuota(snap.data() as UsageDoc, key, now), updatedAt: now.toISOString() }, { merge: true });
      });
    } catch (err: any) {
      console.error(`[Usage] Refund failed: code=${err?.code || 'unknown'}`);
    }
  }

  async function summary(uid: string, plan: Plan, now = new Date()) {
    try {
      const snap = await ref(uid).get();
      return usageSummary(snap.exists ? (snap.data() as UsageDoc) : undefined, plan, now);
    } catch {
      return usageSummary(undefined, plan, now);
    }
  }

  /**
   * Express middleware: rejects the request with a calm message when the quota is used up, or
   * when the feature isn't in the user's plan. Must run after requireAuth.
   */
  function guard(key: QuotaKey) {
    return async (req: AuthedRequest, res: Response, next: NextFunction) => {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({ error: 'Please sign in again.' });
      const plan: Plan = req.verifiedPlan === 'premium' ? 'premium' : 'free';

      if (PLAN_LIMITS[plan].quotas[key] === 0) {
        return res.status(403).json({ error: premiumOnlyMessage(key), code: 'premium_required', feature: key });
      }
      const decision = await consume(uid, plan, key);
      if (!decision.allowed) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((Date.parse(decision.resetsAt) - Date.now()) / 1000))));
        return res.status(429).json({ error: limitMessage(key, plan, decision), code: 'quota_exceeded', feature: key, usage: decision });
      }
      req.quota = { key, decision };
      return next();
    };
  }

  return { consume, refund, summary, guard };
}

export function premiumOnlyMessage(key: QuotaKey): string {
  switch (key) {
    case 'coach':
      return 'Goal coaching is part of Premium. Your goals and progress stay free.';
    case 'csvImport':
      return 'Importing bank or wallet statements is part of Premium. You can still log anything by hand or in chat.';
    default:
      return 'This is part of Premium.';
  }
}

/** Calm, specific limit messages (no guilt, says when it resets, logging always still works). */
export function limitMessage(key: QuotaKey, plan: Plan, d: QuotaDecision): string {
  const when = d.period === 'day' ? 'tomorrow' : 'next month';
  switch (key) {
    case 'chat':
      return plan === 'free'
        ? `You've used today's ${d.limit} replies with Kova. Logging still works, and replies come back ${when}. Premium gives you ${PLAN_LIMITS.premium.quotas.chat} a day.`
        : `You've reached today's ${d.limit} replies. Logging still works, and replies come back ${when}.`;
    case 'coach':
      return `You've reached today's ${d.limit} coaching messages. Coaching comes back ${when}.`;
    case 'paypalCheckin':
      return plan === 'free'
        ? `You've used this month's free PayPal check-in. The next one is available ${when}, or anytime with Premium.`
        : `You've reached this month's ${d.limit} PayPal check-ins. More are available ${when}.`;
    case 'csvImport':
      return plan === 'free'
        ? `You've used this month's free statement import. The next one is available ${when}, or import up to ${PLAN_LIMITS.premium.quotas.csvImport} a month with Premium. You can still log anything by hand or in chat.`
        : `You've used this month's ${d.limit} statement imports. More are available ${when}.`;
    case 'letter':
      return plan === 'free'
        ? `Your letter for this month is already written. Premium can regenerate it up to ${PLAN_LIMITS.premium.quotas.letter - 1} times a month.`
        : `You've regenerated this month's letter as many times as Premium allows. A new one comes ${when}.`;
  }
}
