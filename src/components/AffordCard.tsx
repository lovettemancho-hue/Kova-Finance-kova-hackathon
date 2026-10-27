import React from 'react';
import { AffordCardData } from '../types';
import { formatWholeCurrency } from '../utils/currency';
import { describeDelay } from '../utils/affordability';
import { ProductThumb } from './ProductThumb';

// "Can I afford this?" (KOVA-085): the trade-off under a Kova reply. Numbers come from the user's own
// logs (src/utils/affordability.ts); the card never says yes or no. A price Kova looked up says where it came from (KOVA-101).
export const AffordCard: React.FC<{ data: AffordCardData }> = ({ data }) => {
  const money = (n: number) => formatWholeCurrency(n, data.currency, data.currency);
  const after = data.spentSoFar + data.price;
  const short = data.leftAfter !== null && data.leftAfter < 0;
  const paceWord = data.goal?.kind === 'debt' ? 'paying it off' : 'saving';
  const src = data.priceSource;
  // The earlier price in the card's currency: same conversion ratio as today's price.
  const before =
    src?.previousPrice && src.quotedPrice > 0 ? Math.round(src.previousPrice * (data.price / src.quotedPrice) * 100) / 100 : null;

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
    <div className="w-full max-w-md glass-card rounded-[24px] p-5 border border-white/10 bg-kova-surface space-y-3.5">
      {src ? (
        // A product Kova priced (KOVA-103): photo, today's price, where, and on a drop the earlier price.
        <div className="space-y-3">
          <div className="flex gap-3.5">
            <ProductThumb url={src.imageUrl} alt={data.item} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{data.item}</p>
              <div className="flex items-baseline gap-2 mt-1">
                {before !== null && <span className="text-sm text-kova-muted line-through tabular-nums">{money(before)}</span>}
                <span className={`text-lg font-semibold tabular-nums ${before !== null ? 'text-kova-green' : 'text-white'}`}>{money(data.price)}</span>
              </div>
              <p className="text-xs text-kova-muted truncate">
                at {src.domain}
                {src.stores > 1 ? ` · lowest of ${src.stores} stores` : ''}
              </p>
            </div>
          </div>
          {(before !== null || src.lowestIn30Days) && (
            <div className="flex flex-wrap gap-1.5">
              {before !== null && before > data.price && (
                <span className="text-[11px] font-semibold text-kova-green bg-kova-green/10 border border-kova-green/25 rounded-full px-2.5 py-1">
                  ↓ {money(before - data.price)} since you asked
                </span>
              )}
              {src.lowestIn30Days && (
                <span className="text-[11px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/25 rounded-full px-2.5 py-1">
                  Lowest in 30 days
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-white truncate first-letter:uppercase">{data.item}</span>
          <span className="text-sm font-semibold text-white tabular-nums shrink-0">{money(data.price)}</span>
        </div>
      )}

      <dl className="space-y-3" aria-label={`How ${data.item} fits your money`}>
        {rows.map((row) => (
          <div key={row.label} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-kova-muted truncate">{row.label}</dt>
              <dd className={`text-sm font-semibold tabular-nums text-right shrink-0 ${row.accent ? 'text-amber-300' : 'text-white'}`}>
                {row.value}
              </dd>
            </div>
            {row.note && <p className="text-xs text-kova-muted/80 leading-relaxed">{row.note}</p>}
          </div>
        ))}
      </dl>

      <p className="text-[11px] text-kova-muted pt-1 border-t border-white/5 leading-relaxed">
        {src ? 'Price via Channel3. The rest is from your own logs. The choice is yours.' : 'From your own logs. The choice is yours.'}
      </p>
    </div>
  );
};
