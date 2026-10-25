import type { ImportedTransaction } from './parsePayPal';

// Everything here is plain arithmetic and pattern matching. No AI is involved, so the
// numbers are repeatable and the app can show its evidence for every claim.

export type Interval = 'weekly' | 'monthly' | 'yearly';

export interface RecurringCharge {
  key: string;
  merchant: string;
  interval: Interval;
  intervalAssumed: boolean; // true when PayPal labelled it recurring but we only saw one charge
  latestAmount: number;
  currency: string;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  nextExpected: string;
  monthlyCost: number;
  annualCost: number;
  confidence: 'high' | 'medium';
  stillActive: boolean;
  priceChange?: { from: number; to: number };
  evidence: { date: string; amount: number }[]; // most recent first, up to 6
}

export interface UnfamiliarCharge {
  id: string;
  merchant: string;
  amount: number;
  currency: string;
  date: string;
}

export interface Analysis {
  currency: string;
  dateRange: { from: string; to: string } | null;
  coversDays: number;
  partialPeriod: boolean; // true when the file covers under ~4 weeks
  transactionCount: number;
  totalSpent: number;
  averageMonthlySpend: number;
  topMerchants: { merchant: string; total: number; count: number }[];
  recurring: RecurringCharge[]; // active ones first, then by annual cost
  activeMonthlyTotal: number;
  activeAnnualTotal: number;
  unfamiliar: UnfamiliarCharge[];
}

const DAY = 24 * 60 * 60 * 1000;
const PERIODS_PER_YEAR: Record<Interval, number> = { weekly: 52, monthly: 12, yearly: 1 };
const INTERVAL_DAYS: Record<Interval, number> = { weekly: 7, monthly: 30.4375, yearly: 365 };
const INTERVAL_TOLERANCE: Record<Interval, number> = { weekly: 3, monthly: 6, yearly: 15 };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dayNumber(iso: string): number {
  return Math.floor(new Date(iso).getTime() / DAY);
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Normalises a merchant name so "PAYPAL *STREAMBOX 8842" and "StreamBox" match. */
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^paypal\s*\*\s*/, '')
    .replace(/[*_\-./,#]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/^\d+$/.test(t) && !/^[a-z]?\d{3,}[a-z]?$/.test(t))
    .join(' ')
    .trim();
}

/** Statement names are often ALL CAPS ("NETFLIX.COM"); show them like a name ("Netflix.com", "Spotify USA"). */
export function prettyName(name: string): string {
  const n = name.trim();
  if (!/[A-Z]/.test(n) || n !== n.toUpperCase()) return n;
  return n
    .split(' ')
    .map((w) => (/^[A-Z&]{1,3}$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

/** Descriptors that look like a payment-processor code rather than a shop name. */
export function looksCryptic(name: string): boolean {
  const n = name.trim();
  if (n.includes('*')) return true;
  if (/\d{4,}/.test(n)) return true;
  // ALL CAPS letters/digits only, containing a digit
  if (/^[A-Z0-9 .&-]{6,}$/.test(n) && /\d/.test(n)) return true;
  return false;
}

function classifyInterval(medianDays: number): Interval | null {
  if (medianDays >= 5 && medianDays <= 9) return 'weekly';
  if (medianDays >= 25 && medianDays <= 35) return 'monthly';
  if (medianDays >= 350 && medianDays <= 380) return 'yearly';
  return null;
}

function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY).toISOString();
}

export function detectRecurring(
  spend: ImportedTransaction[],
  asOfDay: number
): RecurringCharge[] {
  const groups = new Map<string, ImportedTransaction[]>();
  for (const t of spend) {
    const key = merchantKey(t.merchant);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(t);
    groups.set(key, list);
  }

  const out: RecurringCharge[] = [];

  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));

    // drop charges that land within 3 days of the previous one (retries / double rows)
    const series: ImportedTransaction[] = [];
    for (const t of sorted) {
      const prev = series[series.length - 1];
      if (prev && dayNumber(t.date) - dayNumber(prev.date) < 3) continue;
      series.push(t);
    }

    const labelled = series.some((t) => t.type === 'subscription_payment');
    if (series.length < 2 && !labelled) continue;

    // Prices of real subscriptions are steady. Allow at most ONE price change;
    // varying amounts (groceries, fuel) are habits, not subscriptions.
    let steps = 0;
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1].amount;
      const b = series[i].amount;
      if (Math.abs(b - a) / Math.max(a, 0.01) > 0.01) steps++;
    }
    if (!labelled && steps > 1) continue;
    // Two charges at different prices is a coincidence (two Amazon orders), not a subscription.
    if (!labelled && series.length < 3 && steps > 0) continue;

    const latest = series[series.length - 1];
    const first = series[0];

    let interval: Interval | null = null;
    let intervalAssumed = false;
    let regular = false;

    if (series.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < series.length; i++) {
        gaps.push(dayNumber(series[i].date) - dayNumber(series[i - 1].date));
      }
      interval = classifyInterval(median(gaps));
      if (interval) {
        const tol = INTERVAL_TOLERANCE[interval];
        const within = gaps.filter((g) => Math.abs(g - INTERVAL_DAYS[interval!]) <= tol).length;
        regular = within / gaps.length >= 0.7;
      }
    }

    if (!interval || !regular) {
      if (labelled) {
        // PayPal itself marks these as recurring, so keep them, but be honest about the guess
        interval = interval || 'monthly';
        intervalAssumed = series.length < 2 || !regular;
      } else {
        continue;
      }
    }

    const periodDays = INTERVAL_DAYS[interval];
    const sinceLast = asOfDay - dayNumber(latest.date);
    const stillActive = sinceLast <= periodDays * 1.5 + 3;

    const amountChanged =
      series.length >= 2 &&
      Math.abs(latest.amount - first.amount) / Math.max(first.amount, 0.01) >= 0.08 &&
      Math.abs(latest.amount - first.amount) >= 0.5;

    // display name: the most common raw spelling in the group
    const spellings = new Map<string, number>();
    for (const t of series) spellings.set(t.merchant, (spellings.get(t.merchant) || 0) + 1);
    const merchant = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const perYear = PERIODS_PER_YEAR[interval];
    out.push({
      key,
      merchant,
      interval,
      intervalAssumed,
      latestAmount: round2(latest.amount),
      currency: latest.currency,
      occurrences: series.length,
      firstDate: first.date,
      lastDate: latest.date,
      nextExpected: addDaysIso(latest.date, Math.round(periodDays)),
      monthlyCost: round2((latest.amount * perYear) / 12),
      annualCost: round2(latest.amount * perYear),
      confidence: series.length >= 3 && regular ? 'high' : 'medium',
      stillActive,
      ...(amountChanged ? { priceChange: { from: round2(first.amount), to: round2(latest.amount) } } : {}),
      evidence: [...series]
        .reverse()
        .slice(0, 6)
        .map((t) => ({ date: t.date.slice(0, 10), amount: round2(t.amount) })),
    });
  }

  return out.sort((a, b) => {
    if (a.stillActive !== b.stillActive) return a.stillActive ? -1 : 1;
    return b.annualCost - a.annualCost;
  });
}

