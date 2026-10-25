/**
 * Live & Cached Exchange Rate Service for Kova.
 * 
 * Provides real-time currency conversion using free, no-API-key exchange rate APIs:
 * Primary: https://open.er-api.com/v6/latest/USD
 * Fallbacks: https://api.frankfurter.dev/v1/latest?base=USD, https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json
 * 
 * Caches daily to localStorage to avoid rate-limiting.
 * Includes a full fallback rate dictionary for instant, zero-latency initial rendering & offline support.
 */

const STORAGE_CACHE_KEY = 'kova_exchange_rates_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ExchangeRatesData {
  base: string;
  timestamp: number;
  rates: Record<string, number>;
}

/**
 * High-precision baseline rates relative to 1 USD.
 * Used for instant bootstrap before network response and offline fallback.
 */
export const STATIC_USD_RATES: Record<string, number> = {
  USD: 1.0,
  AED: 3.6725,
  AFN: 68.5,
  ALL: 92.4,
  AMD: 387.5,
  ANG: 1.79,
  AOA: 915.0,
  ARS: 1060.0,
  AUD: 1.55,
  AZN: 1.70,
  BAM: 1.79,
  BBD: 2.0,
  BDT: 121.5,
  BGN: 1.80,
  BHD: 0.376,
  BIF: 2950.0,
  BMD: 1.0,
  BND: 1.34,
  BOB: 6.91,
  BRL: 5.75,
  BSD: 1.0,
  BTN: 86.8,
  BWP: 13.6,
  BYN: 3.27,
  BZD: 2.0,
  CAD: 1.40,
  CDF: 2850.0,
  CHF: 0.89,
  CLP: 960.0,
  CNY: 7.25,
  COP: 4180.0,
  CRC: 508.0,
  CUP: 24.0,
  CVE: 101.5,
  CZK: 23.6,
  DJF: 177.7,
  DKK: 6.88,
  DOP: 60.5,
  DZD: 134.5,
  EGP: 50.4,
  ERN: 15.0,
  ETB: 125.0,
  EUR: 0.86,
  FJD: 2.27,
  GBP: 0.75,
  GEL: 2.81,
  GHS: 15.5,
  GMD: 71.0,
  GNF: 8650.0,
  GTQ: 7.72,
  GYD: 209.0,
  HKD: 7.78,
  HNL: 25.4,
  HRK: 6.95,
  HTG: 131.0,
  HUF: 375.0,
  IDR: 16250.0,
  ILS: 3.58,
  INR: 86.8,
  IQD: 1310.0,
  IRR: 42105.0,
  ISK: 139.0,
  JMD: 158.0,
  JOD: 0.709,
  JPY: 153.5,
  KES: 129.5,
  KGS: 87.2,
  KHR: 4040.0,
  KMF: 454.0,
  KRW: 1435.0,
  KWD: 0.308,
  KYD: 0.833,
  KZT: 498.0,
  LAK: 21800.0,
  LBP: 89500.0,
  LKR: 296.0,
  LRD: 198.0,
  LSL: 18.2,
  LYD: 4.88,
  MAD: 10.05,
  MDL: 18.2,
  MGA: 4680.0,
  MKD: 56.8,
  MMK: 2100.0,
  MNT: 3450.0,
  MOP: 8.01,
  MRU: 39.8,
  MUR: 46.5,
  MVR: 15.4,
  MWK: 1735.0,
  MXN: 20.4,
  MYR: 4.45,
  MZN: 63.9,
  NAD: 18.2,
  NGN: 1520.0,
  NIO: 36.8,
  NOK: 10.95,
  NPR: 138.8,
  NZD: 1.72,
  OMR: 0.385,
  PAB: 1.0,
  PEN: 3.75,
  PGK: 3.98,
  PHP: 58.2,
  PKR: 279.0,
  PLN: 3.96,
  PYG: 7850.0,
  QAR: 3.64,
  RON: 4.58,
  RSD: 108.0,
  RUB: 98.5,
  RWF: 1390.0,
  SAR: 3.75,
  SBD: 8.45,
  SCR: 14.2,
  SDG: 601.0,
  SEK: 10.65,
  SGD: 1.34,
  SLE: 22.8,
  SOS: 571.0,
  SRD: 35.2,
  SSP: 3100.0,
  STN: 22.6,
  SYP: 13000.0,
  SZL: 18.2,
  THB: 33.8,
  TJS: 10.9,
  TMT: 3.50,
  TND: 3.12,
  TOP: 2.38,
  TRY: 35.8,
  TTD: 6.78,
  TWD: 32.5,
  TZS: 2600.0,
  UAH: 41.6,
  UGX: 3680.0,
  UYU: 42.8,
  UZS: 12900.0,
  VES: 52.0,
  VND: 25400.0,
  VUV: 120.0,
  WST: 2.76,
  XAF: 562.3,
  XCD: 2.70,
  XOF: 562.3,
  XPF: 110.0,
  YER: 250.0,
  ZAR: 18.2,
  ZMW: 27.6,
  ZWG: 26.5,
};

