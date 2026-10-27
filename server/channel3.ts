// Real product prices for "Can I afford this?" from Channel3 (KOVA-101).
//
// "Can I afford the Sony WH-1000XM5?" used to need the user to type a price. Now the server asks Channel3's
// product search (POST https://api.trychannel3.com/v1/search) for the item and returns one quote: the lowest
// in-stock price, the store and how many stores have it. The app then builds the usual affordability card.
//
// Rules, same as the rest of Kova: the price comes from Channel3's data, never from the AI; a result is only
// used when its title contains every specific word the user typed, so a vague or unrelated match is dropped
// and Kova asks for the price instead. Only the item name is sent to Channel3, never money data.
// The API key is server-only (Secret Manager channel3-api-key). Pure helpers are tested in server/channel3.test.ts.

export const CHANNEL3_BASE = 'https://api.trychannel3.com';
export const CHANNEL3_URL = 'https://api.trychannel3.com/v1/search';
const CACHE_MS = 6 * 60 * 60 * 1000; // prices don't need to be fresher than a few hours here
const CACHE_MAX = 500;

export interface PriceQuote {
  productId: string;
  title: string;
  price: number; // lowest in-stock price, in `currency`
  currency: string;
  domain: string; // store with that price, e.g. "bestbuy.com"
  stores: number; // in-stock offers in that currency
  maxPrice: number; // highest of those offers
  imageUrl?: string; // product photo (https only), for the card (KOVA-103)
  source: 'Channel3';
}

// Words that say what kind of thing it is, not which one. A query made only of these is too vague to price.
const GENERIC = new Set(
  `headphones headphone earbuds earphones phone phones smartphone laptop laptops computer pc tablet tv television
  monitor camera watch smartwatch console speaker speakers keyboard mouse charger printer shoes shoe sneakers trainers
  boots jacket coat dress shirt jeans bag backpack handbag wallet sunglasses glasses jewelry ring necklace perfume
  sofa couch chair table desk bed mattress lamp fridge microwave blender kettle vacuum bike bicycle car scooter game
  games gift present ticket tickets trip holiday vacation flight flights hotel dinner lunch breakfast meal drinks
  rent concert wedding course class gym membership haircut taxi uber subscription book books toy toys clothes outfit
  stuff thing things something`.split(/\s+/).filter(Boolean)
);
const STOP = new Set('a an the new pair of some one for my me and with that this those these it its to buy get nice cheap good best out up small big little another more really very used'.split(' '));

/** Lowercase words that matter for matching ("Sony WH-1000XM5 headphones" → sony, wh-1000xm5, headphones). */
export function queryWords(query: string): string[] {
  return (query.toLowerCase().match(/[a-z0-9][a-z0-9+\-.]*/g) || [])
    .map((w) => w.replace(/[.\-]+$/, ''))
    .filter((w) => w.length > 0 && !STOP.has(w));
}

/** Words that pin down a specific product: everything except generic kinds of things. */
export function specificWords(query: string): string[] {
  return queryWords(query).filter((w) => !GENERIC.has(w) && !GENERIC.has(w.replace(/s$/, '')));
}

/** True when the item names something specific enough to price ("sony headphones", "iphone 16"), not "headphones". */
export function isSpecificItem(item: string): boolean {
  if (!item || item === 'it' || item.length > 80) return false;
  return specificWords(item).length > 0;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Every specific word appears in the product's own name, ignoring spaces and dashes ("wh1000xm5" matches
 * "WH-1000XM5"). Only the part before "for", "compatible with", "fits" or "replacement" counts, so an
 * accessory ("Case for Sony WH-1000XM5") never stands in for the product itself (KOVA-105).
 */
export function titleMatches(title: string, query: string): boolean {
  const head = title.split(/\b(?:for|compatible with|fits|replacement)\b/i)[0];
  const t = squash(head);
  const words = specificWords(query);
  return words.length > 0 && words.every((w) => t.includes(squash(w)));
}

/** A short name for the card and the log entry: "Sony WH-1000XM5 Wireless Headphones, Black" → "Sony WH-1000XM5 Wireless Headphones". */
export function shortTitle(title: string, max = 48): string {
  const first = title.split(/\s[-–|]\s|,|\(/)[0].replace(/\s+/g, ' ').trim() || title.trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max - 1);
  return `${(cut.includes(' ') ? cut.slice(0, cut.lastIndexOf(' ')) : cut).trimEnd()}…`;
}

