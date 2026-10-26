// Asks the server for a real product price when "Can I afford this?" has no price (KOVA-101).
// Any failure returns null, and the app falls back to asking "How much is it?".
import { fetchWithAuth } from './apiClient';

export interface PriceQuote {
  productId: string;
  title: string;
  price: number;
  currency: string;
  domain: string;
  stores: number;
  maxPrice: number;
  imageUrl?: string;
  source: 'Channel3';
}

export async function lookupPrice(item: string, currency: string, timeoutMs = 8000): Promise<PriceQuote | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchWithAuth('/api/price-lookup', {
      method: 'POST',
      body: JSON.stringify({ item, currency }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const q = data?.quote;
    return q && typeof q.price === 'number' && q.price > 0 && typeof q.title === 'string' ? (q as PriceQuote) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A short product name for the card and the log entry. Mirrors shortTitle in server/channel3.ts. */
export function shortProductName(title: string, max = 48): string {
  const first = title.split(/\s[-–|]\s|,|\(/)[0].replace(/\s+/g, ' ').trim() || title.trim();
  if (first.length <= max) return first;
  const cut = first.slice(0, max - 1);
  return `${(cut.includes(' ') ? cut.slice(0, cut.lastIndexOf(' ')) : cut).trimEnd()}…`;
}

/** "I'll wait" on a priced product: ask the server to watch its price (KOVA-102). */
export async function watchPrice(w: { productId: string; title: string; price: number; currency: string; domain: string; imageUrl?: string }): Promise<'ok' | 'limit' | 'unavailable'> {
  try {
    const res = await fetchWithAuth('/api/price-watch', { method: 'POST', body: JSON.stringify(w) });
    const data = await res.json().catch(() => ({}));
    if (data?.ok) return 'ok';
    return data?.reason === 'limit' ? 'limit' : 'unavailable';
  } catch {
    return 'unavailable';
  }
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

/** Real drops on watched products since Kova last mentioned them. `simulate` only works for admin accounts. */
export async function fetchPriceUpdates(simulate = false): Promise<PriceDrop[]> {
  try {
    const res = await fetchWithAuth(`/api/price-watch/updates${simulate ? '?simulate=1' : ''}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.updates) ? data.updates.filter((u: any) => u && typeof u.newPrice === 'number' && typeof u.title === 'string') : [];
  } catch {
    return [];
  }
}
