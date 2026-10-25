# KOVA-010 — Server-owned premium entitlement (plan)

Status: **approved 2026-10-18, implemented** on `fix/server-owned-entitlement`.

Decisions (Lovette, 2026-10-18):
- **A:** option 2. Free by default; premium only via entitlement. `PLAN_ADMIN_UIDS` gets the test toggle;
  1–2 judge demo accounts are set premium through the admin endpoint.
- **B:** reset. Old `profile.plan` values are not migrated; everyone starts free.
- **C:** manual Rules Playground check now; emulator rules tests after Nov 12 (KOVA-035).
- **D:** add `firebase.json` pointing at the named database; rules deployed by hand.
- Web purchase returns false with "Premium is available in the Android app".

Implementation notes: the admin endpoint is `POST /api/admin/entitlement { plan, email? }` (one endpoint
for self and for other accounts, instead of the `/api/billing/test-plan` named below). RevenueCat
verification is KOVA-026.

**Rules bug caught in the Rules Playground (2026-10-18):** the first version kept the inner
`match /{document=**}` under `/users/{userId}`. In rules_version 2 that wildcard matches **zero or more**
segments, so it also matched the user doc itself and granted the owner a blanket write. Rules are OR-ed,
so owner create/update with `entitlement` were **allowed**, bypassing the protection. Fixed by matching
subcollections only: `match /{subcollection}/{document=**}`. Any rules test suite (KOVA-035) must include
"owner cannot create/update `entitlement` on their user doc" for exactly this reason: the bug is invisible
when reading the rules and only shows up when evaluated.

## Problem (wider than the audit said)

| # | Hole | Where |
|---|---|---|
| 1 | Client writes `profile.plan` directly; rules allow it (console spoofing) | `src/lib/userService.ts` `updateUserPlan`, `firestore.rules` |
| 2 | On web, `purchasePremiumSubscription()` returns `true`: Upgrade is free for everyone | `src/lib/billingService.ts` |
| 3 | "Developer / Test Mode" plan toggle is shown to **every** user in production | `src/components/SettingsScreen.tsx` (~L496) |
| 4 | `requireAuth` also accepts a top-level `plan` field, which is equally user-writable | `server.ts` `requireAuth` |
| 5 | RevenueCat isn't configured (placeholder key, no Android build): no real purchase path exists | `billingService.ts` |

All premium gating (CSV import, letter archive, premium topics, extra goals, log history) is client-side UI.
The server only uses the plan to gate the Analytic tone in chat. Plan data isn't secret (it's the user's own
data), so the goal is that **the plan can only be changed by the server**, and the UI reflects it.

Why not lock `profile.plan` with a rule: the client rewrites the whole `profile` map in many places
(`updateUserProfile`, tone and goal updates). Locking that field would reject ordinary profile saves whenever
the local cache disagrees with what's stored. Keep the plan out of `profile`.

## Design

1. **New server-only field** `users/{uid}.entitlement = { plan: 'free'|'premium', source: 'demo'|'revenuecat'|'admin', updatedAt, expiresAt? }`.
   Only the Admin SDK writes it.
2. **`firestore.rules`:** the owner can still read and write `users/{uid}/**`, except the top-level user doc
   can't create or change `entitlement` (or `paypalConnected`, also server-set):
   - create: `!request.resource.data.keys().hasAny(['entitlement','paypalConnected'])`
   - update: `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['entitlement','paypalConnected'])`
   - Subcollections unchanged. Keeps the CLAUDE.md "users/{uid}/** only" rule.
3. **Server:**
   - `requireAuth` reads `entitlement.plan` only (drops `profile.plan` and top-level `plan`).
   - New `GET /api/me/entitlement` returns `{ plan, canUseTestToggle }`.
   - New `POST /api/billing/test-plan` sets the plan, **only** for UIDs in env `PLAN_ADMIN_UIDS`
     (comma-separated; empty means nobody). Returns 403 otherwise.
   - Optional env `PREMIUM_FOR_ALL=true` (decision A below): treat everyone as premium during judging.
4. **Client:**
   - `AuthContext` loads the plan from `GET /api/me/entitlement` (or `entitlement.plan` from the doc
     snapshot) and overrides `profile.plan` with it, so every existing `userProfile.plan` check keeps working
     unchanged.
   - `updatePlan` no longer writes Firestore. Test toggle → `POST /api/billing/test-plan`; Upgrade → purchase,
     then refetch the entitlement.
   - Hide the Developer/Test section unless `canUseTestToggle`.
   - Web `purchasePremiumSubscription()` returns `false` with "Premium is available in the Android app"
     (or per decision A).
5. **RevenueCat** (later, new backlog item KOVA-026, when Android billing is real): webhook
   `POST /api/billing/revenuecat-webhook` (authorization header secret in Secret Manager) plus a
   `POST /api/billing/sync` that checks RevenueCat's REST API with the secret key. Both write `entitlement`.
   Out of scope here because there is no RevenueCat project yet.

## Rollout order (avoid locking Lovette out)

1. Set `PLAN_ADMIN_UIDS` (Cloud Run env, via deploy.yml repo variable) **before** merging.
2. Merge → deploy server + client (they read `entitlement`; everyone shows free unless decision A or B says otherwise).
3. Deploy `firestore.rules` to the **named database**. The repo has no `firebase.json`, so rules aren't
   deployed by CI today: either add `firebase.json` and deploy with `firebase deploy --only firestore:rules`,
   or paste into the console. Check in the Rules Playground: owner write of `entitlement` → denied; owner
   write of `profile.preferredTone` → allowed.

## Decisions needed from Lovette

- **A. What do web users and judges get?**
  (1) `PREMIUM_FOR_ALL=true` during judging (simplest demo, no paywall shown);
  (2) free by default, demo accounts allowlisted;
  (3) free only, premium shown as "Android app".
- **B. Existing users with `profile.plan='premium'`:** all got it for free (web or the toggle).
  Migrate to `entitlement` (one-off admin script), or reset everyone to free? Recommend: reset (don't migrate).
- **C. Rules test:** manual Rules Playground check (recommended for hackathon scope), or add
  `@firebase/rules-unit-testing` + emulator (needs Java in CI)?
- **D. Add `firebase.json`** so rules live in the repo and deploy repeatably (recommended), deploying by hand
  for now; CI deploy of rules later?

## Size

Roughly 1 server file, `firestore.rules`, `AuthContext.tsx`, `SettingsScreen.tsx`, `billingService.ts`,
`userService.ts` (remove `updateUserPlan`'s Firestore write), plus `firebase.json` if D. One PR.
