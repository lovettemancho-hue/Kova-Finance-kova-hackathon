// Deletes a Kova account and all its data for an emailed deletion request (KOVA-092). Runs the same
// full delete as Settings → Delete account (server/account.ts). Deleting the user in the Firebase
// console alone would leave their expenses, chats and goals behind.
//
//   npm run account:delete -- someone@example.com          shows the account, changes nothing
//   npm run account:delete -- someone@example.com --yes    deletes it
//
// Uses your own Google login (run `gcloud auth application-default login` once on this laptop); no
// key files. Prod data: check that the request came from the account's own email address first.
// The RevenueCat record is deleted too when REVENUECAT_SECRET_KEY is set in your shell.

import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { deleteAccountEverywhere } from '../server/account';
import { createBillingService } from '../server/billing';

const email = (process.argv[2] || '').trim().toLowerCase();
const confirmed = process.argv.includes('--yes');
if (!email || !email.includes('@')) {
  console.error('Usage: npm run account:delete -- someone@example.com [--yes]');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const app = initializeApp({ projectId: config.projectId });
const databaseId = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)' ? config.firestoreDatabaseId : undefined;
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const auth = getAuth(app);

async function main() {
  const user = await auth.getUserByEmail(email).catch((err) => {
    if (err?.code === 'auth/user-not-found') return null;
    throw err;
  });
  if (!user) {
    console.log(`No Kova account uses ${email}. Nothing to delete.`);
    return;
  }
  const created = user.metadata.creationTime;
  const lastSignIn = user.metadata.lastSignInTime || 'never';
  console.log(`Found ${email}: uid=${user.uid}, created ${created}, last sign-in ${lastSignIn}`);
  if (!confirmed) {
    console.log('Nothing deleted. Run again with --yes to delete this account and all its data.');
    return;
  }
  const billing = createBillingService(db, { secretKey: process.env.REVENUECAT_SECRET_KEY });
  const result = await deleteAccountEverywhere(user.uid, {
    db,
    auth,
    deleteBillingCustomer: billing.configured ? billing.deleteSubscriber : undefined,
  });
  console.log(`Deleted ${email} and all its data. RevenueCat record: ${result.billingDeleted === true ? 'deleted' : result.billingDeleted === 'failed' ? 'FAILED, delete it in the RevenueCat dashboard' : 'skipped (REVENUECAT_SECRET_KEY not set)'}.`);
}

main().catch((err) => {
  console.error(`Failed: ${err?.code || err?.message || err}`);
  process.exit(1);
});