/** The product's main photo, https only, or undefined. */
export function mainImage(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const pick = (images as any[]).find((i) => i?.is_main_image) || images[0];
  const url = typeof pick?.url === 'string' ? pick.url.trim() : '';
  return /^https:\/\/[^\s"'<>]{8,500}$/.test(url) ? url : undefined;
}

function safeDomain(value: unknown): string {
  const d = typeof value === 'string' ? value.toLowerCase().replace(/^www\./, '').trim() : '';
  return /^[a-z0-9.-]{3,80}$/.test(d) && d.includes('.') ? d : '';
}

/**
 * Picks the quote from Channel3's results: the first (most relevant) product whose title matches, using its
 * in-stock offers in the user's currency if there are any, else USD. The lowest of those prices is the quote.
 */
export function pickQuote(products: unknown, query: string, preferredCurrency = 'USD'): PriceQuote | null {
  if (!Array.isArray(products)) return null;
  for (const p of products as any[]) {
    const title = typeof p?.title === 'string' ? p.title.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    if (!title || !titleMatches(title, query)) continue;
    const offers = (Array.isArray(p.offers) ? p.offers : [])
      .filter((o: any) => o?.availability === 'InStock')
      .map((o: any) => ({
        price: Number(o?.price?.price),
        currency: typeof o?.price?.currency === 'string' ? o.price.currency.toUpperCase() : '',
        domain: safeDomain(o?.domain),
      }))
      .filter((o: { price: number; currency: string; domain: string }) => Number.isFinite(o.price) && o.price > 0 && o.price < 1_000_000 && /^[A-Z]{3}$/.test(o.currency) && o.domain);
    if (offers.length === 0) continue;
    const want = preferredCurrency.toUpperCase();
    const currency = offers.some((o: any) => o.currency === want) ? want : offers.some((o: any) => o.currency === 'USD') ? 'USD' : offers[0].currency;
    const same = offers.filter((o: any) => o.currency === currency).sort((a: any, b: any) => a.price - b.price);
    return {
      productId: typeof p.id === 'string' ? p.id.slice(0, 120) : '',
      title,
      price: Math.round(same[0].price * 100) / 100,
      currency,
      domain: same[0].domain,
      stores: same.length,
      maxPrice: Math.round(same[same.length - 1].price * 100) / 100,
      ...(mainImage(p.images) ? { imageUrl: mainImage(p.images) } : {}),
      source: 'Channel3',
    };
  }
  return null;
}

export interface Channel3Deps {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

export function createChannel3Client(deps: Channel3Deps = {}) {
  const apiKey = deps.apiKey;
  const doFetch = deps.fetchImpl || fetch;
  const timeoutMs = deps.timeoutMs ?? 6000;
  const now = deps.now || Date.now;
  const cache = new Map<string, { at: number; quote: PriceQuote | null }>();

  /** One quote for the item, or null when Channel3 has no clear match. Throws on network or HTTP errors. */
  async function lookup(item: string, currency = 'USD'): Promise<PriceQuote | null> {
    if (!apiKey) throw new Error('channel3_not_configured');
    const query = item.replace(/\s+/g, ' ').trim().slice(0, 80);
    const key = `${currency.toUpperCase()}|${query.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.quote;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(CHANNEL3_URL, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, limit: 10, filters: { availability: ['InStock'] } }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`channel3_http_${res.status}`);
      const body: any = await res.json();
      const quote = pickQuote(body?.products, query, currency);
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: now(), quote });
      return quote;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Calls Channel3 with the key in a header and a timeout. Throws on network or HTTP errors. */
  async function call(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<any> {
    if (!apiKey) throw new Error('channel3_not_configured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(`${CHANNEL3_BASE}${path}`, {
        method: init.method,
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`channel3_http_${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const safeId = (id: string) => encodeURIComponent(String(id).slice(0, 120));

  /** Today's quote for a product Kova already showed (price watch, KOVA-102): same product, so no matching guesswork. */
  async function currentQuote(productId: string, currency = 'USD'): Promise<PriceQuote | null> {
    const product = await call(`/v1/products/${safeId(productId)}`, { method: 'GET' });
    const title = typeof product?.title === 'string' ? product.title : '';
    return title ? pickQuote([{ ...product, id: productId }], title, currency) : null;
  }

  /** Asks Channel3 to record this product's price history (KOVA-102). */
  async function startTracking(productId: string): Promise<void> {
    await call('/v0/price-tracking/start', { method: 'POST', body: { canonical_product_id: String(productId).slice(0, 120) } });
  }

  /** Price statistics over the last 30 days, or null while Channel3 has too little history. */
  async function priceStats(productId: string): Promise<PriceStats | null> {
    const body = await call(`/v0/price-tracking/history/${safeId(productId)}?days=30`, { method: 'GET' });
    return statsFromHistory(body);
  }

  return { lookup, currentQuote, startTracking, priceStats, configured: Boolean(apiKey) };
}

export interface PriceStats {
  min: number;
  max: number;
  currency: string;
  status: 'low' | 'typical' | 'high';
  points: number;
}

/** Reads Channel3's price history; null unless there are a few data points and valid statistics. */
export function statsFromHistory(body: any): PriceStats | null {
  const st = body?.statistics;
  const points = Array.isArray(body?.history) ? body.history.length : 0;
  if (!st || points < 3) return null;
  const min = Number(st.min_price);
  const max = Number(st.max_price);
  const status = st.current_status;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || !['low', 'typical', 'high'].includes(status)) return null;
  const currency = typeof st.currency === 'string' && /^[A-Za-z]{3}$/.test(st.currency) ? st.currency.toUpperCase() : 'USD';
  return { min, max, currency, status, points };
}
