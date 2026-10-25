import React, { useState } from 'react';
import { CategoryBreakdownCardData } from '../types';
import { formatWholeCurrency } from '../utils/currency';

const VISIBLE_ROWS = 6;
// Recurring costs are the ones worth a second look, so they stand out (same idea as the design mock).
const HIGHLIGHT = /subscription/i;

// "Where October went": spending by category as bars, under a Kova reply in chat (KOVA-080).
export const CategoryBreakdownCard: React.FC<{ data: CategoryBreakdownCardData }> = ({ data }) => {
  const [expanded, setExpanded] = useState(false);
  const money = (n: number) => formatWholeCurrency(n, data.currency, data.currency);
  const max = Math.max(...data.rows.map((r) => r.amount), 1);
  const rows = expanded ? data.rows : data.rows.slice(0, VISIBLE_ROWS);
  const hidden = data.rows.length - rows.length;

  return (
    <div className="w-full max-w-md glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[#8A8A8E]">Where {data.monthLabel} went</span>
        <span className="text-sm font-semibold text-[#8A8A8E]">{money(data.total)}</span>
      </div>

      <ul className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] gap-x-3 gap-y-3" aria-label={`Spending by category in ${data.monthLabel}`}>
        {rows.map((row) => {
          const accent = HIGHLIGHT.test(row.category);
          const pct = Math.max(4, Math.round((row.amount / max) * 100));
          return (
            <li key={row.category} className="col-span-3 grid grid-cols-subgrid items-center">
              <span className="text-sm text-white truncate">{row.category}</span>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${accent ? 'bg-amber-300' : 'bg-white'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-sm font-semibold tabular-nums text-right ${accent ? 'text-amber-300' : 'text-white'}`}>
                {money(row.amount)}
              </span>
            </li>
          );
        })}
      </ul>

      {(hidden > 0 || expanded) && data.rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-[#8A8A8E] hover:text-white underline underline-offset-2 cursor-pointer"
        >
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
};
