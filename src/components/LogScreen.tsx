import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Expense, ExpenseCategory, ViewMode, UserProfile } from '../types';
import { PremiumUpgradeCard } from './PremiumUpgradeCard';
import { CategoryBreakdownView } from './CategoryBreakdownView';
import { MonthlyPacingCard } from './MonthlyPacingCard';
import { useAuth } from '../context/AuthContext';
import { useExpenses, parseExpenseDate, isSameMonth } from '../context/ExpenseContext';
import { useModal } from '../context/ModalContext';
import { formatCurrency, formatWholeCurrency, getCurrencySymbol, convertCurrency } from '../utils/currency';
import { computeCategoryBreakdown, computeMonthlyPacing } from '../utils/analytics';
import { 
  ShoppingBag, 
  Wrench, 
  ShoppingBasket, 
  Dumbbell, 
  Sparkles, 
  Coffee, 
  Tv, 
  Plane, 
  DollarSign, 
  Plus, 
  ArrowLeft, 
  TrendingUp, 
  AlertCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Lock,
  BarChart3,
  PieChart,
  Home,
} from 'lucide-react';
import { useEscapeKey } from '../utils/useEscapeKey';

interface LogScreenProps {
  expenses?: Expense[];
  onOpenAddExpense?: () => void;
  onSelectView: (view: ViewMode) => void;
  onDeleteExpense?: (id: string) => void;
  onUpdateExpense?: (updatedExpense: Expense) => void;
  userProfile?: UserProfile | null;
  onUpgradePlan?: () => void;
  onOpenUpgradeModal?: () => void;
}

const formatExpenseTimestamp = (timestampStr: string): string => {
  if (!timestampStr) return 'Just Now';
  if (timestampStr === 'Imported') return 'Imported';

  const d = parseExpenseDate(timestampStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60 && diffSec >= 0) {
    return 'Just Now';
  }
  if (diffMin < 60 && diffMin > 0) {
    return `${diffMin}m ago`;
  }

  const isToday =
    now.getDate() === d.getDate() &&
    now.getMonth() === d.getMonth() &&
    now.getFullYear() === d.getFullYear();

  if (isToday) {
    return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === d.getDate() &&
    yesterday.getMonth() === d.getMonth() &&
    yesterday.getFullYear() === d.getFullYear();

  if (isYesterday) {
    return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() === d.getFullYear() ? undefined : 'numeric',
  });
};

// Framer Motion variants for staggered entrance of expense items
const listContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

const listItemVariants = {
  hidden: {
    opacity: 0,
    y: 14,
    scale: 0.98,
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      damping: 24,
      stiffness: 320,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -8,
    transition: {
      duration: 0.18,
    },
  },
};

