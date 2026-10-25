// Date helpers for expense timestamps. Kept free of React/Firebase so pure code and tests can use them
// (ExpenseContext re-exports both, so existing imports keep working).

export const parseExpenseDate = (ts?: string): Date => {
  if (!ts) return new Date();
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d;
  const directMatch = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (directMatch) {
    return new Date(parseInt(directMatch[1]), parseInt(directMatch[2]) - 1, parseInt(directMatch[3]));
  }
  return new Date();
};

export const isSameMonth = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
};
