// Server-verified Premium purchases through RevenueCat (KOVA-026).
//
// The app never grants Premium itself. After a purchase (and on every RevenueCat webhook) the server
// asks RevenueCat's REST API who is subscribed, and writes the server-owned `users/{uid}.entitlement`.
// Firestore rules block clients from writing that field, so a purchase can't be faked from the app.
//
// Env (Secret Manager): REVENUECAT_SECRET_KEY (sk_..., REST API), REVENUECAT_WEBHOOK_AUTH (the
// Authorization value set on the webhook in the RevenueCat dashboard). Without them, billing is off
// and nothing changes. Pure helpers are unit-tested in server/billing.test.ts.

import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

/** The RevenueCat entitlement identifier that unlocks Kova Premium. */
export const PREMIUM_ENTITLEMENT = 'premium';

/**
 * How long after RevenueCat's expiry (including any grace period) Kova keeps Premium if no webhook
 * arrives. Covers renewal webhooks that land a little after the old period ends.
 */
export const EXPIRY_GRACE_MS = 24 * 60 * 60 * 1000;

export interface RevenueCatState {
  active: boolean;
  productId: string | null;
  expiresAt: string | null; // null = lifetime / non-expiring
  periodType: 'trial' | 'intro' | 'normal' | null;
  store: string | null;
  willRenew: boolean;
}

/** Reads Premium state from a RevenueCat v1 `subscriber` object. */
export function stateFromSubscriber(subscriber: any, now: number = Date.now()): RevenueCatState {
  const ent = subscriber?.entitlements?.[PREMIUM_ENTITLEMENT];
  if (!ent) {
    return { active: false, productId: null, expiresAt: null, periodType: null, store: null, willRenew: false };
  }
  const productId: string | null = ent.product_identifier || null;
  const sub = productId ? subscriber?.subscriptions?.[productId] : null;
  const ends = [ent.expires_date, ent.grace_period_expires_date, sub?.grace_period_expires_date]
    .map((d) => (d ? Date.parse(d) : NaN))
    .filter((t) => Number.isFinite(t));
  const lifetime = ent.expires_date === null || ent.expires_date === undefined;
  const endMs = ends.length ? Math.max(...ends) : NaN;
  const active = lifetime || (Number.isFinite(endMs) && endMs > now);
  const periodType = sub?.period_type === 'trial' || sub?.period_type === 'intro' ? sub.period_type : sub ? 'normal' : null;
  return {
    active,
    productId,
    expiresAt: lifetime ? null : Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
    periodType,
    store: sub?.store || null,
    willRenew: Boolean(sub && !sub.unsubscribe_detected_at && !sub.billing_issues_detected_at),
  };
}

/**
 * The entitlement to store, or null to leave the current one alone.
 * An admin grant (testing, judges) is never removed because RevenueCat has no purchase for that user.
 */
export function nextEntitlement(current: any, state: RevenueCatState, nowIso: string) {
  if (!state.active && current?.source === 'admin' && current?.plan === 'premium') return null;
  if (!state.active && (!current || current.plan !== 'premium')) return null; // nothing to change
  return {
    plan: state.active ? 'premium' : 'free',
    source: 'revenuecat',
    productId: state.productId,
    expiresAt: state.expiresAt,
    periodType: state.periodType,
    store: state.store,
    willRenew: state.willRenew,
    updatedAt: nowIso,
  };
}

/** Premium per the stored entitlement, treating a RevenueCat entitlement past expiry + grace as free. */
export function isPremiumEntitlement(ent: any, now: number = Date.now()): boolean {
  if (ent?.plan !== 'premium') return false;
  if (ent.source !== 'revenuecat' || !ent.expiresAt) return true;
  const end = Date.parse(ent.expiresAt);
  return !Number.isFinite(end) || now < end + EXPIRY_GRACE_MS;
}

/** Constant-time check of the webhook's Authorization header. */
export function webhookAuthorized(provided: unknown, expected: string | undefined): boolean {
  if (!expected || typeof provided !== 'string') return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** RevenueCat app user ids that can be Firebase UIDs (skips anonymous ids). */
export function candidateUids(event: any): string[] {
  const ids = [event?.app_user_id, event?.original_app_user_id, ...(Array.isArray(event?.aliases) ? event.aliases : [])];
  return Array.from(
    new Set(ids.filter((id) => typeof id === 'string' && id.length >= 6 && id.length <= 128 && !id.startsWith('$RCAnonymousID')))
  );
}

export function createBillingService(
  db: Firestore,
  opts: { secretKey?: string; fetchImpl?: typeof fetch } = {}
) {
  const secretKey = opts.secretKey;
  const doFetch = opts.fetchImpl || fetch;

  /** Asks RevenueCat about this user and updates their entitlement. */
  async function syncFromRevenueCat(uid: string): Promise<{ configured: boolean; plan?: 'free' | 'premium'; changed?: boolean }> {
    if (!secretKey) return { configured: false };
    const res = await doFetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`revenuecat_http_${res.status}`);
    const body: any = await res.json();
    const state = stateFromSubscriber(body?.subscriber);

    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return { configured: true, plan: 'free', changed: false }; // not a Kova account
    const current = snap.data()?.entitlement;
    const next = nextEntitlement(current, state, new Date().toISOString());
    if (next) await ref.set({ entitlement: next }, { merge: true });
    const plan = (next?.plan || (isPremiumEntitlement(current) ? 'premium' : 'free')) as 'free' | 'premium';
    return { configured: true, plan, changed: Boolean(next) };
  }

  /**
   * Deletes the user's RevenueCat customer record (account deletion, KOVA-092). Doesn't cancel a store
   * subscription: only Google Play can do that, so the deletion page tells users to cancel there first.
   */
  async function deleteSubscriber(uid: string): Promise<boolean> {
    if (!secretKey) return false;
    const res = await doFetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
    });
    if (!res.ok && res.status !== 404) throw new Error(`revenuecat_http_${res.status}`);
    return true;
  }

  return { syncFromRevenueCat, deleteSubscriber, configured: Boolean(secretKey) };
}