export const LogScreen: React.FC<LogScreenProps> = ({
  expenses: propExpenses,
  onOpenAddExpense: propOnOpenAddExpense,
  onSelectView,
  onDeleteExpense: propOnDeleteExpense,
  onUpdateExpense: propOnUpdateExpense,
  userProfile: propUserProfile,
  onUpgradePlan: propOnUpgradePlan,
  onOpenUpgradeModal: propOnOpenUpgradeModal,
}) => {
  const { userProfile: authUserProfile, updatePlan, currency: authCurrency } = useAuth();
  const userProfile = propUserProfile !== undefined ? propUserProfile : authUserProfile;
  const currency = userProfile?.currency || authCurrency || 'USD';
  const onUpgradePlan = propOnUpgradePlan || (() => updatePlan('premium'));

  const { openAddExpense, openPremiumUpgrade } = useModal();
  const onOpenAddExpense = propOnOpenAddExpense || openAddExpense;
  const onOpenUpgradeModal = propOnOpenUpgradeModal || openPremiumUpgrade;

  const expenseCtx = useExpenses();
  const expenses = propExpenses || expenseCtx.expenses;
  const onDeleteExpense = propOnDeleteExpense || expenseCtx.deleteExpense;
  const onUpdateExpense = propOnUpdateExpense || expenseCtx.updateExpense;

  const {
    selectedMonthDate,
    canGoPrev,
    canGoNext,
    handlePrevMonth,
    handleNextMonth,
    isCurrentMonth,
    filterType,
    setFilterType,
    timeRange,
    setTimeRange,
    hoveredBarIndex,
    setHoveredBarIndex,
    filteredExpenses,
    currentHeroTotal,
    higherThanUsualExpenses,
    higherThanUsualIds,
    formattedBalance,
    chartData,
    barHeights,
  } = expenseCtx;

  // Analytics Tab switcher state ('rhythm' | 'categories')
  const [analyticsTab, setAnalyticsTab] = useState<'rhythm' | 'categories'>('rhythm');

  // Compute category breakdown from filtered expenses for the selected month
  const categoryBreakdown = useMemo(() => {
    return computeCategoryBreakdown(filteredExpenses, currency);
  }, [filteredExpenses, currency]);

  // Compute monthly spending pace against real historical past months
  const monthlyPacing = useMemo(() => {
    return computeMonthlyPacing(expenses, selectedMonthDate, currency);
  }, [expenses, selectedMonthDate, currency]);

  // Edit Expense Modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  useEscapeKey(() => setEditingExpense(null), !!editingExpense);
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('Other');
  const [editType, setEditType] = useState<'outcome' | 'income'>('outcome');

  const handleOpenEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setEditLabel(exp.label);
    const converted = convertCurrency(exp.amount, exp.nativeCurrency || 'USD', currency);
    setEditAmount(converted ? (Number.isInteger(converted) ? converted.toString() : converted.toFixed(2)) : '');
    setEditCategory(exp.category);
    setEditType(exp.type);
  };

  const handleSaveEdit = () => {
    if (!editingExpense) return;
    const num = parseFloat(editAmount);
    if (isNaN(num) || num <= 0) return;

    const updated: Expense = {
      ...editingExpense,
      label: editLabel.trim() || editingExpense.category,
      amount: num,
      category: editCategory as ExpenseCategory,
      type: editType,
      nativeCurrency: currency || 'USD',
    };

    if (onUpdateExpense) {
      onUpdateExpense(updated);
    }
    setEditingExpense(null);
  };

  const handleDeleteEdit = () => {
    if (!editingExpense) return;
    onDeleteExpense(editingExpense.id);
    setEditingExpense(null);
  };

  const isPremium = userProfile?.plan === 'premium';

  // Category Icon Resolver
  const getCategoryIcon = (category: string) => {
    const iconClass = "w-4 h-4 text-white/90 stroke-[1.75]";
    switch (category) {
      case 'Shopping':
        return <ShoppingBag className={iconClass} />;
      case 'Car repair':
        return <Wrench className={iconClass} />;
      case 'Grocery':
        return <ShoppingBasket className={iconClass} />;
      case 'Gym':
        return <Dumbbell className={iconClass} />;
      case 'Laundry':
        return <Sparkles className={iconClass} />;
      case 'Coffee':
        return <Coffee className={iconClass} />;
      case 'Subscriptions':
        return <Tv className={iconClass} />;
      case 'Travel':
        return <Plane className={iconClass} />;
      case 'Housing':
        return <Home className={iconClass} />;
      case 'Income':
        return <TrendingUp className={iconClass} />;
      default:
        return <DollarSign className={iconClass} />;
    }
  };

  const handleUpgradeClick = () => {
    if (onOpenUpgradeModal) {
      onOpenUpgradeModal();
    } else if (onUpgradePlan) {
      onUpgradePlan();
    }
  };

  return (
    <div className="flex flex-col min-h-app max-w-2xl mx-auto w-full px-4 pb-24 pt-2">
      {/* Top Back Navigation Row */}
      <div className="flex items-center justify-between py-2 mb-2">
        <button
          type="button"
          onClick={() => onSelectView('chat')}
          className="text-xs text-kova-muted hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Chat companion</span>
        </button>

        <span className="text-xs font-medium text-white/60 uppercase tracking-widest">
          Financial Log
        </span>
      </div>

      {/* Month Navigation Row */}
      <div className="flex items-center justify-center gap-3 my-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={!canGoPrev}
          className={`p-2 rounded-full border transition-all ${
            canGoPrev
              ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white cursor-pointer active:scale-95'
              : 'bg-white/2 border-white/5 text-white/20 cursor-not-allowed opacity-40'
          }`}
          title={canGoPrev ? "Previous month" : "Beginning of recorded history"}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-bold text-white tracking-wide">
            {selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          {!isCurrentMonth && !isPremium && (
            <span className="text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Pro
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={!canGoNext}
          className={`p-2 rounded-full border transition-all ${
            canGoNext
              ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white cursor-pointer active:scale-95'
              : 'bg-white/2 border-white/5 text-white/20 cursor-not-allowed opacity-40'
          }`}
          title={canGoNext ? "Next month" : "Current month"}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Income / Outcome Segmented Switch */}
      <div className="flex justify-center my-3">
        <div className="glass-card p-1 rounded-full border border-white/10 flex items-center gap-1 bg-kova-surface-2">
          <button
            type="button"
            onClick={() => setFilterType('income')}
            className={`px-6 py-2 rounded-full text-xs font-semibold transition-all duration-300 cursor-pointer ${
              filterType === 'income'
                ? 'bg-white text-black shadow-md'
                : 'text-kova-muted hover:text-white'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setFilterType('outcome')}
            className={`px-6 py-2 rounded-full text-xs font-semibold transition-all duration-300 cursor-pointer ${
              filterType === 'outcome'
                ? 'bg-white text-black shadow-md'
                : 'text-kova-muted hover:text-white'
            }`}
          >
            Outcome
          </button>
        </div>
      </div>

      {/* LOCKED VIEW FOR FREE USERS ON PAST MONTHS */}
      {!isCurrentMonth && !isPremium ? (
        <div className="relative mt-2">
          {/* Blurred preview background */}
          <div className="filter blur-md opacity-30 pointer-events-none select-none space-y-6">
            <div className="text-center my-4">
              <span className="text-xs text-kova-muted font-medium tracking-wide uppercase">
                Total Spent
              </span>
              <div className="text-4xl font-extrabold text-white mt-1">
                {formatCurrency(1240, currency)}
              </div>
            </div>

            <div className="glass-card rounded-[24px] p-5 border border-white/10 bg-kova-surface/80 h-32 flex items-end justify-between px-6">
              {[40, 65, 30, 85, 50, 75].map((h, idx) => (
                <div key={idx} className="w-2 bg-white/20 rounded-full" style={{ height: `${h}%` }} />
              ))}
            </div>

            <div className="space-y-2">
              <div className="h-14 glass-card rounded-2xl bg-white/5 border border-white/5" />
              <div className="h-14 glass-card rounded-2xl bg-white/5 border border-white/5" />
            </div>
          </div>

          {/* Overlay Upgrade Card */}
          <div className="my-4">
            <PremiumUpgradeCard onUpgrade={handleUpgradeClick} />
          </div>
        </div>
      ) : (
        /* FUNCTIONAL VIEW FOR CURRENT MONTH OR PREMIUM USERS */
        <>
          {/* Hero Number Header */}
          <div className="text-center my-4">
            <span className="text-xs text-kova-muted font-medium tracking-wide uppercase">
              {filterType === 'outcome' ? 'Total Spent' : 'Total Income Received'}
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mt-1">
              {formatCurrency(currentHeroTotal, currency)}
            </div>
          </div>

          {/* Monthly Pacing Indicator against Real Historical Baseline */}
          {filterType === 'outcome' && (
            <MonthlyPacingCard pacing={monthlyPacing} currency={currency} />
          )}

          {/* Visualization Card: Rhythm & Category Breakdown Switcher */}
          <div className="glass-card rounded-[24px] p-5 border border-white/10 mb-6 bg-kova-surface/80">
            {/* Tab Switcher Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-1.5 bg-kova-surface-2 p-1 rounded-full border border-white/10">
                <button
                  type="button"
                  onClick={() => setAnalyticsTab('rhythm')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    analyticsTab === 'rhythm'
                      ? 'bg-white text-black shadow-md'
                      : 'text-kova-muted hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Spend Rhythm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsTab('categories')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    analyticsTab === 'categories'
                      ? 'bg-white text-black shadow-md'
                      : 'text-kova-muted hover:text-white'
                  }`}
                >
                  <PieChart className="w-3.5 h-3.5" />
                  <span>Categories</span>
                  {categoryBreakdown.items.length > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                      analyticsTab === 'categories' ? 'bg-black/15 text-black' : 'bg-white/10 text-white'
                    }`}>
                      {categoryBreakdown.items.length}
                    </span>
                  )}
                </button>
              </div>

              {analyticsTab === 'rhythm' ? (
                <div className="flex items-center gap-1">
                  {(['Day', 'Week', 'Month', 'Year'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTimeRange(r)}
                      className={`text-[10px] px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                        timeRange === r ? 'bg-white text-black font-semibold' : 'text-kova-muted hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-kova-muted bg-white/5 px-2.5 py-1 rounded-full border border-white/5 font-mono">
                  Monthly Balance {formattedBalance}
                </span>
              )}
            </div>

            {/* Rhythm View */}
            {analyticsTab === 'rhythm' && (
              <div className="animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[11px] text-kova-muted mb-2 px-1">
                  <span>Velocity over time</span>
                  <span className="font-mono">Monthly Balance {formattedBalance}</span>
                </div>
                {/* Vertical Slim Bar Chart Row */}
                <div className="flex items-end justify-between h-28 pt-2 px-1 gap-1 relative">
                  {barHeights.map((h, i) => {
                    const rawVal = chartData.values[i];
                    const isHovered = hoveredBarIndex === i;
                    const isActive = i === chartData.activeIndex;

                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredBarIndex(i)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                        onClick={() => setHoveredBarIndex(isHovered ? null : i)}
                        className="flex flex-col items-center gap-2 group flex-1 relative cursor-pointer"
                      >
                        {/* Tooltip on hover if value > 0 */}
                        {isHovered && rawVal > 0 && (
                          <div className="absolute -top-7 z-20 bg-black/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/20 whitespace-nowrap shadow-lg">
                            {formatWholeCurrency(rawVal, currency)}
                          </div>
                        )}

                        <div className="w-full max-w-[8px] bg-white/5 rounded-full h-20 relative overflow-hidden flex items-end">
                          <div
                            style={{ height: `${h}%` }}
                            className={`w-full rounded-full transition-all duration-500 ${
                              h > 0
                                ? isActive
                                  ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]'
                                  : 'bg-white/40 group-hover:bg-white/80'
                                : 'bg-transparent'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-[9px] ${
                            isActive ? 'text-white font-bold' : 'text-kova-muted'
                          }`}
                        >
                          {chartData.labels[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Categories View */}
            {analyticsTab === 'categories' && (
              <div className="animate-in fade-in duration-200">
                <CategoryBreakdownView
                  items={categoryBreakdown.items}
                  totalAmount={categoryBreakdown.totalAmount}
                  currency={currency}
                  monthName={selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  filterType={filterType}
                />
              </div>
            )}
          </div>

          {/* Note Card from Kova — Only rendered when genuinely true based on real data for selected month */}
          {higherThanUsualExpenses.length > 0 && (
            <div className="glass-card rounded-2xl p-4 border border-dashed border-kova-raised bg-kova-surface/60 mb-6 flex items-start gap-3 animate-in fade-in duration-200">
              <Sparkles className="w-4 h-4 text-white/80 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-kova-muted">
                <span className="text-white font-medium block mb-0.5">Note from Kova</span>
                Kova noticed {higherThanUsualExpenses.length} purchase{higherThanUsualExpenses.length > 1 ? 's' : ''} higher than your usual baseline in {selectedMonthDate.toLocaleDateString('en-US', { month: 'long' })}.
              </div>
            </div>
          )}

          {/* Expense List Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              {selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Entries
            </h3>
            <span className="text-xs text-kova-muted">{filteredExpenses.length} records</span>
          </div>

          {/* Expense List Rows with Framer Motion Staggered Animation */}
          <motion.div
            key={`expense-list-${selectedMonthDate.getTime()}-${filterType}`}
            variants={listContainerVariants}
            initial="hidden"
            animate="show"
            className="space-y-2.5"
          >
            {filteredExpenses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12 glass-card rounded-2xl border border-white/5 text-kova-muted text-xs"
              >
                No {filterType} entries logged this month.
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredExpenses.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    variants={listItemVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleOpenEditModal(item)}
                    className="glass-card glass-card-hover rounded-[20px] p-3.5 sm:p-4 border border-white/10 flex items-center justify-between gap-2.5 sm:gap-3 group cursor-pointer transition-colors"
                  >
                    {/* Left: Category Icon & Details */}
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                        {getCategoryIcon(item.category)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">
                            {item.label}
                          </span>

                          {/* Restrained Soft Red "Higher Than Usual" Tag */}
                          {higherThanUsualIds.has(item.id) && (
                            <span className="text-[10px] font-medium text-kova-red-soft bg-kova-red/10 px-2 py-0.5 rounded-full border border-kova-red/20 shrink-0 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>higher than usual</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-kova-muted mt-0.5 flex items-center gap-2 whitespace-nowrap min-w-0">
                          <span className="truncate">{formatExpenseTimestamp(item.timestamp)}</span>
                          <span aria-hidden="true" className="shrink-0">•</span>
                          <span className="shrink-0">{item.category}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                      <div className="text-right">
                        <div className={`text-sm font-bold tracking-tight ${
                          item.type === 'income' ? 'text-kova-green' : 'text-white'
                        }`}>
                          {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount, currency, item.nativeCurrency)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteExpense(item.id);
                        }}
                        className="reveal-on-hover w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 text-kova-muted hover:text-red-400 flex items-center justify-center cursor-pointer"
                        title="Delete entry"
                        aria-label={`Delete ${item.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        </>
      )}

      {/* Floating Bottom Action Button: "+ Log an expense" (for current month) */}
      {isCurrentMonth && (
        <div className="fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-1/2 -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={onOpenAddExpense}
            className="bg-white text-black font-semibold text-xs px-6 py-3 rounded-full shadow-[0_0_24px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Log an expense</span>
          </button>
        </div>
      )}

      {/* EDIT EXPENSE MODAL */}
      {editingExpense && (
        <div className="kova-modal kova-sheet fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-card rounded-[28px] p-6 border border-white/10 bg-kova-surface max-w-sm w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white tracking-tight">Edit Entry</h3>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-xs text-kova-muted hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Type Switcher */}
              <div>
                <label className="text-[11px] font-semibold text-kova-muted uppercase tracking-wider block mb-1.5">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setEditType('outcome')}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      editType === 'outcome' ? 'bg-white text-black shadow' : 'text-kova-muted hover:text-white'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('income')}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      editType === 'income' ? 'bg-kova-green text-black shadow' : 'text-kova-muted hover:text-white'
                    }`}
                  >
                    Income
                  </button>
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="text-[11px] font-semibold text-kova-muted uppercase tracking-wider block mb-1.5">
                  Label / Description
                </label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g. Groceries"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-[11px] font-semibold text-kova-muted uppercase tracking-wider block mb-1.5">
                  Amount ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[11px] font-semibold text-kova-muted uppercase tracking-wider block mb-1.5">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-kova-raised border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  {['Shopping', 'Car repair', 'Grocery', 'Gym', 'Laundry', 'Dining out', 'Coffee', 'Subscriptions', 'Travel', 'Housing', 'Income', 'Other'].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="w-full bg-white text-black font-semibold text-xs py-3 rounded-xl shadow hover:bg-white/90 active:scale-98 transition-all cursor-pointer"
              >
                Save Changes
              </button>

              <button
                type="button"
                onClick={handleDeleteEdit}
                className="w-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-semibold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