// In-memory active rates cache
let inMemoryRates: Record<string, number> = { ...STATIC_USD_RATES };
let lastFetchTimestamp: number = 0;
let isFetching = false;
const listeners = new Set<() => void>();

/**
 * Loads cached exchange rates from localStorage on startup.
 */
function loadCachedRatesFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as ExchangeRatesData;
      if (data && data.rates && typeof data.rates === 'object') {
        inMemoryRates = { ...STATIC_USD_RATES, ...data.rates };
        lastFetchTimestamp = data.timestamp || 0;
      }
    }
  } catch (e) {
    // Ignore storage read errors
  }
}

// Initial storage read
if (typeof window !== 'undefined') {
  loadCachedRatesFromStorage();
}

/**
 * Returns the currently active exchange rates dictionary (base USD = 1.0).
 */
export function getActiveRates(): Record<string, number> {
  return inMemoryRates;
}

/**
 * Fetches fresh exchange rates from free, no-API-key APIs if cache is stale (>24h).
 */
export async function fetchLiveExchangeRates(forceRefresh = false): Promise<Record<string, number>> {
  const now = Date.now();
  if (!forceRefresh && lastFetchTimestamp > 0 && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return inMemoryRates;
  }

  if (isFetching) {
    return inMemoryRates;
  }

  isFetching = true;

  try {
    // Primary Provider: Open Exchange Rates API (free, CORS-enabled, 160+ currencies)
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.rates && typeof json.rates === 'object') {
        inMemoryRates = { ...STATIC_USD_RATES, ...json.rates };
        lastFetchTimestamp = now;
        try {
          localStorage.setItem(
            STORAGE_CACHE_KEY,
            JSON.stringify({
              base: 'USD',
              timestamp: now,
              rates: inMemoryRates,
            })
          );
        } catch (e) {}
        listeners.forEach((cb) => {
          try {
            cb();
          } catch (e) {}
        });
        return inMemoryRates;
      }
    }
  } catch (err) {
    console.warn('[ExchangeRates] Primary API failed, trying fallback:', err);
  }

  // Fallback 1: Frankfurter API
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD');
    if (res.ok) {
      const json = await res.json();
      if (json && json.rates) {
        inMemoryRates = { ...STATIC_USD_RATES, ...json.rates, USD: 1.0 };
        lastFetchTimestamp = now;
        try {
          localStorage.setItem(
            STORAGE_CACHE_KEY,
            JSON.stringify({
              base: 'USD',
              timestamp: now,
              rates: inMemoryRates,
            })
          );
        } catch (e) {}
        listeners.forEach((cb) => {
          try {
            cb();
          } catch (e) {}
        });
        return inMemoryRates;
      }
    }
  } catch (fallbackErr) {
    console.warn('[ExchangeRates] Fallback API failed:', fallbackErr);
  } finally {
    isFetching = false;
  }

  return inMemoryRates;
}

/**
 * Subscribe to exchange rate updates.
 */
export function subscribeToRates(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Converts an amount from `fromCurrency` to `toCurrency` based on live/cached USD exchange rates.
 * If `fromCurrency === toCurrency`, returns `amount` exactly without precision loss or drift.
 */
export function convertCurrency(
  amount: number | string | null | undefined,
  fromCurrency: string = 'USD',
  toCurrency: string = 'USD'
): number {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(num) || num === 0) {
    return 0;
  }

  const from = (fromCurrency || 'USD').toUpperCase();
  const to = (toCurrency || 'USD').toUpperCase();

  if (from === to) {
    return num;
  }

  const rates = inMemoryRates;
  const fromRate = rates[from] || STATIC_USD_RATES[from] || 1.0;
  const toRate = rates[to] || STATIC_USD_RATES[to] || 1.0;

  // Convert `from` -> USD -> `to`
  const inUSD = num / fromRate;
  const converted = inUSD * toRate;

  return converted;
}
