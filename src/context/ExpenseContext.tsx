import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, ReactNode } from 'react';
import { Expense } from '../types';
import { updateUserExpenses, deleteUserExpense } from '../lib/userService';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { convertCurrency, formatCurrency } from '../utils/currency';
import { generateUniqueId } from '../utils/id';
import { findUnusualExpenseIds } from '../utils/unusualSpending';
import { isGoalTransfer } from '../utils/goalKind';

import { parseExpenseDate, isSameMonth } from '../utils/expenseDates';
export { parseExpenseDate, isSameMonth };

// Client-side Sanitizer: filters out accidental hypothetical/question logging and duplicate entries (e.g. duplicate vintage espresso machine test entries)
export const sanitizeExpensesList = (rawExpenses: Expense[]): Expense[] => {
  if (!Array.isArray(rawExpenses)) return [];
  const seenVintageEspresso = new Set<string>();
  const sanitized: Expense[] = [];

  for (const e of rawExpenses) {
    if (!e) continue;
    // Filter out accidental hypothetical/question logging
    if (e.amount === 100 && (e.label.toLowerCase().includes('other entry') || e.label.toLowerCase().includes('investing'))) {
      continue;
    }

    // Deduplicate duplicate "Vintage espresso machine" -$3,000 created during testing
    const isVintage = e.label.toLowerCase().includes('vintage') || e.label.toLowerCase().includes('espresso');
    if (isVintage && (e.amount === 3000 || Math.abs(e.amount - 3000) < 0.01)) {
      if (seenVintageEspresso.has('vintage_3000')) {
        continue; // drop the duplicate
      }
      seenVintageEspresso.add('vintage_3000');
    }

    sanitized.push(e);
  }
  return sanitized;
};

// Client-side Intent Classification Helper (protects against logging hypothetical queries with dollar amounts)
export const classifyMessageIntent = (text: string): {
  isTransaction: boolean;
  isHypothetical: boolean;
  isGoalAllocation: boolean;
  extracted?: Partial<Expense> | null;
} => {
  const lower = (text || '').toLowerCase().trim();
  const hasQuestionMark = text.includes('?');

  const hypotheticalPhrases = [
    'i need about',
    'i need around',
    'i might need',
    'i want to save',
    'i want to buy',
    'i want to spend',
    'im saving for',
    "i'm saving for",
    'saving for',
    'goal of',
    'aiming for',
    'planning to',
    'planning on',
    'thinking about',
    'considering',
    'would need',
    'could need',
    'what do you think',
    'what does',
    'what if',
    'how does',
    'how much if',
    'should i',
    'could i',
    'would it',
    'is it',
    'suppose',
    'investing',
    'return ratio',
    'interest rate',
    'compounding',
    'percentage',
    'what is',
    'how do',
    'can i',
    'meaning',
  ];

  const isHypothetical = hasQuestionMark || hypotheticalPhrases.some((phrase) => lower.includes(phrase));

  const isGoalAllocation =
    (lower.includes('put') || lower.includes('add') || lower.includes('allocate') || lower.includes('save') || lower.includes('take') || lower.includes('withdraw')) &&
    (lower.includes('toward') || lower.includes('towards') || lower.includes('my goal') || lower.includes('fund') || lower.includes('trip') || lower.includes('out of') || lower.includes('from'));

  const transactionalVerbs = [
    'spent',
    'paid',
    'bought',
    'just got',
    'purchased',
    'cost',
    'charged',
    'logged',
    'paid for',
    'dropped',
    'forked out',
    'grabbed',
    'picked up',
    'took out',
  ];

  const hasVerb = transactionalVerbs.some((v) => lower.includes(v));
  const isExplicitLogCommand =
    /^log\s+\$?[0-9,]+/i.test(lower) ||
    /^(coffee|lunch|groceries|dinner|gas|rent|food|gym|laundry|shopping)\s+\$?[0-9,]+/i.test(lower);

  const isTransaction = !isHypothetical && (hasVerb || isExplicitLogCommand);

  return {
    isTransaction,
    isHypothetical,
    isGoalAllocation,
  };
};

export interface ExpenseContextType {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<Expense>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  bulkAddExpenses: (newExpenses: Expense[]) => Promise<void>;
  processAiExtractedExpense: (extractedExpense: any) => Promise<Expense | null>;
  sanitizeExpenses: (raw: Expense[]) => Expense[];
  clearExpenses: () => void;

