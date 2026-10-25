import { parsePayPalCsv, ImportedTransaction, ParseResult } from './parsePayPal';
import { analyze, Analysis, RecurringCharge } from './analyze';

export * from './parsePayPal';
export * from './analyze';

// ---------- savings-goal tie-in ----------

export interface GoalLike {
  title: string;
  targetAmount: number;
  currentAmount: number;
}

export interface GoalImpact {
  remaining: number;
  freedPerMonth: number;
  monthsToReach: number | null; // months to finish the goal using ONLY the freed money
}

/**
 * Honest maths only: how long the freed-up money alone would take to cover what is left.
 * It does not claim to know the user's current saving pace.
 */
export function goalImpact(goal: GoalLike, freedPerMonth: number): GoalImpact {
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const monthsToReach =
    freedPerMonth > 0 && remaining > 0 ? Math.ceil(remaining / freedPerMonth) : remaining === 0 ? 0 : null;
  return { remaining, freedPerMonth, monthsToReach };
}

// ---------- what may be sent to the AI ----------

export interface AiCheckinPayload {
  FACTS: {
    currency: string;
    coversDays: number;
    partialPeriod: boolean;
    totalSpent: number;
    averageMonthlySpend: number;
    activeRecurringMonthly: number;
    activeRecurringAnnual: number;
  };
  recurring: {
    merchant: string;
    interval: string;
    intervalAssumed: boolean;
    amount: number;
    annualCost: number;
    occurrences: number;
    stillActive: boolean;
    priceChange?: { from: number; to: number };
  }[];
  unfamiliar: { merchant: string; amount: number; date: string }[];
}

/**
 * Builds the ONLY data that leaves the device for the AI step: totals and a handful of
 * flagged merchants. No emails, no addresses, no transaction IDs, no full history.
 */
export function toAiPayload(a: Analysis): AiCheckinPayload {
  return {
    FACTS: {
      currency: a.currency,
      coversDays: a.coversDays,
      partialPeriod: a.partialPeriod,
      totalSpent: a.totalSpent,
      averageMonthlySpend: a.averageMonthlySpend,
      activeRecurringMonthly: a.activeMonthlyTotal,
      activeRecurringAnnual: a.activeAnnualTotal,
    },
    recurring: a.recurring.slice(0, 6).map((r: RecurringCharge) => ({
      merchant: r.merchant.slice(0, 60),
      interval: r.interval,
      intervalAssumed: r.intervalAssumed,
      amount: r.latestAmount,
      annualCost: r.annualCost,
      occurrences: r.occurrences,
      stillActive: r.stillActive,
      ...(r.priceChange ? { priceChange: r.priceChange } : {}),
    })),
    unfamiliar: a.unfamiliar.map((u) => ({
      merchant: u.merchant.slice(0, 60),
      amount: u.amount,
      date: u.date,
    })),
  };
}

// ---------- optional: add to Kova's expense log ----------

export interface ExpenseLike {
  id: string;
  label: string;
  category: 'Subscriptions' | 'Other';
  amount: number;
  type: 'outcome';
  timestamp: string;
  nativeCurrency: string;
}

/** Spending rows only. Money coming in is not imported. */
export function toExpenseRows(
  transactions: ImportedTransaction[],
  analysis: Analysis
): ExpenseLike[] {
  const subscriptionKeys = new Set(analysis.recurring.map((r) => r.merchant.toLowerCase()));
  return transactions
    .filter((t) => t.direction === 'out' && (t.type === 'purchase' || t.type === 'subscription_payment'))
    .map((t) => ({
      id: `paypal-${t.id}`,
      label: t.merchant,
      category:
        t.type === 'subscription_payment' || subscriptionKeys.has(t.merchant.toLowerCase())
          ? ('Subscriptions' as const)
          : ('Other' as const),
      amount: t.amount,
      type: 'outcome' as const,
      timestamp: t.date,
      nativeCurrency: t.currency,
    }));
}

// ---------- one call for the UI ----------

export interface ImportOutcome {
  parse: ParseResult;
  analysis: Analysis | null;
}

export function readPayPalFile(text: string, options: { asOf?: Date } = {}): ImportOutcome {
  const parse = parsePayPalCsv(text);
  if (!parse.ok) return { parse, analysis: null };
  return { parse, analysis: analyze(parse.transactions, options) };
}
