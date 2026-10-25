import { Expense, GoalKind, SavingsGoal } from '../types';

/**
 * Debt vs savings goals (fix list item 11).
 * A debt goal tracks money paid down ("paid off", "payments"); a savings goal tracks money put
 * aside ("saved", "deposits"). Goals saved before `kind` existed are inferred from their title.
 */
const DEBT_TITLE = /\b(pay(ing)?\s*(off|down|back)|debt|loan|credit\s*card|card\s*balance|overdraft|mortgage|owe)\b/i;

export function getGoalKind(goal: Pick<SavingsGoal, 'title' | 'kind'> | null | undefined): GoalKind {
  if (!goal) return 'savings';
  if (goal.kind === 'debt' || goal.kind === 'savings') return goal.kind;
  return DEBT_TITLE.test(goal.title || '') ? 'debt' : 'savings';
}

export function isDebtGoal(goal: Pick<SavingsGoal, 'title' | 'kind'> | null | undefined): boolean {
  return getGoalKind(goal) === 'debt';
}

/** Words for the goal card and chat, so a debt never reads as "saved" or "deposits". */
export function goalWords(kind: GoalKind) {
  return kind === 'debt'
    ? { progress: 'paid off', soFar: 'paid off so far', entry: 'payment', entries: 'payments', of: 'of', targetNoun: 'to clear' }
    : { progress: 'saved', soFar: 'saved so far', entry: 'deposit', entries: 'deposits', of: 'of', targetNoun: 'target' };
}

/**
 * Moving money into a goal is a transfer, not income or spending (item 11c).
 * Legacy entries: the old allocation flow logged "Goal Contribution: …" as income, and
 * "Savings" category entries are money set aside. Both are excluded from income/spending totals.
 */
export function isGoalTransfer(e: Pick<Expense, 'label' | 'category'> | null | undefined): boolean {
  if (!e) return false;
  // "Savings" isn't in ExpenseCategory, but AI-logged entries use it.
  return (e.category as string) === 'Savings' || /^goal contribution:/i.test(e.label || '');
}

/** Debt-repayment spending that should count as progress on a debt goal. */
export function isDebtRepayment(e: Pick<Expense, 'category' | 'type'> | null | undefined): boolean {
  return Boolean(e && e.type === 'outcome' && /debt|loan|card payment/i.test(e.category || ''));
}