export function analyze(
  transactions: ImportedTransaction[],
  options: { asOf?: Date } = {}
): Analysis {
  const currency = transactions[0]?.currency || 'USD';

  const spend = transactions.filter(
    (t) => t.direction === 'out' && (t.type === 'purchase' || t.type === 'subscription_payment')
  );

  if (transactions.length === 0) {
    return {
      currency,
      dateRange: null,
      coversDays: 0,
      partialPeriod: true,
      transactionCount: 0,
      totalSpent: 0,
      averageMonthlySpend: 0,
      topMerchants: [],
      recurring: [],
      activeMonthlyTotal: 0,
      activeAnnualTotal: 0,
      unfamiliar: [],
    };
  }

  const dates = transactions.map((t) => t.date).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const coversDays = Math.max(1, dayNumber(to) - dayNumber(from) + 1);
  const partialPeriod = coversDays < 28;

  const asOfDay = options.asOf ? Math.floor(options.asOf.getTime() / DAY) : dayNumber(to);

  const totalSpent = round2(spend.reduce((s, t) => s + t.amount, 0));
  const averageMonthlySpend = partialPeriod
    ? totalSpent
    : round2(totalSpent / (coversDays / INTERVAL_DAYS.monthly));

  // top merchants by spend
  const byMerchant = new Map<string, { merchant: string; total: number; count: number }>();
  for (const t of spend) {
    const key = merchantKey(t.merchant) || t.merchant.toLowerCase();
    const cur = byMerchant.get(key) || { merchant: t.merchant, total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    byMerchant.set(key, cur);
  }
  const topMerchants = [...byMerchant.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((m) => ({ ...m, total: round2(m.total) }));

  const recurring = detectRecurring(spend, asOfDay);
  const recurringKeys = new Set(recurring.map((r) => r.key));

  const active = recurring.filter((r) => r.stillActive);
  const activeMonthlyTotal = round2(active.reduce((s, r) => s + r.monthlyCost, 0));
  const activeAnnualTotal = round2(active.reduce((s, r) => s + r.annualCost, 0));

  // one-off charges from merchants that look like processor codes
  const counts = new Map<string, number>();
  for (const t of spend) {
    const key = merchantKey(t.merchant) || t.merchant.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const unfamiliar: UnfamiliarCharge[] = spend
    .filter((t) => {
      const key = merchantKey(t.merchant) || t.merchant.toLowerCase();
      return (
        t.type === 'purchase' &&
        counts.get(key) === 1 &&
        !recurringKeys.has(key) &&
        looksCryptic(t.merchant)
      );
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map((t) => ({
      id: t.id,
      merchant: t.merchant,
      amount: round2(t.amount),
      currency: t.currency,
      date: t.date.slice(0, 10),
    }));

  return {
    currency,
    dateRange: { from: from.slice(0, 10), to: to.slice(0, 10) },
    coversDays,
    partialPeriod,
    transactionCount: transactions.length,
    totalSpent,
    averageMonthlySpend,
    topMerchants,
    recurring,
    activeMonthlyTotal,
    activeAnnualTotal,
    unfamiliar,
  };
}
