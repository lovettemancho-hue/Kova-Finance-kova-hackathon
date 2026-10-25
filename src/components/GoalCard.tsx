import React, { useState } from 'react';
import { GoalCardData, GoalContribution } from '../types';
import { Pencil, CheckCircle2, Sparkles, ArrowDownLeft, ArrowUpRight, History, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatWholeCurrency, convertCurrency } from '../utils/currency';
import { computeGoalContributionSummary } from '../utils/analytics';
import { getGoalKind, goalWords } from '../utils/goalKind';

interface GoalCardProps {
  data: GoalCardData;
  currency?: string;
  onEditGoal?: () => void;
  onOpenCoach?: () => void;
}

function computeTimeframeData(
  timeframe: 'Day' | 'Week' | 'Month' | 'Year',
  savedAmount: number,
  rawContributions?: GoalContribution[],
  nativeCurrency?: string,
  displayCurrency: string = 'USD'
): { points: number[]; labels: string[] } {
  const now = new Date();

  // Convert raw contributions to display currency
  let contributions = (rawContributions || []).map((c) => ({
    ...c,
    amount: convertCurrency(
      c.amount,
      c.nativeCurrency || nativeCurrency || 'USD',
      displayCurrency
    ),
  }));

  // No contributions recorded: show no history rather than inventing deposits. (This used to
  // fabricate three deposits of 35/35/30% over the past month, which drew a fake rising line.)

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
  const earliestYear = contributions.length > 0
    ? Math.min(...contributions.map((c) => new Date(c.timestamp).getFullYear()))
    : now.getFullYear() - 1;
  const startYear = Math.min(earliestYear, now.getFullYear() - 1);
  const endYear = now.getFullYear();

  const points: number[] = [];
  const labels: string[] = [];

  for (let yr = startYear; yr <= endYear; yr++) {
    const endOfYear = new Date(yr, 11, 31, 23, 59, 59, 999);
    const cum = contributions
      .filter((c) => new Date(c.timestamp).getTime() <= endOfYear.getTime())
      .reduce((sum, c) => sum + c.amount, 0);

    points.push(Math.max(0, cum));
    labels.push(`${yr}`);
  }

  return { points, labels };
}

