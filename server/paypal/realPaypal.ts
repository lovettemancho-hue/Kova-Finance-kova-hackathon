import type { PayPalProvider, PayPalSubscription, PayPalTransaction } from './types';

// REAL PayPal (sandbox) provider.
// Tested against the sandbox with scripts/paypal-sandbox.ts (KOVA-020). Never point it at live PayPal
// without reviewing: it reads Kova's own business account, which is only right for the demo.

const BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set');
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error(`PayPal token request failed (${res.status})`);
  }
  const data: any = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 300) * 1000,
  };
  return cachedToken.value;
}

async function paypalFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return res;
}

// PayPal wants e.g. 2026-09-10T00:00:00-0000
function ppDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, '-0000');
}

// Demo model (scripts/paypal-sandbox.ts): Kova's sandbox BUSINESS account plays the stores
// (StreamPlus, CloudBox, FreshMart...) and the sandbox PERSONAL account is "the user". Transaction
// Search reports from the business side, so a payment the business RECEIVED is money the user SPENT.
// That is the view the check-in shows. Store names come from the plan's product or the order's item.

const productNames = new Map<string, string>(); // product_id -> name (stable, cached per instance)

async function productName(productId: string | undefined): Promise<string | null> {
  if (!productId) return null;
  if (productNames.has(productId)) return productNames.get(productId)!;
  const res = await paypalFetch(`/v1/catalogs/products/${encodeURIComponent(productId)}`);
  if (!res.ok) return null;
  const name = String((await res.json())?.name || '').slice(0, 80) || null;
  if (name) productNames.set(productId, name);
  return name;
}

function mapTransaction(
  item: any,
  subMerchants: Map<string, string>,
  subsByPlanName: Map<string, PayPalSubscription>
): PayPalTransaction | null {
  const info = item?.transaction_info;
  if (!info?.transaction_id) return null;

  const rawValue = Number(info.transaction_amount?.value ?? 0);
  if (!Number.isFinite(rawValue) || rawValue === 0) return null;
  const eventCode: string = info.transaction_event_code || '';
  // Only payments and refunds; skip transfers, holds and fee lines (T03xx, T05xx, T21xx...).
  if (!/^T0[0-2]|^T11/.test(eventCode)) return null;

  // The sandbox often doesn't link a subscription payment to its subscription id; the payment's
  // subject is then the plan name ("XK Digital Services (monthly)"), so match on that (KOVA-079).
  const subject = String(info.transaction_subject || item?.cart_info?.item_details?.[0]?.item_name || '').trim();
  const subscriptionId =
    info.paypal_reference_id_type === 'SUB' && info.paypal_reference_id
      ? info.paypal_reference_id
      : subsByPlanName.get(subject.toLowerCase())?.id;
  let type: PayPalTransaction['type'] = 'purchase';
  if (subscriptionId || eventCode === 'T0002') type = 'subscription_payment';
  else if (eventCode.startsWith('T11')) type = 'refund';

  const merchant =
    (subscriptionId && subMerchants.get(subscriptionId)) ||
    item?.cart_info?.item_details?.[0]?.item_name ||
    info.transaction_subject ||
    'Unknown merchant';

  return {
    id: info.transaction_id,
    date: info.transaction_initiation_date || new Date().toISOString(),
    amount: Math.abs(rawValue),
    currency: info.transaction_amount?.currency_code || 'USD',
    // Business received (+) = the user paid out; business paid back (-) = a refund to the user.
    direction: rawValue > 0 ? 'out' : 'in',
    merchant: String(merchant).slice(0, 80),
    type,
    ...(subscriptionId ? { subscriptionId } : {}),
  };
}

async function mapSubscription(s: any): Promise<PayPalSubscription> {
  const status = ['ACTIVE', 'CANCELLED', 'SUSPENDED'].includes(s.status) ? s.status : 'OTHER';
  const cycle = (s.plan?.billing_cycles || []).find((c: any) => c.tenure_type === 'REGULAR') || s.plan?.billing_cycles?.[0];
  const price = cycle?.pricing_scheme?.fixed_price || s.billing_info?.last_payment?.amount;
  const unit = cycle?.frequency?.interval_unit;
  return {
    id: s.id,
    planName: s.plan?.name || 'Subscription',
    merchant: (await productName(s.plan?.product_id)) || s.plan?.name || 'Subscription',
    status,
    amount: Number(price?.value ?? 0),
    currency: price?.currency_code || 'USD',
    interval: unit === 'WEEK' || unit === 'YEAR' ? unit : 'MONTH',
    startedAt: s.start_time || s.create_time || new Date().toISOString(),
  };
}

function subscriptionIds(): string[] {
  // PayPal has no "list every subscription" call, so the demo reads the ones the seed script created.
  return (process.env.PAYPAL_SUBSCRIPTION_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function fetchSubscriptions(): Promise<PayPalSubscription[]> {
  const out: PayPalSubscription[] = [];
  for (const id of subscriptionIds()) {
    const res = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(id)}?fields=plan`);
    if (res.ok) out.push(await mapSubscription(await res.json()));
  }
  return out;
}

export const realPayPal: PayPalProvider = {
  mode: 'real',

  async getTransactions(_uid, days) {
    // The Transaction Search API limits each request to a ~31-day window.
    const windowDays = Math.min(days, 31);
    const end = new Date();
    const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      start_date: ppDate(start),
      end_date: ppDate(end),
      fields: 'transaction_info,cart_info',
      page_size: '100',
    });

    const [res, subs] = await Promise.all([
      paypalFetch(`/v1/reporting/transactions?${params.toString()}`),
      fetchSubscriptions().catch(() => [] as PayPalSubscription[]),
    ]);
    if (!res.ok) {
      throw new Error(`PayPal transaction search failed (${res.status})`);
    }
    const subMerchants = new Map(subs.map((s) => [s.id, s.merchant]));
    const subsByPlanName = new Map(subs.map((s) => [s.planName.trim().toLowerCase(), s]));
    const data: any = await res.json();
    return (data.transaction_details || [])
      .map((item: any) => mapTransaction(item, subMerchants, subsByPlanName))
      .filter((t: PayPalTransaction | null): t is PayPalTransaction => t !== null);
  },

  async getSubscriptions(_uid) {
    return fetchSubscriptions();
  },

  async cancelSubscription(_uid, subscriptionId, reason) {
    // Only subscriptions the demo knows about can be cancelled from Kova.
    if (!subscriptionIds().includes(subscriptionId)) {
      return { ok: false, message: 'Kova can only manage the demo subscriptions.' };
    }
    const res = await paypalFetch(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      { method: 'POST', body: JSON.stringify({ reason: reason.slice(0, 128) }) }
    );
    if (res.status === 204 || res.ok) {
      return { ok: true, message: 'Cancelled in the PayPal sandbox.' };
    }
    if (res.status === 422) {
      return { ok: true, message: 'This subscription was already cancelled in PayPal.' };
    }
    return { ok: false, message: "PayPal couldn't cancel it right now, and nothing was changed." };
  },
};
