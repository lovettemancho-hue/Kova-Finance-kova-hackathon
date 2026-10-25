import React from 'react';
import { SubscriptionRadarCardData } from '../types';
import { formatCurrency, formatWholeCurrency } from '../utils/currency';

const PER: Record<SubscriptionRadarCardData['rows'][number]['interval'], string> = {
  weekly: 'a week',
  monthly: 'a month',
  yearly: 'a year',
};

// "Your subscriptions" (KOVA-086): what repeats, what it costs and when it's next, from the user's own logs.
export const SubscriptionRadarCard: React.FC<{ data: SubscriptionRadarCardData }> = ({ data }) => {
  const whole = (n: number) => formatWholeCurrency(n, data.currency, data.currency);
  const exact = (n: number) => formatCurrency(n, data.currency, data.currency);

  return (
    <div className="w-full max-w-md glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-3.5">
      <div className="space-y-0.5">
        <div className="text-sm font-semibold text-white">Your subscriptions</div>
        <div className="text-xs text-[#8A8A8E]">
          About {whole(data.monthlyTotal)} a month · {whole(data.annualTotal)} a year
        </div>
      </div>

      <ul className="space-y-3" aria-label="Your subscriptions">
        {data.rows.map((row) => (
          <li key={row.name} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-sm truncate ${row.cancelling ? 'text-[#8A8A8E] line-through' : 'text-white'}`}>{row.name}</span>
              <span className="text-sm font-semibold tabular-nums text-white shrink-0">
                {exact(row.amount)} <span className="text-xs font-normal text-[#8A8A8E]">{PER[row.interval]}</span>
              </span>
            </div>
            <div className="text-xs text-[#8A8A8E]/80">
              {row.cancelling ? (
                <span className="text-amber-300/90">You said you'd cancel this</span>
              ) : (
                <>
                  Next {row.nextLabel}
                  {row.guess && ' · a guess from one charge'}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-[#8A8A8E] pt-1 border-t border-white/5">
        Predicted from the rhythm of past charges, so dates are approximate.
      </p>
    </div>
  );
};
