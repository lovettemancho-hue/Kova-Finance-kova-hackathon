import React, { useState, useEffect } from 'react';
import { UserProfile, MonthlyLetter, GrowthMark, MicroLesson, ViewMode, Expense, ChatMessage, SavingsGoal } from '../types';
import { KovaAvatar } from './KovaAvatar';
import { Sparkles, Check, Download, BookOpen, ArrowRight, RefreshCw, Feather, Archive, ChevronDown, Lock, Compass } from 'lucide-react';
import { downloadMonthlyReportPdf } from '../utils/generateReportPdf';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../context/ExpenseContext';
import { useGoals } from '../context/GoalContext';
import { useModal } from '../context/ModalContext';
import { TOPIC_CATEGORIES, TOTAL_TOPICS_COUNT } from '../data/topicsData';
import { getCurrencySymbol } from '../utils/currency';
import { fetchWithAuth } from '../utils/apiClient';

interface GrowScreenProps {
  userProfile?: UserProfile | null;
  monthlyLetter: MonthlyLetter | null;
  onSelectView: (view: ViewMode) => void;
  expensesCount?: number;
  expenses?: Expense[];
  messages?: ChatMessage[];
  savingsGoal?: SavingsGoal | null;
  growthMarks?: GrowthMark[];
  exploredTopics?: string[];
  onOpenArchive?: () => void;
  onExploreTopic?: (topic: string, category: string) => Promise<void> | void;
}

