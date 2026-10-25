import React from 'react';
import { AffordCardData } from '../types';
import { formatWholeCurrency } from '../utils/currency';
import { describeDelay } from '../utils/affordability';

// "Can I afford this?" (KOVA-085): the trade-off under a Kova reply. Numbers come from the user's own
// logs (src/utils/affordability.ts); the card never says yes or no.
export const AffordCard: React.FC<{ data: AffordCardData }> = ({ data }) => {
  const money = (n: number) => formatWholeCurrency(n, data.currency, data.currency);
  const after = data.spentSoFar + data.price;
  const short = data.leftAfter !== null && data.leftAfter < 0;
  const paceWord = data.goal?.kind === 'debt' ? 'paying it off' : 'saving';

  const rows: Array<{ label: string; value: string; note?: string; accent?: boolean }> = [
    {
      label: 'This month',
      value: `${money(data.spentSoFar)} → ${money(after)}`,
      note:
        data.usualMonth !== null
          ? `You usually spend about ${money(data.usualMonth)} a month`
          : `Your first month here, so there's no usual yet`,
    },
  ];

  if (data.goal) {
    rows.push({
      label: data.goal.title,
      value: data.goal.delayDays ? `${describeDelay(data.goal.delayDays)} later` : 'No estimate yet',
      note: data.goal.delayDays
        ? `At the pace you've been ${paceWord} lately${data.otherGoals ? `; your other ${data.otherGoals === 1 ? 'goal' : `${data.otherGoals} goals`} would wait a little too` : ''}`
        : 'Add to this goal a few times and I can show how much later',
    });
  }

  if (data.leftAfter !== null) {
    rows.push({
      label: `Left in ${data.monthLabel}`,
      value: short ? `About ${money(Math.abs(data.leftAfter))} short` : `About ${money(data.leftAfter)}`,
      note: 'After this, if your income comes in as usual',
      accent: short,
    });
  }

  return (
    <div className="w-full max-w-md glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-white truncate first-letter:uppercase">{data.item}</span>
        <span className="text-sm font-semibold text-white tabular-nums shrink-0">{money(data.price)}</span>
      </div>

      <dl className="space-y-3" aria-label={`How ${data.item} fits your money`}>
        {rows.map((row) => (
          <div key={row.label} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-[#8A8A8E] truncate">{row.label}</dt>
              <dd className={`text-sm font-semibold tabular-nums text-right shrink-0 ${row.accent ? 'text-amber-300' : 'text-white'}`}>
                {row.value}
              </dd>
            </div>
            {row.note && <p className="text-xs text-[#8A8A8E]/80 leading-relaxed">{row.note}</p>}
          </div>
        ))}
      </dl>

      <p className="text-[11px] text-[#8A8A8E] pt-1 border-t border-white/5">From your own logs. The choice is yours.</p>
    </div>
  );
};
