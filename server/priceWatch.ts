// Price watch (KOVA-102): when the user taps "I'll wait" on a product Kova priced, Kova keeps an eye on it
// and mentions it in chat only if the price really drops. Waiting becomes something Kova supports.
//
// Stored server-only in priceWatches/{uid}_{productId} (no Firestore rule matches it, so clients can't
// read or write it; deleted with the account in server/account.ts). Prices come from Channel3, never the AI.
// Pure helpers, unit-tested in server/priceWatch.test.ts.

export const MAX_ACTIVE_WATCHES = 5;
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000; // at most one Channel3 check per watch every 6 hours
export const WATCH_DAYS = 30; // a watch ends after 30 days
export const DROP_RATIO = 0.97; // only a real drop counts: at least 3% and at least 1 unit below the reference
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PriceWatch {
  uid: string;
  productId: string;
  title: string;
  watchedPrice: number; // price when the user chose to wait
  currency: string;
  domain: string;
  imageUrl?: string; // for the drop card (KOVA-103)
  status: 'active' | 'expired' | 'stopped';
  createdAt: string; // ISO
  lastCheckedAt: string | null;
  lastPrice: number;
  notifiedPrice: number | null; // last price Kova told the user about
}

export interface PriceDrop {
  productId: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  domain: string;
  lowestIn30Days?: boolean;
  simulated?: boolean;
  imageUrl?: string;
}

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function watchDocId(uid: string, productId: string): string {
  return `${uid}_${productId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100)}`;
}

/** A new watch from the app's request, or null if anything is missing or odd. The price is re-checked by the server later anyway. */
export function watchRecord(uid: string, body: any, nowIso: string): PriceWatch | null {
  const productId = clip(body?.productId, 120);
  const title = clip(body?.title, 200);
  const price = Number(body?.price);
  const currency = clip(body?.currency, 10).toUpperCase();
  const domain = clip(body?.domain, 80).toLowerCase();
  if (!uid || !productId || !title || !Number.isFinite(price) || price <= 0 || price > 1_000_000) return null;
  if (!/^[A-Z]{3}$/.test(currency) || !/^[a-z0-9.-]{3,80}$/.test(domain)) return null;
  const image = clip(body?.imageUrl, 500);
  return {
    uid,
    productId,
    ...(/^https:\/\/[^\s"'<>]{8,500}$/.test(image) ? { imageUrl: image } : {}),
    title,
    watchedPrice: Math.round(price * 100) / 100,
    currency,
    domain,
    status: 'active',
    createdAt: nowIso,
    lastCheckedAt: null,
    lastPrice: Math.round(price * 100) / 100,
    notifiedPrice: null,
  };
}

/** 'check' when it's time to look again, 'expire' after 30 days, 'skip' otherwise. */
export function watchAction(w: PriceWatch, now: number): 'check' | 'expire' | 'skip' {
  if (w.status !== 'active') return 'skip';
  const created = Date.parse(w.createdAt);
  if (Number.isFinite(created) && now - created > WATCH_DAYS * DAY_MS) return 'expire';
  const last = w.lastCheckedAt ? Date.parse(w.lastCheckedAt) : NaN;
  return Number.isFinite(last) && now - last < CHECK_EVERY_MS ? 'skip' : 'check';
}

/**
 * A drop worth mentioning, or null. Compared with the last price Kova mentioned (or the price when the
 * user chose to wait), so the same drop is never announced twice and small wobbles are ignored.
 */
export function priceDrop(w: PriceWatch, current: { price: number; currency: string; domain: string } | null): PriceDrop | null {
  if (!current || current.currency !== w.currency || !(current.price > 0)) return null;
  const reference = w.notifiedPrice ?? w.watchedPrice;
  if (current.price > reference * DROP_RATIO || reference - current.price < 1) return null;
  return {
    productId: w.productId,
    title: w.title,
    oldPrice: w.watchedPrice,
    newPrice: Math.round(current.price * 100) / 100,
    currency: w.currency,
    domain: current.domain,
    ...(w.imageUrl ? { imageUrl: w.imageUrl } : {}),
  };
}

/** For testing on the live demo by an admin only: a clearly marked, made-up 15% drop. Never stored. */
export function simulatedDrop(w: PriceWatch): PriceDrop {
  return {
    productId: w.productId,
    title: w.title,
    oldPrice: w.watchedPrice,
    newPrice: Math.round(w.watchedPrice * 0.85 * 100) / 100,
    currency: w.currency,
    domain: w.domain,
    ...(w.imageUrl ? { imageUrl: w.imageUrl } : {}),
    simulated: true,
  };
}
