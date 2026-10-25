import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import {
  SavingsGoal,
  GrowthMark,
  ChatMessage,
  Expense,
  GoalContribution,
  UserProfile,
  ViewMode,
} from '../types';
import {
  updateUserSavingsGoals,
  updateUserSavingsGoal,
  updateUserGrowthMarks,
  updateUserMessages,
  getGoalCoachingThread,
  saveGoalCoachingThread,
} from '../lib/userService';
import { useAuth } from './AuthContext';
import { useExpenses } from './ExpenseContext';
import { useToast } from './ToastContext';
import { formatWholeCurrency, formatCurrency, getCurrencySymbol } from '../utils/currency';
import { addGoalMilestones, cleanGrowthMarks } from '../utils/growthMarks';
import { isDebtGoal } from '../utils/goalKind';
import { generateUniqueId } from '../utils/id';
import { fetchWithAuth } from '../utils/apiClient';

export interface GoalTimeframeData {
  points: number[];
  labels: string[];
}

export function computeGoalTimeframeData(
  timeframe: 'Day' | 'Week' | 'Month' | 'Year',
  savedAmount: number,
  rawContributions?: GoalContribution[]
): GoalTimeframeData {
  const now = new Date();

  // Use real contributions if present; otherwise generate baseline entries totaling savedAmount
  let contributions = rawContributions || [];

  if (contributions.length === 0) {
    if (savedAmount > 0) {
      contributions = [
        {
          id: 'c-1',
          amount: Math.round(savedAmount * 0.35),
          timestamp: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'c-2',
          amount: Math.round(savedAmount * 0.35),
          timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'c-3',
          amount: Math.round(savedAmount * 0.3),
          timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];
    } else {
      contributions = [];
    }
  }

  if (timeframe === 'Day') {
    // Last 14 calendar days: net daily contributions (additions minus withdrawals)
    const numDays = 14;
    const points: number[] = [];
    const labels: string[] = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

      const dayNet = contributions
        .filter((c) => {
          const t = new Date(c.timestamp).getTime();
          return t >= dayStart && t <= dayEnd;
        })
        .reduce((sum, c) => sum + c.amount, 0);

      points.push(dayNet);

      const m = d.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = d.getDate();
      labels.push(`${m} ${dayNum}`);
    }

    return { points, labels };
  }

  if (timeframe === 'Week') {
    // Last 8 weeks: total net weekly contribution
    const numWeeks = 8;
    const points: number[] = [];
    const labels: string[] = [];

    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7, 23, 59, 59, 999);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);

      const weekNet = contributions
        .filter((c) => {
          const t = new Date(c.timestamp).getTime();
          return t >= weekStart.getTime() && t <= weekEnd.getTime();
        })
        .reduce((sum, c) => sum + c.amount, 0);

      points.push(weekNet);

      const wLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(wLabel);
    }

    return { points, labels };
  }

  if (timeframe === 'Month') {
    // Last 6 months: cumulative running total toward goal
    const numMonths = 6;
    const points: number[] = [];
    const labels: string[] = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const cum = contributions
        .filter((c) => new Date(c.timestamp).getTime() <= monthEnd.getTime())
        .reduce((sum, c) => sum + c.amount, 0);

      points.push(Math.max(0, cum));
      labels.push(monthStart.toLocaleDateString('en-US', { month: 'short' }));
    }

    return { points, labels };
  }

  // Year view: cumulative total for years
  const numYears = 3;
  const points: number[] = [];
  const labels: string[] = [];

  for (let i = numYears - 1; i >= 0; i--) {
    const yr = now.getFullYear() - i;
    const yrEnd = new Date(yr, 11, 31, 23, 59, 59, 999);

    const cum = contributions
      .filter((c) => new Date(c.timestamp).getTime() <= yrEnd.getTime())
      .reduce((sum, c) => sum + c.amount, 0);

    points.push(Math.max(0, cum));
    labels.push(`${yr}`);
  }

  return { points, labels };
}

