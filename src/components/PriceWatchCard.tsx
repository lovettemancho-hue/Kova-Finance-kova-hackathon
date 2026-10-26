import React from 'react';
import { Eye } from 'lucide-react';
import { ChatMessage } from '../types';
import { formatWholeCurrency } from '../utils/currency';
import { ProductThumb } from './ProductThumb';

// Shown under "Okay, I'll keep an eye on the price…" (KOVA-103): what Kova is watching, at what price,
// and until when. Calm on purpose: no countdown, no urgency.
export const PriceWatchCard: React.FC<{ data: NonNullable<ChatMessage['priceWatch']> }> = ({ data }) => {
  const until = new Date(data.until);
  const untilText = Number.isNaN(until.getTime()) ? '30 days' : until.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return (
    <div className="w-full max-w-md glass-card rounded-[24px] p-4 border border-emerald-400/20 bg-[#111614] space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
        <span className="w-6 h-6 rounded-full bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center">
          <Eye className="w-3.5 h-3.5" />
        </span>
        <span>Watching the price</span>
      </div>
      <div className="flex items-center gap-3">
        <ProductThumb url={data.imageUrl} alt={data.title} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate first-letter:uppercase">{data.title}</p>
          <p className="text-xs text-[#8A8A8E]">
            {formatWholeCurrency(data.price, data.currency, data.currency)} at {data.domain} when you asked
          </p>
        </div>
      </div>
      <p className="text-xs text-[#8A8A8E] pt-2.5 border-t border-white/5">I'll tell you here only if it drops. Until {untilText}.</p>
    </div>
  );
};
