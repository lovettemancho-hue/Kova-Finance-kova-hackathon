# Premium billing (KOVA-026 / KOVA-077)

Google Play subscriptions through RevenueCat. The app runs the purchase; **the server decides the plan**:
it asks RevenueCat's REST API who is subscribed and writes `users/{uid}.entitlement` (clients can't).

| Plan | Price (US) | Notes |
|---|---|---|
| Yearly (default on the card) | $79.99/year (~$6.67/mo, save 44%) | 7-day free trial for new subscribers |
| Monthly | $11.99/month | 7-day free trial for new subscribers |

Other countries use Play's local prices. The card shows Play's localized price and trial, never a
hardcoded number (web shows USD reference prices with "available in the Android app").

## How it works
- App: `src/lib/billingService.ts` configures RevenueCat with `appUserID = Firebase UID`, loads the
  `current` offering (`$rc_annual`, `$rc_monthly`), buys, then calls `POST /api/billing/sync`.
- Server: `server/billing.ts`. `/api/billing/sync` (signed-in user) and `/api/webhooks/revenuecat`
  (RevenueCat, `Authorization` header) both re-fetch the subscriber from RevenueCat; the webhook payload is
  never trusted. Entitlement id: **`premium`**.
- Trials and cancelled-but-paid periods count as Premium until they end. If a webhook is missed, a
  RevenueCat entitlement still lapses 24 h after its expiry (`isPremiumEntitlement`).
- Admin grants (`PLAN_ADMIN_UIDS`, judges, testing) are never removed by RevenueCat.

## One-time setup
1. **Play Console** (needs a build with billing uploaded to a testing track):
   Monetize → Subscriptions → create `kova_premium` with base plans `monthly` (1 month, $11.99) and
   `annual` (1 year, $79.99), auto-renewing. For prices, use "Set prices" and accept Play's suggested local
   prices. On each base plan add an offer `free-trial-7d`: eligibility "New customer acquisition" (never had
   this subscription), one phase: free trial, 7 days. Activate both. Add your Google account as a
   **license tester** (Setup → License testing) to buy without being charged.
2. **RevenueCat**: add the Play app `com.kovafinance.app` and its Play service-account credentials
   (RevenueCat's own setup guide; that key lives only in RevenueCat). Import both products, create the
   entitlement `premium` with both attached, and an offering `default` (current) with packages
   `$rc_annual` and `$rc_monthly`.
3. **Keys**
   - Public SDK key (`goog_...`): `VITE_REVENUECAT_GOOGLE_API_KEY` in your local `.env` when you run
     `npm run build:android`. It is meant to ship in the app.
   - Secret key (`sk_...`): Secret Manager `revenuecat-secret-key`. Never in the repo, chat or `VITE_*`.
   - Webhook: RevenueCat → Integrations → Webhooks, URL `https://<cloud-run-url>/api/webhooks/revenuecat`,
     Authorization header = a long random value. Store the same value in Secret Manager
     `revenuecat-webhook-auth`.
   - Give the runtime SA access to both secrets, then add them to `deploy.yml` `--update-secrets`
     (create the secrets **before** that change merges, or the deploy fails).
4. **Test**: on a license-tester account, buy Yearly from the card. Play shows the 7-day trial; the card
   should switch to "You have Kova Premium" within seconds, and Firestore shows
   `entitlement.source = "revenuecat"`, `periodType = "trial"`. Cancel in Play: Premium stays until the
   trial ends. Test-track trials renew/expire in minutes, so expiry can be checked the same day.
