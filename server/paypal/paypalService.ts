import type { PayPalProvider } from './types';
import { mockPayPal } from './mockPaypal';
import { realPayPal } from './realPaypal';

// PayPal is invite-only (KOVA-084). Kova has no production access from PayPal, so the check-in is a
// hackathon demo: only allow-listed accounts (us and the judges' demo account) see it at all.
// Everyone else never sees PayPal; the routes answer 404 for them.
//
//   PAYPAL_ACCESS_UIDS  accounts that can see PayPal (comma/space separated); falls back to PLAN_ADMIN_UIDS
//   PAYPAL_MODE=mock    those accounts get built-in demo data (default, needs no credentials)
//   PAYPAL_MODE=real    those accounts get the PayPal sandbox (needs PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)
//
// The sandbox is one shared PayPal account, which is another reason it must never reach the public.

function uidList(raw: string | undefined): Set<string> {
  return new Set((raw || '').split(/[\s,;]+/).filter(Boolean));
}

export function paypalAccessUids(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const explicit = uidList(env.PAYPAL_ACCESS_UIDS);
  return explicit.size > 0 ? explicit : uidList(env.PLAN_ADMIN_UIDS);
}

export function hasPayPalAccess(uid: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  return !!uid && paypalAccessUids(env).has(uid);
}

/** Only call for users with access; anyone else gets the mock as a safety net. */
export function getPayPalProvider(uid?: string, env: NodeJS.ProcessEnv = process.env): PayPalProvider {
  const mode = (env.PAYPAL_MODE || 'mock').toLowerCase();
  return mode === 'real' && hasPayPalAccess(uid, env) ? realPayPal : mockPayPal;
}