export const GoalCard: React.FC<GoalCardProps> = ({ data, currency: propCurrency, onEditGoal, onOpenCoach }) => {
  const { currency: authCurrency } = useAuth();
  const effectiveCurrency = propCurrency || authCurrency || 'USD';
  const [timeframe, setTimeframe] = useState<'Day' | 'Week' | 'Month' | 'Year'>(data.timeframe || 'Month');

  const saved = data.savedAmount || 0;
  const target = data.targetAmount || 1;
  const rawPercentage = Math.round((saved / target) * 100);
  const percentage = Math.min(100, Math.max(0, rawPercentage));
  const isUnset = !data.targetAmount || data.targetAmount <= 0;
  const isAchieved = !isUnset && saved >= target && target > 0;

  const formattedSaved = formatWholeCurrency(saved, effectiveCurrency, data.nativeCurrency);
  const formattedTarget = formatWholeCurrency(target, effectiveCurrency, data.nativeCurrency);

  const contributionSummary = computeGoalContributionSummary(
    data.contributions,
    effectiveCurrency,
    data.nativeCurrency
  );
  // Debt goals read as "paid off" / "payments" instead of "saved" / "deposits" (item 11).
  const words = goalWords(getGoalKind(data));

  // If goal has no target amount set yet, render the calm inviting unset card state
  if (isUnset) {
    return (
      <div
        onClick={onEditGoal}
        className="glass-card rounded-[28px] p-5 w-full relative overflow-hidden border border-dashed border-white/20 shadow-2xl my-2 transition-all group cursor-pointer hover:border-white/40 hover:bg-[#1A1A1D]/90"
        title="Tap to set target amount"
      >
        {/* Background glow gradient */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[#8A8A8E] font-medium tracking-wide uppercase truncate">
                {data.title || 'Savings Goal'}
              </span>
              <span className="text-[10px] text-white/50 reveal-on-hover flex items-center gap-0.5 bg-white/10 px-2 py-0.5 rounded-full">
                <Pencil className="w-2.5 h-2.5" />
                <span>Set Target</span>
              </span>
              {onOpenCoach && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCoach();
                  }}
                  className="text-[11px] font-semibold text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/25 flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 z-10"
                  title="Goal Coaching with Kova"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Coach</span>
                </button>
              )}
            </div>

            <div className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1">
              {saved > 0 ? (
                <div className="flex items-baseline gap-2">
                  <span>{formattedSaved}</span>
                  <span className="text-xs text-[#8A8A8E] font-normal">{words.soFar}</span>
                </div>
              ) : (
                <span className="text-white/90">Target not set yet</span>
              )}
            </div>
          </div>

          {/* Action Ring / Icon */}
          <div className="w-12 h-12 rounded-full bg-white/5 border border-dashed border-white/20 group-hover:border-white/40 group-hover:bg-white/10 transition-all flex items-center justify-center shrink-0 text-white/70 group-hover:text-white">
            <Target className="w-5 h-5" />
          </div>
        </div>

        {/* Action Prompt Box */}
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 group-hover:bg-white/[0.07] transition-all">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 text-amber-300">
              <Target className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-white/90 font-medium truncate">
              Tap to set a target for {data.title || 'this goal'}
            </p>
          </div>
          <span className="text-[11px] font-semibold bg-white text-black px-3 py-1 rounded-full shrink-0 group-hover:bg-white/90 shadow-sm transition-all">
            Set Target
          </span>
        </div>

        {/* Contribution Activity Footer if contributions exist */}
        {contributionSummary.totalEntries > 0 && (
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2 text-[10px] text-[#8A8A8E]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-emerald-400 font-medium font-mono">
                <ArrowDownLeft className="w-3 h-3" />
                {contributionSummary.depositCount} {contributionSummary.depositCount !== 1 ? words.entries : words.entry} ({formatWholeCurrency(contributionSummary.totalDeposits, effectiveCurrency)})
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-white/60 font-mono text-[9px]">
                Goal Savings
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Calculate chart points and labels based on active timeframe
  const { points, labels } = computeTimeframeData(
    timeframe,
    saved,
    data.contributions,
    data.nativeCurrency,
    effectiveCurrency
  );

  const width = 320;
  const height = 80;

  const rawMax = Math.max(...points);
  const rawMin = Math.min(...points);

  let maxVal = rawMax;
  let minVal = rawMin;

  if (rawMax === rawMin) {
    if (rawMax === 0) {
      maxVal = 10;
      minVal = 0;
    } else {
      maxVal = rawMax > 0 ? rawMax * 1.2 : 0;
      minVal = rawMin < 0 ? rawMin * 1.2 : 0;
    }
  } else {
    const range = rawMax - rawMin;
    maxVal = rawMax + range * 0.15;
    minVal = Math.min(0, rawMin - range * 0.15);
  }

  const svgPoints = points.map((val, idx) => {
    const denom = points.length > 1 ? points.length - 1 : 1;
    const x = (idx / denom) * width;
    const range = maxVal - minVal;
    const y = range === 0 ? height / 2 : height - ((val - minVal) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M 0,${height} L ${svgPoints.join(' L ')} L ${width},${height} Z`;
  const lineD = `M ${svgPoints.join(' L ')}`;

  const lastX = width;
  const lastY =
    maxVal === minVal
      ? height / 2
      : height - ((points[points.length - 1] - minVal) / (maxVal - minVal)) * height;

  // Filter labels if too dense (e.g., 14 days)
  const displayLabels = labels.length > 8
    ? labels.filter((_, i) => i % 2 === 0 || i === labels.length - 1)
    : labels;

  return (
    <div
      onClick={onEditGoal}
      className={`glass-card rounded-[28px] p-5 w-full relative overflow-hidden border border-white/15 shadow-2xl my-2 transition-all group cursor-pointer hover:border-white/30 hover:bg-[#1A1A1D]/90 ${
        isAchieved ? 'ring-1 ring-[#30D158]/50' : ''
      }`}
      title="Tap to edit goal or target amount"
    >
      {/* Background glow gradient */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-[#8A8A8E] font-medium tracking-wide uppercase">
              {data.title || 'Savings Goal'}
            </span>
            <span className="text-[10px] text-white/50 reveal-on-hover flex items-center gap-0.5 bg-white/10 px-2 py-0.5 rounded-full">
              <Pencil className="w-2.5 h-2.5" />
              <span>Edit</span>
            </span>
            {onOpenCoach && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCoach();
                }}
                className="text-[11px] font-semibold text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/25 flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 z-10"
                title="Goal Coaching with Kova"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Coach</span>
              </button>
            )}
          </div>

          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1 flex items-baseline gap-2">
            <span>{formattedSaved}</span>
            <span className="text-xs text-[#8A8A8E] font-normal">
              of {formattedTarget} {words.targetNoun}
            </span>
          </div>
        </div>

        {/* Circular Progress Ring */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="w-14 h-14 transform -rotate-90">
            <circle
              cx="28"
              cy="28"
              r="22"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="28"
              cy="28"
              r="22"
              stroke={isAchieved ? '#30D158' : '#FFFFFF'}
              strokeWidth="4"
              strokeDasharray={2 * Math.PI * 22}
              strokeDashoffset={2 * Math.PI * 22 * (1 - percentage / 100)}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute text-center flex flex-col items-center justify-center">
            {isAchieved ? (
              <CheckCircle2 className="w-4 h-4 text-[#30D158]" />
            ) : (
              <>
                <span className="text-[11px] font-bold text-white block leading-none">
                  {percentage}%
                </span>
                <span className="text-[7px] text-[#8A8A8E] tracking-tight">{words.progress}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Timeframe Pill Switch & Status Indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 bg-[#121214]/80 p-1 rounded-full w-fit border border-white/5">
          {(['Day', 'Week', 'Month', 'Year'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTimeframe(item);
              }}
              className={`px-3 py-0.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                timeframe === item
                  ? 'bg-white text-black shadow-md font-semibold'
                  : 'text-[#8A8A8E] hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {isAchieved ? (
          <span className="text-[10px] text-[#30D158] font-semibold bg-[#30D158]/10 px-2.5 py-1 rounded-full border border-[#30D158]/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Goal Completed!</span>
          </span>
        ) : (
          <span className="text-[10px] text-[#8A8A8E] italic">
            Tap card to update
          </span>
        )}
      </div>

      {/* Line Chart Container with Fade Transition */}
      <div key={timeframe} className="relative w-full h-20 mt-1 animate-in fade-in duration-300">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`whiteGradientGoal-${timeframe}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isAchieved ? '#30D158' : '#FFFFFF'} stopOpacity="0.25" />
              <stop offset="100%" stopColor={isAchieved ? '#30D158' : '#FFFFFF'} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={pathD} fill={`url(#whiteGradientGoal-${timeframe})`} />

          {/* Smooth Line */}
          <path
            d={lineD}
            fill="none"
            stroke={isAchieved ? '#30D158' : '#FFFFFF'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Highlight Marker Point */}
          <circle
            cx={lastX}
            cy={lastY}
            r="4.5"
            fill={isAchieved ? '#30D158' : '#FFFFFF'}
            stroke="#121214"
            strokeWidth="2"
            className="shadow-[0_0_12px_#ffffff]"
          />
        </svg>

        {/* Dynamic Timeline Markers */}
        <div className="flex justify-between text-[9px] text-[#8A8A8E] mt-1 px-1 font-mono">
          {displayLabels.map((lbl, idx) => (
            <span
              key={idx}
              className={idx === displayLabels.length - 1 ? 'text-white font-semibold' : ''}
            >
              {lbl}
            </span>
          ))}
        </div>
      </div>

      {/* Contribution Activity & Distribution Sparkline Footer */}
      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2 text-[10px] text-[#8A8A8E]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-emerald-400 font-medium font-mono">
            <ArrowDownLeft className="w-3 h-3" />
            {contributionSummary.depositCount} {contributionSummary.depositCount !== 1 ? words.entries : words.entry} ({formatWholeCurrency(contributionSummary.totalDeposits, effectiveCurrency)})
          </span>
          {contributionSummary.withdrawalCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400/80 font-medium font-mono">
              <ArrowUpRight className="w-3 h-3" />
              {contributionSummary.withdrawalCount} withdrawal{contributionSummary.withdrawalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Source Category / Origin Pill */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-white/60 font-mono text-[9px]">
            Goal Savings
          </span>
        </div>
      </div>
    </div>
  );
};