interface GoalContextType {
  // Goal collections
  savingsGoals: SavingsGoal[];
  savingsGoal: SavingsGoal | null;
  activeGoals: SavingsGoal[];
  activeGoalsCount: number;
  growthMarks: GrowthMark[];

  // Modal / Editing states
  isEditGoalOpen: boolean;
  editingGoal: SavingsGoal | null;
  editGoalModalMode: 'edit' | 'create' | 'upgrade';

  // Coaching thread states
  activeCoachingGoal: SavingsGoal | null;
  coachingMessages: ChatMessage[];
  isCoachingSending: boolean;

  // Direct state setters
  setSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>;
  setSavingsGoal: React.Dispatch<React.SetStateAction<SavingsGoal | null>>;
  setGrowthMarks: React.Dispatch<React.SetStateAction<GrowthMark[]>>;
  setIsEditGoalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingGoal: React.Dispatch<React.SetStateAction<SavingsGoal | null>>;
  setEditGoalModalMode: React.Dispatch<React.SetStateAction<'edit' | 'create' | 'upgrade'>>;
  setActiveCoachingGoal: React.Dispatch<React.SetStateAction<SavingsGoal | null>>;
  setCoachingMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsCoachingSending: React.Dispatch<React.SetStateAction<boolean>>;

  // Goal actions
  handleOpenEditGoal: (goalToEdit?: SavingsGoal) => void;
  handleOpenAddNewGoal: (onShowUpgradeModal?: () => void) => void;
  handleCloseEditGoal: () => void;
  handleSaveGoal: (
    savedGoal: SavingsGoal,
    isNew?: boolean,
    messagesContext?: {
      messages: ChatMessage[];
      setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    }
  ) => Promise<void>;
  handleArchiveGoal: (messagesContext?: {
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  }) => Promise<void>;
  handleDeleteGoal: (goalId: string) => Promise<void>;
  handleAllocateToGoal: (
    targetGoal: SavingsGoal,
    addAmount: number,
    messagesContext?: {
      messages: ChatMessage[];
      setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    }
  ) => Promise<{ updatedTargetGoal: SavingsGoal; isAchieved: boolean }>;
  handleWithdrawFromGoal: (
    targetGoal: SavingsGoal,
    subAmount: number,
    messagesContext?: {
      messages: ChatMessage[];
      setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    }
  ) => Promise<{ updatedTargetGoal: SavingsGoal }>;
  triggerGrowthMarkCheck: (
    currentExpenses: Expense[],
    currentGoal?: SavingsGoal | null
  ) => Promise<boolean>;

  // Coaching actions
  handleOpenCoach: (
    goal: SavingsGoal,
    onNavigateToView?: (view: ViewMode) => void,
    onOpenUpgradeModal?: () => void
  ) => Promise<void>;
  handleSendCoachingMessage: (text: string) => Promise<void>;

