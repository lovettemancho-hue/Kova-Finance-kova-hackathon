import { Capacitor } from '@capacitor/core';
import { Purchases, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { fetchWithAuth } from '../utils/apiClient';

// Google Play subscriptions through RevenueCat (KOVA-026).
// The public SDK key (goog_...) is meant to ship in the app; set VITE_REVENUECAT_GOOGLE_API_KEY when
// building the Android app. The secret key never comes here: it lives on the server.
const REVENUECAT_GOOGLE_API_KEY: string = import.meta.env.VITE_REVENUECAT_GOOGLE_API_KEY || '';

export const WEB_PREMIUM_MESSAGE = 'Premium is available in the Kova Android app.';
export const PURCHASES_SOON_MESSAGE = 'Premium purchases open soon in Google Play.';

/** Why a purchase can't start here: web vs an Android build without billing set up yet. */
export function unavailableMessage(): string {
  return Capacitor.isNativePlatform() ? PURCHASES_SOON_MESSAGE : WEB_PREMIUM_MESSAGE;
}
export const MANAGE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

export type BillingPeriod = 'annual' | 'monthly';

export interface PlanOption {
  period: BillingPeriod;
  priceString: string; // localized by Google Play, e.g. "$79.99" or "8 000 FCFA"
  pricePerMonthString: string | null;
  trialDays: number; // 0 when no free trial applies to this user
  pkg: PurchasesPackage;
}

export interface PremiumPlans {
  annual: PlanOption | null;
  monthly: PlanOption | null;
  /** Whole-percent saving of annual vs 12 months of monthly, from Play's real prices. */
  annualSavingPercent: number | null;
}

export interface PurchaseResult {
  ok: boolean;
  /** Plan the server confirmed after the purchase, when it could. */
  plan?: 'free' | 'premium';
  message?: string;
}

let configured = false;

// The plan picked on the Premium card. The card's many callers only pass "upgrade", so the choice is
// kept here and used by purchasePremiumSubscription() (annual is the default).
let selectedPeriod: BillingPeriod = 'annual';
export function selectBillingPeriod(period: BillingPeriod) {
  selectedPeriod = period;
}

export function billingAvailable(): boolean {
  return Capacitor.isNativePlatform() && Boolean(REVENUECAT_GOOGLE_API_KEY) && !REVENUECAT_GOOGLE_API_KEY.includes('placeholder');
}

export async function initBilling(userId?: string) {
  if (!billingAvailable() || !userId) return;
  try {
    if (!configured) {
      // appUserID = Firebase UID, so the server can look the purchase up by the same id.
      await Purchases.configure({ apiKey: REVENUECAT_GOOGLE_API_KEY, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn({ appUserID: userId });
    }
  } catch (error: any) {
    console.warn('[Billing] RevenueCat configure failed:', error?.code || error?.message || error);
  }
}

function trialDaysOf(pkg: PurchasesPackage): number {
  const phase = pkg.product?.defaultOption?.freePhase;
  if (!phase?.billingPeriod) return 0;
  const { unit, value } = phase.billingPeriod as { unit: string; value: number };
  const perUnit: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
  return Math.round((perUnit[unit] || 0) * (value || 0));
}

function toOption(period: BillingPeriod, pkg: PurchasesPackage | null | undefined): PlanOption | null {
  if (!pkg?.product) return null;
  return {
    period,
    priceString: pkg.product.priceString,
    pricePerMonthString: pkg.product.pricePerMonthString || null,
    trialDays: trialDaysOf(pkg),
    pkg,
  };
}

/** Prices and trial from Google Play (via RevenueCat), or null on web / before billing is set up. */
export async function getPremiumPlans(): Promise<PremiumPlans | null> {
  if (!billingAvailable() || !configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    const annual = toOption('annual', current.annual);
    const monthly = toOption('monthly', current.monthly);
    const a = current.annual?.product?.price;
    const m = current.monthly?.product?.price;
    const annualSavingPercent = a && m && m * 12 > a ? Math.floor((1 - a / (m * 12)) * 100) : null;
    return annual || monthly ? { annual, monthly, annualSavingPercent } : null;
  } catch (error: any) {
    console.warn('[Billing] Could not load plans:', error?.code || error?.message || error);
    return null;
  }
}

/** Asks the server to confirm the purchase with RevenueCat and returns the plan it decided. */
async function confirmWithServer(): Promise<'free' | 'premium' | undefined> {
  try {
    const res = await fetchWithAuth('/api/billing/sync', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    return res.ok && (data.plan === 'premium' || data.plan === 'free') ? data.plan : undefined;
  } catch {
    return undefined;
  }
}

// Runs the Google Play purchase (with the free trial when the user is eligible). Success here does
// NOT grant Premium: the server checks RevenueCat and sets the entitlement (KOVA-026).
export async function purchasePremiumSubscription(period: BillingPeriod = selectedPeriod): Promise<PurchaseResult> {
  if (!billingAvailable() || !configured) {
    return { ok: false, message: unavailableMessage() };
  }
  try {
    const plans = await getPremiumPlans();
    const option = (period === 'annual' ? plans?.annual : plans?.monthly) || plans?.annual || plans?.monthly;
    if (!option) return { ok: false, message: 'Premium is not available to buy right now. Please try again later.' };

    await Purchases.purchasePackage({ aPackage: option.pkg });
    return { ok: true, plan: await confirmWithServer() };
  } catch (error: any) {
    if (error?.userCancelled) return { ok: false };
    console.error('[Billing] Purchase failed:', error?.code || error?.message || error);
    return { ok: false, message: 'The purchase was not completed. You have not been charged.' };
  }
}

/** Restores a subscription bought on another phone or after reinstalling. */
export async function restorePremium(): Promise<PurchaseResult> {
  if (!billingAvailable() || !configured) return { ok: false, message: unavailableMessage() };
  try {
    await Purchases.restorePurchases();
    const plan = await confirmWithServer();
    return { ok: plan === 'premium', plan, message: plan === 'premium' ? undefined : 'No active Premium subscription was found for this Google account.' };
  } catch (error: any) {
    console.error('[Billing] Restore failed:', error?.code || error?.message || error);
    return { ok: false, message: "Couldn't restore purchases right now. Please try again." };
  }
}
