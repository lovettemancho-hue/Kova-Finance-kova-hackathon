import { Expense } from '../types';

/**
 * "Higher than usual" (fix list item 13).
 *
 * The flag is computed from the user's own history when the Log renders. It is never stored, so
 * entries saved with the old "> 150" rule stop showing it too.
 *
 * An expense is flagged only when ALL of these hold:
 *  - it is spending (type 'outcome'), never income;
 *  - there is a baseline: at least MIN_PRIOR_ENTRIES earlier expenses, including spending in at
 *    least one earlier calendar month (same rule as the Monthly Spending Pace card);
 *  - it is at least MULTIPLIER x the median earlier expense AND larger than 90% of earlier expenses;
 *  - it isn't a known recurring amount: no earlier expense within ±RECURRING_TOLERANCE of it
 *    (so a second $1,500 rent isn't "unusual").
 */
export const MIN_PRIOR_ENTRIES = 8;
const MULTIPLIER = 2;
const RECURRING_TOLERANCE = 0.15;

type Dated = { id: string; amount: number; time: number; monthKey: number };

function monthKey(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

/** True if the ascending array has a value within [lo, hi]. */
function hasValueBetween(sorted: number[], lo: number, hi: number): boolean {
  let a = 0;
  let b = sorted.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (sorted[mid] < lo) a = mid + 1;
    else b = mid;
  }
  return a < sorted.length && sorted[a] <= hi;
}

/** Inserts `value` into an ascending array, keeping it sorted. */
function insertSorted(arr: number[], value: number): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, value);
}

/**
 * Returns the ids of expenses that are unusually high for this user.
 * @param toAmount converts an expense to one comparable amount (e.g. the active currency).
 * @param toDate parses an expense timestamp; entries without a usable date are ignored.
 */
export function findUnusualExpenseIds(
  expenses: Expense[],
  toAmount: (e: Expense) => number,
  toDate: (e: Expense) => Date | null
): Set<string> {
  const flagged = new Set<string>();

  const outcomes: Dated[] = [];
  for (const e of expenses) {
    if (!e || e.type !== 'outcome' || !e.id) continue;
    const d = toDate(e);
    const amount = Math.abs(toAmount(e));
    if (!d || isNaN(d.getTime()) || !Number.isFinite(amount) || amount <= 0) continue;
    outcomes.push({ id: e.id, amount, time: d.getTime(), monthKey: monthKey(d) });
  }
  outcomes.sort((a, b) => a.time - b.time);

  const prior: number[] = []; // ascending amounts of earlier expenses
  let earliestMonth = Infinity;

  for (const e of outcomes) {
    const hasPriorMonth = earliestMonth < e.monthKey;
    if (prior.length >= MIN_PRIOR_ENTRIES && hasPriorMonth) {
      const median = percentile(prior, 0.5);
      const p90 = percentile(prior, 0.9);
      const isRecurring = hasValueBetween(
        prior,
        e.amount * (1 - RECURRING_TOLERANCE),
        e.amount * (1 + RECURRING_TOLERANCE)
      );
      if (e.amount >= MULTIPLIER * median && e.amount > p90 && !isRecurring) flagged.add(e.id);
    }
    insertSorted(prior, e.amount);
    earliestMonth = Math.min(earliestMonth, e.monthKey);
  }

  return flagged;
}
