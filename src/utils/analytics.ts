import { CategoryBreakdownCardData, Expense, ExpenseCategory, GoalContribution } from '../types';
import { isGoalTransfer } from './goalKind';
import { parseExpenseDate, isSameMonth } from './expenseDates';
import { convertCurrency, formatWholeCurrency } from './currency';

export interface CategoryBreakdownItem {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  count: number;
}

export interface MonthlyPacingResult {
  hasEnoughHistory: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  currentSpend: number;
  historicalAvg: number;
  differencePercent: number;
  status: 'below' | 'above' | 'on_track' | 'insufficient_history';
  monthsComparedCount: number;
  headline: string;
  subtext: string;
}

/**
 * Computes category breakdown for a list of expenses in a given currency.
 * Only includes actual categories with > 0 spending (no fake padding).
 */
export function computeCategoryBreakdown(
  expenses: Expense[],
  targetCurrency: string = 'USD'
): { items: CategoryBreakdownItem[]; totalAmount: number } {
  const categoryTotals: Record<string, { amount: number; count: number }> = {};
  let totalAmount = 0;

  for (const exp of expenses) {
    const converted = convertCurrency(exp.amount, exp.nativeCurrency || 'USD', targetCurrency);
    if (converted <= 0) continue;

    totalAmount += converted;
    const cat = exp.category || 'Other';
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { amount: 0, count: 0 };
    }
    categoryTotals[cat].amount += converted;
    categoryTotals[cat].count += 1;
  }

  if (totalAmount <= 0) {
    return { items: [], totalAmount: 0 };
  }

  const items: CategoryBreakdownItem[] = Object.entries(categoryTotals)
    .map(([cat, data]) => ({
      category: cat as ExpenseCategory,
      amount: data.amount,
      percentage: Math.round((data.amount / totalAmount) * 100),
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { items, totalAmount };
}

/**
 * The chat card for "show my categories" (KOVA-080): this month's spending by category, in the
 * user's currency. Goal transfers and income are left out, like the Log totals. Pure; no AI.
 */
export function buildCategoryBreakdownCard(
  expenses: Expense[],
  currency: string,
  now: Date = new Date()
): CategoryBreakdownCardData {
  const monthSpending = expenses.filter(
    (e) => e.type === 'outcome' && !isGoalTransfer(e) && isSameMonth(parseExpenseDate(e.timestamp), now)
  );
  const { items, totalAmount } = computeCategoryBreakdown(monthSpending, currency);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    monthLabel: now.toLocaleDateString('en-US', { month: 'long' }),
    currency,
    total: r2(totalAmount),
    rows: items.map((i) => ({ category: i.category, amount: r2(i.amount) })),
  };
}

/**
 * Computes the spending pace for the selected month against the user's
 * real historical average at the same day in previous months.
 */
export function computeMonthlyPacing(
  allExpenses: Expense[],
  selectedMonthDate: Date,
  targetCurrency: string = 'USD'
): MonthlyPacingResult {
  const now = new Date();
  const isSelectedCurrentMonth = isSameMonth(selectedMonthDate, now);

  const year = selectedMonthDate.getFullYear();
  const month = selectedMonthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // If viewing current month, compare through today's day of month; if viewing past month, compare through full month
  const targetDay = isSelectedCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

  // Filter all outcome expenses
  const outcomeExpenses = allExpenses.filter((e) => e.type === 'outcome');

  // Calculate current month's spend up to targetDay
  const currentMonthSpendsUpToDay = outcomeExpenses
    .filter((e) => {
      const d = parseExpenseDate(e.timestamp);
      return (
        d.getFullYear() === year &&
        d.getMonth() === month &&
        d.getDate() <= targetDay
      );
    })
    .reduce(
      (sum, e) => sum + convertCurrency(e.amount, e.nativeCurrency || 'USD', targetCurrency),
      0
    );

  // Group historical past months (strictly prior to selectedMonthDate)
  const pastMonthsMap: Record<string, number> = {};

  outcomeExpenses.forEach((e) => {
    const d = parseExpenseDate(e.timestamp);
    const dMonthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const selectedMonthStart = new Date(year, month, 1);

    // Only look at past months that occurred before the evaluated month
    if (dMonthStart.getTime() < selectedMonthStart.getTime()) {
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      if (d.getDate() <= targetDay) {
        const conv = convertCurrency(e.amount, e.nativeCurrency || 'USD', targetCurrency);
        pastMonthsMap[monthKey] = (pastMonthsMap[monthKey] || 0) + conv;
      } else if (!pastMonthsMap[monthKey]) {
        // Ensure month key is tracked even if spend after day D was 0
        pastMonthsMap[monthKey] = 0;
      }
    }
  });

  const pastMonthKeys = Object.keys(pastMonthsMap);
  const monthsComparedCount = pastMonthKeys.length;

  // If no past months exist or historical average is 0, return honest state
  if (monthsComparedCount < 1) {
    return {
      hasEnoughHistory: false,
      dayOfMonth: targetDay,
      daysInMonth,
      currentSpend: currentMonthSpendsUpToDay,
      historicalAvg: 0,
      differencePercent: 0,
      status: 'insufficient_history',
      monthsComparedCount: 0,
      headline: 'Building your spending history',
      subtext: 'Pacing comparison activates once you have recorded spending in at least one prior month.',
    };
  }

  const historicalTotal = pastMonthKeys.reduce((sum, k) => sum + pastMonthsMap[k], 0);
  const historicalAvg = historicalTotal / monthsComparedCount;

  if (historicalAvg <= 0) {
    return {
      hasEnoughHistory: false,
      dayOfMonth: targetDay,
      daysInMonth,
      currentSpend: currentMonthSpendsUpToDay,
      historicalAvg: 0,
      differencePercent: 0,
      status: 'insufficient_history',
      monthsComparedCount,
      headline: 'Building your spending baseline',
      subtext: 'Previous recorded months had zero spending recorded up to this day.',
    };
  }

  const diffRaw = ((currentMonthSpendsUpToDay - historicalAvg) / historicalAvg) * 100;
  const diffPercent = Math.round(diffRaw);

  let status: 'below' | 'above' | 'on_track';
  let headline: string;

  if (diffPercent < -5) {
    status = 'below';
    headline = `You're pacing ${Math.abs(diffPercent)}% below your usual rate this month`;
  } else if (diffPercent > 5) {
    status = 'above';
    headline = `You're pacing ${diffPercent}% above your usual rate this month`;
  } else {
    status = 'on_track';
    headline = 'About on track with your usual pace';
  }

  const formattedCurr = formatWholeCurrency(currentMonthSpendsUpToDay, targetCurrency);
  const formattedAvg = formatWholeCurrency(historicalAvg, targetCurrency);
  const monthName = selectedMonthDate.toLocaleDateString('en-US', { month: 'short' });
  const daySuffix = isSelectedCurrentMonth ? `by Day ${targetDay}` : `in total (${monthName})`;

  const subtext = `${formattedCurr} spent ${daySuffix} vs. ${formattedAvg} typical historical pace (${monthsComparedCount} past month${monthsComparedCount > 1 ? 's' : ''}).`;

  return {
    hasEnoughHistory: true,
    dayOfMonth: targetDay,
    daysInMonth,
    currentSpend: currentMonthSpendsUpToDay,
    historicalAvg,
    differencePercent: diffPercent,
    status,
    monthsComparedCount,
    headline,
    subtext,
  };
}

/**
 * Summarizes contributions (deposits vs withdrawals) for a goal.
 */
export function computeGoalContributionSummary(
  contributions: GoalContribution[] = [],
  displayCurrency: string = 'USD',
  goalCurrency?: string
) {
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let depositCount = 0;
  let withdrawalCount = 0;

  for (const c of contributions) {
    // Untagged contributions are in the goal's currency, not USD (was showing ¥300 as ¥30,700).
    const amt = convertCurrency(c.amount, c.nativeCurrency || goalCurrency || displayCurrency, displayCurrency);
    if (amt >= 0) {
      totalDeposits += amt;
      depositCount += 1;
    } else {
      totalWithdrawals += Math.abs(amt);
      withdrawalCount += 1;
    }
  }

  const net = totalDeposits - totalWithdrawals;

  return {
    totalDeposits,
    totalWithdrawals,
    depositCount,
    withdrawalCount,
    netContribution: net,
    totalEntries: contributions.length,
  };
}
