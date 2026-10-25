import React from 'react';
import { MonthlyPacingResult } from '../utils/analytics';
import { TrendingDown, TrendingUp, CheckCircle2, Compass, Activity } from 'lucide-react';
import { formatWholeCurrency } from '../utils/currency';

interface MonthlyPacingCardProps {
  pacing: MonthlyPacingResult;
  currency: string;
}

export const MonthlyPacingCard: React.FC<MonthlyPacingCardProps> = ({ pacing, currency }) => {
  if (!pacing.hasEnoughHistory) {
    return (
      <div className="glass-card rounded-2xl p-4 border border-dashed border-white/10 bg-[#161618]/50 my-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-white/50">
          <Compass className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/80">Monthly Spending Pace</span>
            <span className="text-[9px] text-[#8A8A8E] bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
              History Baseline
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#8A8A8E] mt-1">
            {pacing.subtext}
          </p>
        </div>
      </div>
    );
  }

  const isBelow = pacing.status === 'below';
  const isAbove = pacing.status === 'above';
  const isOnTrack = pacing.status === 'on_track';

  const badgeBg = isBelow
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : isAbove
    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
    : 'bg-white/10 text-white border-white/20';

  return (
    <div className="glass-card rounded-[22px] p-4 border border-white/10 bg-[#161618]/80 my-3 space-y-2.5">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-bold text-white tracking-tight">Spending Pace</span>
        </div>

        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 font-mono ${badgeBg}`}>
          {isBelow && <TrendingDown className="w-3 h-3" />}
          {isAbove && <TrendingUp className="w-3 h-3" />}
          {isOnTrack && <CheckCircle2 className="w-3 h-3" />}
          <span>
            {isBelow ? `${Math.abs(pacing.differencePercent)}% slower pace` : isAbove ? `${pacing.differencePercent}% faster pace` : 'On track'}
          </span>
        </span>
      </div>

      {/* Main Headline */}
      <div className="text-xs font-medium text-white/90 leading-snug">
        {pacing.headline}
      </div>

      {/* Visual Pace Comparison Bar */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between text-[10px] text-[#8A8A8E] font-mono">
          <span>This month: {formatWholeCurrency(pacing.currentSpend, currency)}</span>
          <span>Avg baseline: {formatWholeCurrency(pacing.historicalAvg, currency)}</span>
        </div>

        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex relative">
          {/* Historical Baseline Marker */}
          <div
            style={{
              width: `${Math.min(100, Math.max(5, (pacing.currentSpend / (pacing.historicalAvg * 1.5 || 1)) * 100))}%`,
            }}
            className={`h-full rounded-full transition-all duration-500 ${
              isBelow ? 'bg-emerald-400' : isAbove ? 'bg-amber-400' : 'bg-white'
            }`}
          />
        </div>
      </div>

      {/* Detail Subtext */}
      <p className="text-[10px] text-[#8A8A8E] leading-relaxed pt-0.5">
        {pacing.subtext}
      </p>
    </div>
  );
};