  // Chart computation helper
  getTimeframeData: (
    timeframe: 'Day' | 'Week' | 'Month' | 'Year',
    savedAmount: number,
    contributions?: GoalContribution[]
  ) => GoalTimeframeData;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

interface GoalProviderProps {
  children: ReactNode;
  initialSavingsGoal?: SavingsGoal | null;
  initialSavingsGoals?: SavingsGoal[];
  initialGrowthMarks?: GrowthMark[];
}

export const GoalProvider: React.FC<GoalProviderProps> = ({
  children,
  initialSavingsGoal = null,
  initialSavingsGoals = [],
  initialGrowthMarks = [],
}) => {
  const { currentUser, userProfile, currency } = useAuth();
  const activeCurrency = currency || userProfile?.currency || 'USD';
  const { addExpense, expenses } = useExpenses();
  const toast = useToast();

  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(initialSavingsGoals);
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal | null>(initialSavingsGoal);
  const [growthMarks, setGrowthMarks] = useState<GrowthMark[]>(initialGrowthMarks);

  // Modal states
  const [isEditGoalOpen, setIsEditGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editGoalModalMode, setEditGoalModalMode] = useState<'edit' | 'create' | 'upgrade'>('edit');

  // Coaching states
  const [activeCoachingGoal, setActiveCoachingGoal] = useState<SavingsGoal | null>(null);
  const [coachingMessages, setCoachingMessages] = useState<ChatMessage[]>([]);
  const [isCoachingSending, setIsCoachingSending] = useState(false);

  // Synchronize when initial props change
  useEffect(() => {
    if (initialSavingsGoals && initialSavingsGoals.length > 0) {
      setSavingsGoals((prev) => {
        if (
          prev.length === initialSavingsGoals.length &&
          prev.every((g, i) => g.id === initialSavingsGoals[i]?.id && g.currentAmount === initialSavingsGoals[i]?.currentAmount)
        ) {
          return prev;
        }
        return initialSavingsGoals;
      });
      const active = initialSavingsGoals.find((g) => !g.isArchived) || initialSavingsGoals[0];
      setSavingsGoal((prev) => (prev?.id === active?.id && prev?.currentAmount === active?.currentAmount ? prev : (active || null)));
    } else if (initialSavingsGoal) {
      setSavingsGoals((prev) => (prev.length === 1 && prev[0].id === initialSavingsGoal.id ? prev : [initialSavingsGoal]));
      setSavingsGoal((prev) => (prev?.id === initialSavingsGoal.id && prev?.currentAmount === initialSavingsGoal.currentAmount ? prev : initialSavingsGoal));
    }
  }, [initialSavingsGoals, initialSavingsGoal]);

  useEffect(() => {
    if (initialGrowthMarks && initialGrowthMarks.length > 0) {
      // Older saves can hold duplicate or out-of-order goal milestones (KOVA-075): clean once, save back.
      const cleaned = cleanGrowthMarks(initialGrowthMarks);
      if (cleaned !== initialGrowthMarks && currentUser) {
        updateUserGrowthMarks(currentUser.uid, cleaned);
      }
      setGrowthMarks((prev) => {
        if (prev.length === cleaned.length && prev.every((m, i) => m.id === cleaned[i]?.id)) {
          return prev;
        }
        return cleaned;
      });
    }
  }, [initialGrowthMarks, currentUser]);

  // Active Goals list (non-archived goals)
  const activeGoals = useMemo(() => {
    if (savingsGoals && savingsGoals.length > 0) {
      return savingsGoals.filter((g) => !g.isArchived);
    }
    if (savingsGoal && !savingsGoal.isArchived) {
      return [savingsGoal];
    }
    return [];
  }, [savingsGoals, savingsGoal]);

  const activeGoalsCount = activeGoals.length;

  // Open Edit Goal modal for existing goal
  const handleOpenEditGoal = useCallback(
    (goalToEdit?: SavingsGoal) => {
      setEditingGoal(goalToEdit || savingsGoal || null);
      setEditGoalModalMode('edit');
      setIsEditGoalOpen(true);
    },
    [savingsGoal]
  );

  // Open Add Goal flow — enforces 1 active goal limit for Free users
  const handleOpenAddNewGoal = useCallback(
    (onShowUpgradeModal?: () => void) => {
      const isPremium = userProfile?.plan === 'premium';
      const hasActiveGoal = activeGoals.length >= 1;

      if (!isPremium && hasActiveGoal) {
        setEditGoalModalMode('upgrade');
        setEditingGoal(null);
        setIsEditGoalOpen(true);
        if (onShowUpgradeModal) onShowUpgradeModal();
      } else {
        setEditGoalModalMode('create');
        setEditingGoal(null);
        setIsEditGoalOpen(true);
      }
    },
    [userProfile, activeGoals.length]
  );

  const handleCloseEditGoal = useCallback(() => {
    setIsEditGoalOpen(false);
  }, []);

  // Growth mark check helper
  const triggerGrowthMarkCheck = useCallback(
    async (currentExpenses: Expense[], currentGoal?: SavingsGoal | null): Promise<boolean> => {
      const g = currentGoal !== undefined ? currentGoal : savingsGoal;
      let newMarks = [...growthMarks];
      let markAdded = false;
      const todayStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });

      // 1. First expense mark
      if (
        currentExpenses.length >= 1 &&
        !newMarks.some((m) => m.title.toLowerCase().includes('expense'))
      ) {
        newMarks.unshift({
          id: generateUniqueId('gm-exp'),
          date: todayStr,
          title: 'Logged your first expense',
          description: 'Began recording spending entries with Kova.',
        });
        markAdded = true;
      }

      // 2. Goal milestones (50% and 100%) for every active goal, once each (KOVA-075).
      const goalsToCheck = [...(g ? [g] : []), ...activeGoals.filter((ag) => ag.id !== g?.id)];
      for (const goal of goalsToCheck) {
        const result = addGoalMilestones(newMarks, goal, todayStr, (n) =>
          formatWholeCurrency(n, activeCurrency, goal.nativeCurrency)
        );
        if (result.added.length > 0) {
          newMarks = result.marks;
          markAdded = true;
        }
      }

      if (markAdded) {
        setGrowthMarks(newMarks);
        if (currentUser) {
          await updateUserGrowthMarks(currentUser.uid, newMarks);
        }
        return true;
      }
      return false;
    },
    [growthMarks, savingsGoal, activeGoals, activeCurrency, currentUser]
  );

  // Save Goal
  const handleSaveGoal = useCallback(
    async (
      savedGoal: SavingsGoal,
      isNew?: boolean,
      messagesContext?: {
        messages: ChatMessage[];
        setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
      }
    ) => {
      const previousGoals = savingsGoals;
      const previousGoal = savingsGoal;

      const goalWithCurrency: SavingsGoal = {
        ...savedGoal,
        nativeCurrency: savedGoal.nativeCurrency || activeCurrency,
      };

      let updatedGoals: SavingsGoal[];
      if (isNew) {
        updatedGoals = [...savingsGoals, goalWithCurrency];
      } else {
        const exists = savingsGoals.some((g) => g.id === goalWithCurrency.id);
        if (exists) {
          updatedGoals = savingsGoals.map((g) => (g.id === goalWithCurrency.id ? goalWithCurrency : g));
        } else {
          updatedGoals = [...savingsGoals, goalWithCurrency];
        }
      }

      // Optimistic local state update
      setSavingsGoals(updatedGoals);
      setSavingsGoal(goalWithCurrency);
      toast.success(isNew ? 'Goal created' : 'Goal settings saved');

      if (currentUser) {
        try {
          await updateUserSavingsGoals(currentUser.uid, updatedGoals, { throwOnError: true });
        } catch (err) {
          console.error('[GoalContext] Failed to save goal, rolling back:', err);
          setSavingsGoals(previousGoals);
          setSavingsGoal(previousGoal);
          toast.error("Couldn't save goal — check your connection");
          throw err;
        }
      }

      if (isNew) {
        const kovaMsg: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text: `Awesome! Created your new goal for **${goalWithCurrency.title}** with a target of ${formatWholeCurrency(goalWithCurrency.targetAmount, activeCurrency, goalWithCurrency.nativeCurrency)}. You can now track your goals right here in chat.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: [
            `Put ${formatWholeCurrency(100, activeCurrency)} toward ${goalWithCurrency.title}`,
            'Log an expense',
            'How is my savings goal?',
          ],
        };
        if (messagesContext) {
          const msgs = [...messagesContext.messages, kovaMsg];
          messagesContext.setMessages(msgs);
          if (currentUser) {
            updateUserMessages(currentUser.uid, msgs);
          }
        }
      } else if (goalWithCurrency.currentAmount >= goalWithCurrency.targetAmount && goalWithCurrency.targetAmount > 0) {
        const result = addGoalMilestones(
          growthMarks,
          goalWithCurrency,
          new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          (n) => formatWholeCurrency(n, activeCurrency, goalWithCurrency.nativeCurrency)
        );
        if (result.added.includes(100)) {
          setGrowthMarks(result.marks);
          if (currentUser) {
            updateUserGrowthMarks(currentUser.uid, result.marks);
          }

          const kovaCongratsMsg: ChatMessage = {
            id: generateUniqueId('msg'),
            sender: 'kova',
            text: `You've reached your ${formatWholeCurrency(goalWithCurrency.targetAmount, activeCurrency, goalWithCurrency.nativeCurrency)} goal for ${goalWithCurrency.title}. That is a wonderful milestone.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            quickReplies: ['Set a new goal', 'Keep saving past this', 'Leave it as-is'],
          };
          if (messagesContext) {
            const updatedMsgs = [...messagesContext.messages, kovaCongratsMsg];
            messagesContext.setMessages(updatedMsgs);
            if (currentUser) {
              updateUserMessages(currentUser.uid, updatedMsgs);
            }
          }
        }
      }
    },
    [savingsGoals, savingsGoal, growthMarks, currentUser, activeCurrency, toast]
  );

  // Archive Goal
  const handleArchiveGoal = useCallback(
    async (messagesContext?: {
      messages: ChatMessage[];
      setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    }) => {
      const goalToProc = editingGoal || savingsGoal;
      if (!goalToProc) return;

      const previousGoals = savingsGoals;
      const previousGoal = savingsGoal;

      const updatedGoals = savingsGoals.map((g) => {
        if (g.id === goalToProc.id || g.title === goalToProc.title) {
          return { ...g, isArchived: true, status: 'archived' as const };
        }
        return g;
      });

      const remainingActive = updatedGoals.find((g) => !g.isArchived);
      setSavingsGoals(updatedGoals);
      setSavingsGoal(remainingActive || null);
      toast.info('Goal archived');

      if (currentUser) {
        try {
          await updateUserSavingsGoals(currentUser.uid, updatedGoals, { throwOnError: true });
        } catch (err) {
          console.error('[GoalContext] Failed to archive goal, rolling back:', err);
          setSavingsGoals(previousGoals);
          setSavingsGoal(previousGoal);
          toast.error("Couldn't archive goal — check your connection");
          throw err;
        }
      }

      const archiveMsg: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'kova',
        text: `Goal archived. Whenever you're ready to set a new goal, just let me know what you'd like to work toward!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['Set a new goal', 'Log an expense', 'Read monthly letter'],
      };

      if (messagesContext) {
        const updatedMsgs = [...messagesContext.messages, archiveMsg];
        messagesContext.setMessages(updatedMsgs);
        if (currentUser) {
          updateUserMessages(currentUser.uid, updatedMsgs);
        }
      }
    },
    [editingGoal, savingsGoal, savingsGoals, currentUser, toast]
  );

  // Delete Goal
  const handleDeleteGoal = useCallback(
    async (goalId: string) => {
      const previousGoals = savingsGoals;
      const previousGoal = savingsGoal;

      const updated = savingsGoals.filter((g) => g.id !== goalId);
      const remainingActive = updated.find((g) => !g.isArchived);
      setSavingsGoals(updated);
      setSavingsGoal(remainingActive || null);
      toast.success('Goal removed');

      if (currentUser) {
        try {
          await updateUserSavingsGoals(currentUser.uid, updated, { throwOnError: true });
        } catch (err) {
          console.error('[GoalContext] Failed to delete goal, rolling back:', err);
          setSavingsGoals(previousGoals);
          setSavingsGoal(previousGoal);
          toast.error("Couldn't delete goal — check your connection");
          throw err;
        }
      }
    },
    [savingsGoals, savingsGoal, currentUser, toast]
  );

  // Allocate funds to a specific goal
  const handleAllocateToGoal = useCallback(
    async (
      targetGoal: SavingsGoal,
      addAmount: number,
      messagesContext?: {
        messages: ChatMessage[];
        setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
      }
    ): Promise<{ updatedTargetGoal: SavingsGoal; isAchieved: boolean }> => {
      const previousGoals = savingsGoals;
      const previousGoal = savingsGoal;

      const newCurrent = targetGoal.currentAmount + addAmount;
      const isAchieved = newCurrent >= targetGoal.targetAmount && targetGoal.targetAmount > 0;

      const newContrib: GoalContribution = {
        id: generateUniqueId('contrib'),
        amount: addAmount,
        timestamp: new Date().toISOString(),
        nativeCurrency: targetGoal.nativeCurrency || activeCurrency,
      };

      const updatedTargetGoal: SavingsGoal = {
        ...targetGoal,
        currentAmount: newCurrent,
        contributions: [...(targetGoal.contributions || []), newContrib],
        status: isAchieved ? 'achieved' : targetGoal.status,
      };

      const updatedGoalsList = savingsGoals.map((g) =>
        g.id === targetGoal.id || g.title === targetGoal.title ? updatedTargetGoal : g
      );

      // 1. Instant local optimistic update
      setSavingsGoals(updatedGoalsList);
      setSavingsGoal(updatedTargetGoal);
      toast.success('Goal contribution saved');

      // 2. Background database sync with rollback protection
      if (currentUser) {
        try {
          await updateUserSavingsGoals(currentUser.uid, updatedGoalsList, { throwOnError: true });
        } catch (err) {
          console.error('[GoalContext] Failed to save goal allocation, rolling back:', err);
          setSavingsGoals(previousGoals);
          setSavingsGoal(previousGoal);
          toast.error("Couldn't save goal contribution — check your connection");
          throw err;
        }
      }

      // No income entry: moving money into a goal is a transfer, not income (item 11c). The goal's
      // `contributions` list is the record of it.

      const isDebt = isDebtGoal(targetGoal);
      const fmt = (n: number) => formatWholeCurrency(n, activeCurrency, targetGoal.nativeCurrency);
      const pct = targetGoal.targetAmount > 0 ? Math.min(100, Math.round((newCurrent / targetGoal.targetAmount) * 100)) : 0;
      let replyText = isDebt
        ? `Recorded a ${fmt(addAmount)} payment on ${targetGoal.title}. You've paid off ${fmt(newCurrent)} of ${fmt(targetGoal.targetAmount)} (${pct}%).`
        : `Added ${fmt(addAmount)} toward your ${targetGoal.title} goal. You are now at ${fmt(newCurrent)} of ${fmt(targetGoal.targetAmount)} (${pct}%).`;
      let replies = ['How am I doing on spending?', 'Log an expense', 'Read monthly letter'];

      if (isAchieved) {
        replyText = isDebt
          ? `${targetGoal.title}: ${fmt(targetGoal.targetAmount)} paid off. That one's cleared.`
          : `You've reached your ${fmt(targetGoal.targetAmount)} goal for ${targetGoal.title}. That is a wonderful milestone.`;
        replies = ['Set a new goal', 'Keep saving past this', 'Leave it as-is'];
      }

      // Milestones crossed by this contribution (50% and/or 100%), each only once (KOVA-075).
      const milestones = addGoalMilestones(
        growthMarks,
        updatedTargetGoal,
        new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        fmt
      );
      if (milestones.added.length > 0) {
        setGrowthMarks(milestones.marks);
        if (currentUser) {
          updateUserGrowthMarks(currentUser.uid, milestones.marks);
        }
      }

      if (messagesContext) {
        const kovaMsg: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: replies,
        };
        const next = [...messagesContext.messages, kovaMsg];
        messagesContext.setMessages(next);
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
      }

      return { updatedTargetGoal, isAchieved };
    },
    [savingsGoals, savingsGoal, growthMarks, currentUser, addExpense, activeCurrency, toast]
  );

  // Withdraw funds from a specific goal
  const handleWithdrawFromGoal = useCallback(
    async (
      targetGoal: SavingsGoal,
      subAmount: number,
      messagesContext?: {
        messages: ChatMessage[];
        setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
      }
    ): Promise<{ updatedTargetGoal: SavingsGoal }> => {
      const previousGoals = savingsGoals;
      const previousGoal = savingsGoal;

      const newCurrent = Math.max(0, targetGoal.currentAmount - subAmount);

      const newContrib: GoalContribution = {
        id: generateUniqueId('contrib'),
        amount: -subAmount,
        timestamp: new Date().toISOString(),
        nativeCurrency: targetGoal.nativeCurrency || activeCurrency,
      };

      const updatedTargetGoal: SavingsGoal = {
        ...targetGoal,
        currentAmount: newCurrent,
        contributions: [...(targetGoal.contributions || []), newContrib],
        status: newCurrent >= targetGoal.targetAmount ? 'achieved' : 'active',
      };

      const updatedGoalsList = savingsGoals.map((g) =>
        g.id === targetGoal.id || g.title === targetGoal.title ? updatedTargetGoal : g
      );

      // Instant optimistic local state update
      setSavingsGoals(updatedGoalsList);
      setSavingsGoal(updatedTargetGoal);
      toast.success('Goal withdrawal saved');

      if (currentUser) {
        try {
          await updateUserSavingsGoals(currentUser.uid, updatedGoalsList, { throwOnError: true });
        } catch (err) {
          console.error('[GoalContext] Failed to withdraw from goal, rolling back:', err);
          setSavingsGoals(previousGoals);
          setSavingsGoal(previousGoal);
          toast.error("Couldn't withdraw from goal — check your connection");
          throw err;
        }
      }

      if (messagesContext) {
        const kovaMsg: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text: `Taken ${formatWholeCurrency(subAmount, activeCurrency)} out of your ${targetGoal.title} fund. Your updated balance is ${formatWholeCurrency(newCurrent, activeCurrency)} of ${formatWholeCurrency(targetGoal.targetAmount, activeCurrency)}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: ['How am I doing on spending?', 'Log an expense', 'Read monthly letter'],
        };
        const next = [...messagesContext.messages, kovaMsg];
        messagesContext.setMessages(next);
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
      }

      return { updatedTargetGoal };
    },
    [savingsGoals, savingsGoal, currentUser, activeCurrency, toast]
  );

  // Goal Coaching Thread Handler
  const handleOpenCoach = useCallback(
    async (
      goal: SavingsGoal,
      onNavigateToView?: (view: ViewMode) => void,
      onOpenUpgradeModal?: () => void
    ) => {
      const isPremium = userProfile?.plan === 'premium';
      if (!isPremium) {
        if (onOpenUpgradeModal) {
          onOpenUpgradeModal();
        }
        return;
      }

      setActiveCoachingGoal(goal);
      const goalId = goal.id || `goal-${goal.title.toLowerCase().replace(/\s+/g, '-')}`;
      const uid = currentUser?.uid || 'guest';

      // Fetch existing coaching messages for this goal
      const loadedMessages = await getGoalCoachingThread(uid, goalId);

      if (loadedMessages.length > 0) {
        setCoachingMessages(loadedMessages);
        if (onNavigateToView) onNavigateToView('goal-coaching');
        return;
      }

      // First time opening coaching thread for this goal: generate initial opening message
      setIsCoachingSending(true);
      setCoachingMessages([]);
      if (onNavigateToView) onNavigateToView('goal-coaching');

      try {
        const res = await fetchWithAuth('/api/goal-coach', {
          method: 'POST',
          body: JSON.stringify({
            userProfile,
            goal,
            isInitialOpening: true,
            currency: activeCurrency,
            currencySymbol: getCurrencySymbol(activeCurrency),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Plan or daily limit (403/429): show the server's calm message; don't save it to the thread.
          setCoachingMessages([
            {
              id: generateUniqueId('msg'),
              sender: 'kova',
              text: data?.error || 'Coaching is resting for now. Your goal and progress are safe.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          return;
        }
        const openingMsg: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: data.quickReplies,
        };
        setCoachingMessages([openingMsg]);
        await saveGoalCoachingThread(uid, goalId, [openingMsg]);
      } catch (e) {
        const percentage =
          goal.targetAmount > 0
            ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
            : 0;
        const formattedSaved = formatWholeCurrency(goal.currentAmount, activeCurrency, goal.nativeCurrency);
        const formattedTarget = formatWholeCurrency(goal.targetAmount, activeCurrency, goal.nativeCurrency);

        const fallbackOpening: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text: `Welcome to your dedicated coaching thread for "${goal.title}". You've saved ${formattedSaved} of your ${formattedTarget} target (${percentage}% completed). What strategy shall we focus on today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: [
            `How can I reach ${goal.title} faster?`,
            `Set a weekly target`,
            `Analyze my progress`,
          ],
        };
        setCoachingMessages([fallbackOpening]);
        await saveGoalCoachingThread(uid, goalId, [fallbackOpening]);
      } finally {
        setIsCoachingSending(false);
      }
    },
    [userProfile, currentUser, activeCurrency]
  );

  const handleSendCoachingMessage = useCallback(
    async (text: string) => {
      if (!activeCoachingGoal) return;
      const goalId =
        activeCoachingGoal.id ||
        `goal-${activeCoachingGoal.title.toLowerCase().replace(/\s+/g, '-')}`;
      const uid = currentUser?.uid || 'guest';

      const userMsg: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const updated = [...coachingMessages, userMsg];
      setCoachingMessages(updated);
      setIsCoachingSending(true);

      try {
        const res = await fetchWithAuth('/api/goal-coach', {
          method: 'POST',
          body: JSON.stringify({
            userProfile,
            goal: activeCoachingGoal,
            message: text,
            messageHistory: updated,
            currency: activeCurrency,
            currencySymbol: getCurrencySymbol(activeCurrency),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          // Plan or daily limit (403/429): show the calm message, keep the thread as it was saved.
          setCoachingMessages([
            ...updated,
            {
              id: generateUniqueId('msg'),
              sender: 'kova',
              text: data?.error || 'Coaching is resting for now. Your goal and progress are safe.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
          return;
        }
        const kovaMsg: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: data.quickReplies,
        };
        const finalMsgs = [...updated, kovaMsg];
        setCoachingMessages(finalMsgs);
        await saveGoalCoachingThread(uid, goalId, finalMsgs);
      } catch (err) {
        console.error('Coaching send error:', err);
        const fallbackMsg: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text: `I'm analyzing strategies for "${activeCoachingGoal.title}". Let's focus on setting consistent deposit habits.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: [
            `How to boost ${activeCoachingGoal.title}`,
            `Set weekly target`,
            `Review progress`,
          ],
        };
        const finalMsgs = [...updated, fallbackMsg];
        setCoachingMessages(finalMsgs);
        await saveGoalCoachingThread(uid, goalId, finalMsgs);
      } finally {
        setIsCoachingSending(false);
      }
    },
    [activeCoachingGoal, coachingMessages, currentUser, userProfile, activeCurrency]
  );

  const value = useMemo(
    () => ({
      savingsGoals,
      savingsGoal,
      activeGoals,
      activeGoalsCount,
      growthMarks,
      isEditGoalOpen,
      editingGoal,
      editGoalModalMode,
      activeCoachingGoal,
      coachingMessages,
      isCoachingSending,
      setSavingsGoals,
      setSavingsGoal,
      setGrowthMarks,
      setIsEditGoalOpen,
      setEditingGoal,
      setEditGoalModalMode,
      setActiveCoachingGoal,
      setCoachingMessages,
      setIsCoachingSending,
      handleOpenEditGoal,
      handleOpenAddNewGoal,
      handleCloseEditGoal,
      handleSaveGoal,
      handleArchiveGoal,
      handleDeleteGoal,
      handleAllocateToGoal,
      handleWithdrawFromGoal,
      triggerGrowthMarkCheck,
      handleOpenCoach,
      handleSendCoachingMessage,
      getTimeframeData: computeGoalTimeframeData,
    }),
    [
      savingsGoals,
      savingsGoal,
      activeGoals,
      activeGoalsCount,
      growthMarks,
      isEditGoalOpen,
      editingGoal,
      editGoalModalMode,
      activeCoachingGoal,
      coachingMessages,
      isCoachingSending,
      handleOpenEditGoal,
      handleOpenAddNewGoal,
      handleCloseEditGoal,
      handleSaveGoal,
      handleArchiveGoal,
      handleDeleteGoal,
      handleAllocateToGoal,
      handleWithdrawFromGoal,
      triggerGrowthMarkCheck,
      handleOpenCoach,
      handleSendCoachingMessage,
    ]
  );

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
};

export const useGoals = (): GoalContextType => {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoals must be used within a GoalProvider');
  }
  return context;
};