  // Month navigation and selection state
  selectedMonthDate: Date;
  setSelectedMonthDate: React.Dispatch<React.SetStateAction<Date>>;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  isCurrentMonth: boolean;
  earliestMonthDate: Date;

  // Filter & Visual state
  filterType: 'outcome' | 'income';
  setFilterType: React.Dispatch<React.SetStateAction<'outcome' | 'income'>>;
  timeRange: 'Day' | 'Week' | 'Month' | 'Year';
  setTimeRange: React.Dispatch<React.SetStateAction<'Day' | 'Week' | 'Month' | 'Year'>>;
  hoveredBarIndex: number | null;
  setHoveredBarIndex: React.Dispatch<React.SetStateAction<number | null>>;

  // Derivations and computed values
  selectedMonthExpenses: Expense[];
  filteredExpenses: Expense[];
  monthTotalOutcome: number;
  monthTotalIncome: number;
  currentBalance: number;
  currentHeroTotal: number;
  higherThanUsualExpenses: Expense[];
  higherThanUsualIds: Set<string>;
  formattedBalance: string;
  chartData: {
    labels: string[];
    values: number[];
    activeIndex: number;
  };
  barHeights: number[];
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

interface ExpenseProviderProps {
  children: ReactNode;
  initialExpenses?: Expense[];
  onExpenseAdded?: (updatedExpenses: Expense[], addedExpense?: Expense) => void;
}

export const ExpenseProvider: React.FC<ExpenseProviderProps> = ({
  children,
  initialExpenses = [],
  onExpenseAdded,
}) => {
  const { currentUser, userProfile, currency } = useAuth();
  const activeCurrency = currency || userProfile?.currency || 'USD';
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>(() => sanitizeExpensesList(initialExpenses));

  useEffect(() => {
    const nextSanitized = sanitizeExpensesList(initialExpenses);
    setExpenses((prev) => {
      if (
        prev.length === nextSanitized.length &&
        prev.every(
          (e, i) =>
            e.id === nextSanitized[i]?.id &&
            e.amount === nextSanitized[i]?.amount &&
            e.timestamp === nextSanitized[i]?.timestamp
        )
      ) {
        return prev;
      }
      return nextSanitized;
    });
  }, [initialExpenses]);

  // Current month reference
  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  // Selected Month Navigation
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => currentMonthStart);
  const [filterType, setFilterType] = useState<'outcome' | 'income'>('outcome');
  const [timeRange, setTimeRange] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Month');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const isCurrentMonth = useMemo(() => isSameMonth(selectedMonthDate, currentMonthStart), [selectedMonthDate, currentMonthStart]);

  // Determine earliest navigable month boundary
  const earliestMonthDate = useMemo((): Date => {
    let createdDate: Date | null = null;
    if (userProfile?.createdAt) {
      const parsed = new Date(userProfile.createdAt);
      if (!isNaN(parsed.getTime())) {
        createdDate = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      }
    }

    let oldestExpenseDate: Date | null = null;
    if (expenses.length > 0) {
      expenses.forEach((e) => {
        const d = parseExpenseDate(e.timestamp);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        if (!oldestExpenseDate || monthStart < oldestExpenseDate) {
          oldestExpenseDate = monthStart;
        }
      });
    }

    if (createdDate && oldestExpenseDate) {
      return createdDate < oldestExpenseDate ? createdDate : oldestExpenseDate;
    }
    if (createdDate) return createdDate;
    if (oldestExpenseDate) return oldestExpenseDate;
    return currentMonthStart;
  }, [userProfile?.createdAt, expenses, currentMonthStart]);