export const GrowScreen: React.FC<GrowScreenProps> = ({
  userProfile: propUserProfile,
  monthlyLetter,
  onSelectView,
  expensesCount: propExpensesCount,
  expenses: propExpenses,
  messages = [],
  savingsGoal: propSavingsGoal,
  growthMarks: propGrowthMarks,
  exploredTopics = [],
  onOpenArchive: propOnOpenArchive,
  onExploreTopic,
}) => {
  const { userProfile: authUserProfile, currency } = useAuth();
  const expenseCtx = useExpenses();
  const goalCtx = useGoals();
  const { openPremiumUpgrade } = useModal();

  const expenses = propExpenses || expenseCtx.expenses;
  const expensesCount = propExpensesCount !== undefined ? propExpensesCount : expenses.length;
  const userProfile = propUserProfile !== undefined ? propUserProfile : authUserProfile;
  const activeCurrency = currency || userProfile?.currency || 'USD';
  const savingsGoal = propSavingsGoal !== undefined ? propSavingsGoal : goalCtx.savingsGoal;
  const growthMarks = propGrowthMarks !== undefined ? propGrowthMarks : goalCtx.growthMarks;
  const [lesson, setLesson] = useState<MicroLesson | null>(null);
  const [isLoadingLesson, setIsLoadingLesson] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleTopicClick = (topic: string, categoryName: string, isPremiumTopic: boolean) => {
    const isPremiumUser = userProfile?.plan === 'premium';
    if (isPremiumTopic && !isPremiumUser) {
      openPremiumUpgrade();
      return;
    }
    if (onExploreTopic) {
      onExploreTopic(topic, categoryName);
    } else {
      onSelectView('chat');
    }
  };

  const handleViewArchiveClick = () => {
    if (propOnOpenArchive) {
      propOnOpenArchive();
      return;
    }
    const isPremium = userProfile?.plan === 'premium';
    if (!isPremium) {
      openPremiumUpgrade();
    } else {
      onSelectView('letter');
    }
  };

  // 1. Calculate genuine Consistency Rhythm based on user's actual createdAt date
  const createdAtDate = userProfile?.createdAt ? new Date(userProfile.createdAt) : new Date();
  const now = new Date();
  const elapsedMs = Math.max(0, now.getTime() - createdAtDate.getTime());
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.max(1, Math.floor(elapsedDays / 7) + 1);

  // Determine active engagement for each week
  // A week has activity if there was an expense, message, or goal contribution in that timestamp window
  const weekDots = Array.from({ length: Math.max(6, totalWeeks) }, (_, idx) => {
    const weekNum = idx + 1;
    if (weekNum > totalWeeks) {
      return { weekNum, isElapsed: false, hasActivity: false };
    }
    const weekStart = createdAtDate.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000;
    const weekEnd = createdAtDate.getTime() + weekNum * 7 * 24 * 60 * 60 * 1000;

    const hasExpenseInWeek = expenses.some((e) => {
      const t = new Date(e.timestamp).getTime();
      return !isNaN(t) && t >= weekStart && t < weekEnd;
    });

    const hasMessageInWeek = messages.some((m) => {
      const t = new Date(m.timestamp).getTime();
      return !isNaN(t) && t >= weekStart && t < weekEnd;
    });

    const hasContributionInWeek = (savingsGoal?.contributions || []).some((c) => {
      const t = new Date(c.timestamp).getTime();
      return !isNaN(t) && t >= weekStart && t < weekEnd;
    });

    // If new user and week 1, also count overall user activity if timestamps were relative
    const hasAnyActivityAtAll = expenses.length > 0 || messages.length > 0 || (savingsGoal?.contributions || []).length > 0;
    const isEngaged = weekNum === 1 ? (hasExpenseInWeek || hasMessageInWeek || hasContributionInWeek || hasAnyActivityAtAll) : (hasExpenseInWeek || hasMessageInWeek || hasContributionInWeek);

    return { weekNum, isElapsed: true, hasActivity: isEngaged };
  });

  const activeWeeksCount = weekDots.filter((w) => w.isElapsed && w.hasActivity).length;

  // 2. Growth Marks logic — start empty with starter mark if no real marks recorded yet
  const defaultStarterMarks: GrowthMark[] = [
    {
      id: 'gm-start',
      date: createdAtDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      title: 'Started your journey with Kova',
      description: 'Began building awareness with zero shame or spreadsheets.',
    },
  ];

  const marksToDisplay = growthMarks && growthMarks.length > 0 ? growthMarks : defaultStarterMarks;

  // Fetch or generate micro-lesson
  useEffect(() => {
    let isMounted = true;
    const fetchLesson = async () => {
      setIsLoadingLesson(true);
      try {
        const res = await fetchWithAuth('/api/grow-lesson', {
          method: 'POST',
          body: JSON.stringify({
            userProfile,
            expenses,
            savingsGoals: goalCtx.savingsGoals, // for the server-computed snapshot (item 7)
            currency: activeCurrency,
            currencySymbol: getCurrencySymbol(activeCurrency),
          }),
        });
        const data = await res.json();
        if (isMounted && data.lesson) {
          setLesson(data.lesson);
        }
      } catch (err) {
        console.error('Failed to load grow lesson', err);
      } finally {
        if (isMounted) setIsLoadingLesson(false);
      }
    };

    fetchLesson();
    return () => {
      isMounted = false;
    };
  }, [userProfile, expensesCount]);

  // Download PDF report directly using jsPDF
  const handleDownloadReport = () => {
    if (!monthlyLetter) return;
    setIsDownloading(true);
    try {
      downloadMonthlyReportPdf(
        monthlyLetter,
        userProfile?.firstName || 'Friend',
        userProfile?.workingGoal || 'Financial Clarity'
      );
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const currentMonthName = now.toLocaleDateString('en-US', { month: 'long' });

  return (
    <div className="flex flex-col min-h-app max-w-2xl mx-auto w-full px-4 pb-20 pt-2 animate-in fade-in duration-300 font-sans space-y-6">
      {/* Grow Header */}
      <div className="flex items-center justify-between py-2 border-b border-kova-raised/50">
        <div className="flex items-center gap-2 min-w-0">
          <KovaAvatar size="sm" isPulsing={true} />
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Growth & Literacy</h2>
            <p className="text-[10px] text-kova-muted">Accumulating quietly without score or pressure</p>
          </div>
        </div>

        <div className="text-xs text-kova-muted bg-white/5 px-3 py-1 rounded-full border border-white/10 shrink-0 whitespace-nowrap max-w-[45%] truncate">
          {userProfile?.firstName ? `${userProfile.firstName}'s Journey` : 'Personal Rhythm'}
        </div>
      </div>

      {/* 1. Rhythm Card */}
      <div className="glass-card rounded-[28px] p-6 border border-white/15 bg-gradient-to-b from-kova-surface to-kova-surface-2 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-semibold text-kova-muted tracking-widest">
            Consistency Rhythm
          </span>
          <span className="text-[10px] text-kova-green font-medium bg-kova-green/10 px-2.5 py-0.5 rounded-full border border-kova-green/20">
            {activeWeeksCount > 0 ? `${activeWeeksCount} active week${activeWeeksCount > 1 ? 's' : ''}` : 'Week 1'}
          </span>
        </div>

        <div>
          <h3 className="text-2xl sm:text-3xl font-serif-headline text-white font-normal leading-tight">
            {totalWeeks} {totalWeeks === 1 ? 'week' : 'weeks'} running
          </h3>
          <p className="text-xs text-kova-muted mt-1">
            Logging intention regularly without standard app friction or streak loss penalties.
          </p>
        </div>

        {/* Soft Horizontal Dot-Row Visual */}
        <div className="pt-2">
          <div className="flex items-center justify-between max-w-xs mx-auto gap-3 py-2">
            {weekDots.slice(0, 6).map((item) => (
              <div key={item.weekNum} className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                    item.hasActivity
                      ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] scale-110'
                      : 'bg-kova-raised border border-white/10'
                  }`}
                />
                <span className="text-[9px] text-kova-muted">W{item.weekNum}</span>
              </div>
            ))}
          </div>
          <div className="text-center text-[10px] text-kova-muted italic pt-1">
            Every entry adds to your personal context
          </div>
        </div>
      </div>

      {/* 2. Growth Marks (Timeline) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-kova-muted uppercase tracking-wider px-1">
          <Feather className="w-3.5 h-3.5 text-white/80" />
          <span>Growth Marks</span>
        </div>

        <div className="glass-card rounded-[28px] p-6 border border-white/10 bg-kova-surface/90 relative">
          <div className="space-y-6 relative pl-6">
            {/* Connecting Thin Line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-[1.5px] bg-gradient-to-b from-white via-white/40 to-white/10" />

            {marksToDisplay.map((mark) => (
              <div key={mark.id} className="relative space-y-1">
                {/* Timeline Circle Node */}
                <div className="absolute -left-[29px] top-1 w-3.5 h-3.5 rounded-full bg-black border-2 border-white flex items-center justify-center shadow-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>

                <div className="flex justify-between items-baseline">
                  <h4 className="text-sm font-bold text-white tracking-tight">
                    {mark.title}
                  </h4>
                  <span className="text-[10px] text-kova-muted font-mono shrink-0">
                    {mark.date}
                  </span>
                </div>

                <p className="text-xs text-white/80 leading-relaxed font-normal">
                  {mark.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Today's Card (Micro-Lesson generated by Gemini) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-kova-muted uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-white/80" />
            <span>Today's Literacy Nugget</span>
          </div>
          {lesson?.readTime && (
            <span className="text-[10px] text-kova-muted bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              {lesson.readTime}
            </span>
          )}
        </div>

        <div className="glass-card rounded-[28px] p-6 border border-white/15 bg-kova-surface/95 shadow-xl space-y-4 relative">
          {isLoadingLesson ? (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="w-5 h-5 text-white/70 animate-spin mx-auto" />
              <p className="text-xs text-kova-muted">Kova is writing today's custom lesson...</p>
            </div>
          ) : lesson ? (
            <>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/50 tracking-widest block mb-1">
                  Concept: {lesson.concept}
                </span>
                <h3 className="text-xl font-serif-headline text-white font-normal">
                  {lesson.title}
                </h3>
              </div>

              <p className="text-xs text-white/90 leading-relaxed whitespace-pre-line font-normal border-l-2 border-white/20 pl-3">
                {lesson.content}
              </p>

              <div className="bg-kova-surface-2 p-3.5 rounded-2xl border border-white/10 text-xs text-white/90 italic">
                <span className="font-semibold text-white not-italic block mb-0.5">Key takeaway:</span>
                "{lesson.takeaway}"
              </div>

              {/* Mark as read interaction */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsRead(!isRead)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-2 border ${
                    isRead
                      ? 'bg-kova-green/15 text-kova-green border-kova-green/30'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Check className={`w-3.5 h-3.5 ${isRead ? 'stroke-[3]' : ''}`} />
                  <span>{isRead ? 'Marked as read' : 'Mark as read'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-xs text-kova-muted text-center py-4">
              Unable to load lesson at this moment.
            </div>
          )}
        </div>
      </div>

      {/* 4. Explore Topics (Expanded 200 Topics Accordion) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-kova-muted uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-white/80" />
            <span>Explore Topics ({TOTAL_TOPICS_COUNT})</span>
          </div>
          {exploredTopics.length > 0 && (
            <span className="text-[10px] text-kova-green font-medium bg-kova-green/10 px-2.5 py-0.5 rounded-full border border-kova-green/20">
              {exploredTopics.length} explored
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {TOPIC_CATEGORIES.map((category) => {
            const isOpen = !!expandedCategories[category.id];
            const totalInCat = category.freeTopics.length + category.premiumTopics.length;
            const exploredInCatCount = [...category.freeTopics, ...category.premiumTopics].filter((t) =>
              exploredTopics.includes(t)
            ).length;

            return (
              <div
                key={category.id}
                className="glass-card rounded-[22px] border border-white/10 bg-kova-surface/90 overflow-hidden transition-colors hover:border-white/20"
              >
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between p-4 sm:px-5 sm:py-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">
                      {category.name} ({totalInCat})
                    </span>
                    {exploredInCatCount > 0 && (
                      <span className="text-[10px] text-kova-green bg-kova-green/10 px-2 py-0.5 rounded-full border border-kova-green/20 font-medium">
                        {exploredInCatCount} explored
                      </span>
                    )}
                  </div>
                  <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/60">
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Collapsible Topic Content */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5 border-t border-white/5 space-y-3 animate-in fade-in duration-200">
                    <div className="flex flex-wrap gap-2 pt-2">
                      {/* Free Topics */}
                      {category.freeTopics.map((topic) => {
                        const isExplored = exploredTopics.includes(topic);
                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => handleTopicClick(topic, category.name, false)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                              isExplored
                                ? 'bg-white/15 text-white border-white/40 shadow-sm'
                                : 'bg-white/5 text-white/90 border-white/10 hover:bg-white/15 hover:border-white/25 hover:text-white'
                            }`}
                          >
                            {isExplored && <Check className="w-3 h-3 text-kova-green stroke-[3]" />}
                            <span>{topic}</span>
                          </button>
                        );
                      })}

                      {/* Premium Topics */}
                      {category.premiumTopics.map((topic) => {
                        const isExplored = exploredTopics.includes(topic);
                        const isPremiumUser = userProfile?.plan === 'premium';

                        if (isPremiumUser) {
                          return (
                            <button
                              key={topic}
                              type="button"
                              onClick={() => handleTopicClick(topic, category.name, true)}
                              className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                                isExplored
                                  ? 'bg-amber-400/15 text-amber-200 border-amber-400/30'
                                  : 'bg-amber-400/5 text-amber-300/90 border-amber-400/20 hover:bg-amber-400/10 hover:border-amber-400/30'
                              }`}
                            >
                              {isExplored ? (
                                <Check className="w-3 h-3 text-kova-green stroke-[3]" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-amber-400/80" />
                              )}
                              <span>{topic}</span>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => openPremiumUpgrade()}
                            className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-white/5 bg-white/[0.02] text-white/40 hover:border-amber-400/30 hover:text-white/70 hover:bg-amber-400/[0.04] transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95"
                            title="Upgrade to Premium to explore this topic"
                          >
                            <Lock className="w-3 h-3 text-amber-400/60" />
                            <span>{topic}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Monthly Letter */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-kova-muted uppercase tracking-wider px-1">
          <BookOpen className="w-3.5 h-3.5 text-white/80" />
          <span>Monthly Letter</span>
        </div>

        {monthlyLetter ? (
          <div className="glass-card rounded-[28px] p-6 border border-white/15 bg-kova-surface/90 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-kova-muted uppercase tracking-wider block">
                  {monthlyLetter.month} {monthlyLetter.year} Letter
                </span>
                <h4 className="text-base font-bold text-white tracking-tight mt-0.5">
                  "{monthlyLetter.headline}"
                </h4>
              </div>
            </div>

            <p className="text-xs text-white/80 line-clamp-2 leading-relaxed">
              {monthlyLetter.observations[0] || 'A quiet, balanced month with strong savings awareness.'}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  disabled={isDownloading}
                  className="text-xs text-kova-muted hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap"><span className="sm:hidden">Download</span><span className="hidden sm:inline">Download {monthlyLetter.month} Report</span></span>
                </button>
                <button
                  type="button"
                  onClick={handleViewArchiveClick}
                  className="text-xs text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 font-medium cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">View Archive</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onSelectView('letter')}
                className="bg-white text-black font-semibold text-xs px-5 py-2 rounded-full hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 shadow-md cursor-pointer ml-auto"
              >
                <span className="whitespace-nowrap">Read Full Letter</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-[28px] p-6 border border-white/10 bg-kova-surface/90 text-center space-y-3">
            <h4 className="text-sm font-bold text-white tracking-tight">
              Your {currentMonthName} letter is scheduled for month-end
            </h4>
            <p className="text-xs text-kova-muted max-w-md mx-auto leading-relaxed">
              Kova generates your personal briefing on the last day of each month using your real logged activity — no fake content or static placeholders.
            </p>
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={handleViewArchiveClick}
                className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 bg-amber-400/10 hover:bg-amber-400/20 px-4 py-2 rounded-full border border-amber-400/20 transition-all font-medium cursor-pointer hover:scale-105 active:scale-95 shadow-md"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>View Archive</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