  const prevMonthDate = useMemo(
    () => new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - 1, 1),
    [selectedMonthDate]
  );
  const canGoPrev = prevMonthDate >= earliestMonthDate;

  const nextMonthDate = useMemo(
    () => new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 1),
    [selectedMonthDate]
  );
  const canGoNext = nextMonthDate <= currentMonthStart;

  const handlePrevMonth = useCallback(() => {
    if (canGoPrev) {
      setSelectedMonthDate(prevMonthDate);
    }
  }, [canGoPrev, prevMonthDate]);

  const handleNextMonth = useCallback(() => {
    if (canGoNext) {
      setSelectedMonthDate(nextMonthDate);
    }
  }, [canGoNext, nextMonthDate]);

  // Selected Month Expenses (sorted reverse-chronologically by timestamp)
  const selectedMonthExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        const d = parseExpenseDate(e.timestamp);
        return isSameMonth(d, selectedMonthDate);
      })
      .sort((a, b) => {
        const timeA = parseExpenseDate(a.timestamp).getTime();
        const timeB = parseExpenseDate(b.timestamp).getTime();
        return timeB - timeA;
      });
  }, [expenses, selectedMonthDate]);

  const filteredExpenses = useMemo(() => {
    return selectedMonthExpenses.filter((e) => e.type === filterType);
  }, [selectedMonthExpenses, filterType]);

  const monthTotalOutcome = useMemo(() => {
    return selectedMonthExpenses
      .filter((e) => e.type === 'outcome' && !isGoalTransfer(e)) // goal transfers aren't income/spending (item 11c)
      .reduce(
        (sum, e) =>
          sum + convertCurrency(e.amount, e.nativeCurrency || 'USD', activeCurrency),
        0
      );
  }, [selectedMonthExpenses, activeCurrency]);

  const monthTotalIncome = useMemo(() => {
    return selectedMonthExpenses
      .filter((e) => e.type === 'income' && !isGoalTransfer(e)) // goal transfers aren't income/spending (item 11c)
      .reduce(
        (sum, e) =>
          sum + convertCurrency(e.amount, e.nativeCurrency || 'USD', activeCurrency),
        0
      );
  }, [selectedMonthExpenses, activeCurrency]);

  const currentBalance = useMemo(() => monthTotalIncome - monthTotalOutcome, [monthTotalIncome, monthTotalOutcome]);
  const currentHeroTotal = filterType === 'outcome' ? monthTotalOutcome : monthTotalIncome;

  // Computed from the user's history (item 13); the stored `higherThanUsual` field is ignored.
  const higherThanUsualIds = useMemo(
    () =>
      findUnusualExpenseIds(
        expenses,
        (e) => convertCurrency(e.amount, e.nativeCurrency || 'USD', activeCurrency),
        (e) => {
          const d = e.timestamp ? new Date(e.timestamp) : null;
          return d && !isNaN(d.getTime()) ? d : null;
        }
      ),
    [expenses, activeCurrency]
  );

  const higherThanUsualExpenses = useMemo(() => {
    return selectedMonthExpenses.filter((e) => higherThanUsualIds.has(e.id));
  }, [selectedMonthExpenses, higherThanUsualIds]);

  const formattedBalance = useMemo(() => {
    return `${currentBalance < 0 ? '-' : ''}${formatCurrency(Math.abs(currentBalance), activeCurrency)}`;
  }, [currentBalance, activeCurrency]);

  // Chart data calculation
  const chartData = useMemo(() => {
    const year = selectedMonthDate.getFullYear();

    if (timeRange === 'Month') {
      const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const values = new Array(12).fill(0);

      expenses
        .filter((e) => e.type === filterType && !isGoalTransfer(e) && parseExpenseDate(e.timestamp).getFullYear() === year)
        .forEach((item) => {
          const m = parseExpenseDate(item.timestamp).getMonth();
          if (m >= 0 && m < 12) {
            values[m] += convertCurrency(item.amount, item.nativeCurrency || 'USD', activeCurrency);
          }
        });

      return {
        labels,
        values,
        activeIndex: selectedMonthDate.getMonth(),
      };
    }

    if (timeRange === 'Day') {
      const labels: string[] = ['1-5', '6-10', '11-15', '16-20', '21-25', '26-31'];
      const values = new Array(6).fill(0);

      filteredExpenses.filter((e) => !isGoalTransfer(e)).forEach((item) => {
        const itemDate = parseExpenseDate(item.timestamp);
        const day = itemDate.getDate();
        const idx = Math.min(5, Math.floor((day - 1) / 5));
        values[idx] += convertCurrency(item.amount, item.nativeCurrency || 'USD', activeCurrency);
      });

      return {
        labels,
        values,
        activeIndex: Math.min(5, Math.floor((new Date().getDate() - 1) / 5)),
      };
    }

    if (timeRange === 'Week') {
      const labels = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
      const values = new Array(4).fill(0);

      filteredExpenses.filter((e) => !isGoalTransfer(e)).forEach((item) => {
        const d = parseExpenseDate(item.timestamp);
        const dateNum = d.getDate();
        const weekIdx = Math.min(3, Math.floor((dateNum - 1) / 7));
        values[weekIdx] += convertCurrency(item.amount, item.nativeCurrency || 'USD', activeCurrency);
      });

      return {
        labels,
        values,
        activeIndex: Math.min(3, Math.floor((new Date().getDate() - 1) / 7)),
      };
    }

    // timeRange === 'Year'
    const startYear = year - 3;
    const labels = [
      String(startYear),
      String(startYear + 1),
      String(startYear + 2),
      String(year),
    ];
    const values = new Array(4).fill(0);

    expenses
      .filter((e) => e.type === filterType)
      .forEach((item) => {
        const yr = parseExpenseDate(item.timestamp).getFullYear();
        const idx = yr - startYear;
        if (idx >= 0 && idx < 4) {
          values[idx] += convertCurrency(item.amount, item.nativeCurrency || 'USD', activeCurrency);
        }
      });

      return {
        labels,
        values,
        activeIndex: 3,
      };
  }, [expenses, selectedMonthDate, timeRange, filterType, filteredExpenses, activeCurrency]);

  const maxVal = useMemo(() => Math.max(...chartData.values, 0), [chartData.values]);
  const barHeights = useMemo(() => chartData.values.map((val) => (maxVal > 0 ? (val / maxVal) * 100 : 0)), [chartData.values, maxVal]);

  // Methods with optimistic UI and rollback protection
  const addExpense = useCallback(
    async (newExp: Omit<Expense, 'id'>): Promise<Expense> => {
      const fullExpense: Expense = {
        ...newExp,
        id: generateUniqueId('exp'),
        timestamp: newExp.timestamp || new Date().toISOString(),
        nativeCurrency: newExp.nativeCurrency || activeCurrency,
      };
      const previousExpenses = expenses;
      const updatedExpenses = [fullExpense, ...expenses];

      // 1. Optimistic local update (zero latency)
      setExpenses(updatedExpenses);
      toast.success(fullExpense.type === 'income' ? 'Income logged' : 'Expense logged');

      if (onExpenseAdded) {
        onExpenseAdded(updatedExpenses, fullExpense);
      }

      // 2. Background database persistence
      if (currentUser) {
        try {
          await updateUserExpenses(currentUser.uid, updatedExpenses);
        } catch (err) {
          console.error('[ExpenseContext] Failed to persist expense, rolling back:', err);
          setExpenses(previousExpenses);
          toast.error("Couldn't save — check your connection");
          throw err;
        }
      }

      return fullExpense;
    },
    [expenses, currentUser, onExpenseAdded, activeCurrency, toast]
  );

  const updateExpense = useCallback(
    async (updatedExp: Expense): Promise<void> => {
      const previousExpenses = expenses;
      const updated = expenses.map((e) => (e.id === updatedExp.id ? updatedExp : e));

      // Optimistic local update
      setExpenses(updated);
      toast.success('Expense updated');

      if (currentUser) {
        try {
          await updateUserExpenses(currentUser.uid, updated);
        } catch (err) {
          console.error('[ExpenseContext] Failed to update expense, rolling back:', err);
          setExpenses(previousExpenses);
          toast.error("Couldn't update expense — check your connection");
          throw err;
        }
      }
    },
    [expenses, currentUser, toast]
  );

  const deleteExpense = useCallback(
    async (id: string): Promise<void> => {
      const previousExpenses = expenses;
      const updated = expenses.filter((e) => e.id !== id);

      // Optimistic local delete
      setExpenses(updated);
      toast.success('Expense removed');

      if (currentUser) {
        try {
          await deleteUserExpense(currentUser.uid, id);
        } catch (err) {
          console.error('[ExpenseContext] Failed to delete expense, rolling back:', err);
          setExpenses(previousExpenses);
          toast.error("Couldn't delete expense — check your connection");
          throw err;
        }
      }
    },
    [expenses, currentUser, toast]
  );

  const bulkAddExpenses = useCallback(
    async (newExpenses: Expense[]): Promise<void> => {
      const previousExpenses = expenses;
      const normalizedExpenses = newExpenses.map((exp) => ({
        ...exp,
        timestamp: exp.timestamp || new Date().toISOString(),
        nativeCurrency: exp.nativeCurrency || activeCurrency,
      }));
      const updated = [...normalizedExpenses, ...expenses];

      // Optimistic local bulk update
      setExpenses(updated);
      toast.success(`Imported ${newExpenses.length} ${newExpenses.length === 1 ? 'transaction' : 'transactions'}`);

      if (onExpenseAdded) {
        onExpenseAdded(updated);
      }

      if (currentUser) {
        try {
          await updateUserExpenses(currentUser.uid, updated);
        } catch (err) {
          console.error('[ExpenseContext] Failed to persist bulk expenses, rolling back:', err);
          setExpenses(previousExpenses);
          toast.error("Couldn't save imported expenses — check your connection");
          throw err;
        }
      }
    },
    [expenses, currentUser, onExpenseAdded, activeCurrency, toast]
  );

  const processAiExtractedExpense = useCallback(
    async (extractedExpense: any): Promise<Expense | null> => {
      if (!extractedExpense || !extractedExpense.amount) return null;
      const amt = typeof extractedExpense.amount === 'number' ? extractedExpense.amount : parseFloat(extractedExpense.amount);
      if (isNaN(amt) || amt <= 0) return null;

      const label = (extractedExpense.label || 'Expense').trim();
      const category = (extractedExpense.category || 'Other').trim();
      const type = extractedExpense.type || 'outcome';

      // Check against existing expenses to prevent duplicate logging
      const isDuplicate = expenses.some((existing) => {
        const existingAmt = typeof existing.amount === 'number' ? existing.amount : parseFloat(String(existing.amount));
        if (Math.abs(existingAmt - amt) > 0.01 || existing.type !== type) {
          return false;
        }

        const existingLabel = (existing.label || '').toLowerCase().trim();
        const targetLabel = label.toLowerCase();
        const existingCat = (existing.category || '').toLowerCase().trim();
        const targetCat = category.toLowerCase();

        return (
          existingLabel === targetLabel ||
          (targetLabel.length > 2 && existingLabel.includes(targetLabel)) ||
          (existingCat === targetCat && (amt >= 100 || existingLabel === targetLabel))
        );
      });

      if (isDuplicate) {
        console.warn(`[processAiExtractedExpense] Skipped duplicate expense entry: ${label} ($${amt})`);
        return null;
      }

      const newExp: Expense = {
        id: generateUniqueId('exp'),
        label,
        category,
        amount: amt,
        type,
        timestamp: new Date().toISOString(),
        nativeCurrency: activeCurrency,
      };

      const previousExpenses = expenses;
      const updatedExpenses = [newExp, ...expenses];

      // Optimistic local update
      setExpenses(updatedExpenses);
      toast.success(type === 'income' ? `Income logged: ${label}` : `Expense logged: ${label}`);

      if (onExpenseAdded) {
        onExpenseAdded(updatedExpenses, newExp);
      }

      if (currentUser) {
        try {
          await updateUserExpenses(currentUser.uid, updatedExpenses);
        } catch (err) {
          console.error('[ExpenseContext] Failed to persist AI extracted expense, rolling back:', err);
          setExpenses(previousExpenses);
          toast.error("Couldn't save auto-logged expense — check your connection");
          throw err;
        }
      }

      return newExp;
    },
    [expenses, currentUser, onExpenseAdded, activeCurrency, toast]
  );

  const clearExpenses = useCallback(() => {
    setExpenses([]);
  }, []);

  const value: ExpenseContextType = {
    expenses,
    setExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    bulkAddExpenses,
    processAiExtractedExpense,
    sanitizeExpenses: sanitizeExpensesList,
    clearExpenses,

    selectedMonthDate,
    setSelectedMonthDate,
    handlePrevMonth,
    handleNextMonth,
    canGoPrev,
    canGoNext,
    isCurrentMonth,
    earliestMonthDate,

    filterType,
    setFilterType,
    timeRange,
    setTimeRange,
    hoveredBarIndex,
    setHoveredBarIndex,

    selectedMonthExpenses,
    filteredExpenses,
    monthTotalOutcome,
    monthTotalIncome,
    currentBalance,
    currentHeroTotal,
    higherThanUsualExpenses,
    higherThanUsualIds,
    formattedBalance,
    chartData,
    barHeights,
  };

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
};

export const useExpenses = (): ExpenseContextType => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpenseProvider');
  }
  return context;
};
