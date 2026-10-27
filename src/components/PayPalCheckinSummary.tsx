import React from 'react';
import { Check, Wallet } from 'lucide-react';
import { PayPalCheckinRecord } from '../types';
import { formatCurrency } from '../utils/currency';

// A finished PayPal check-in, as it stays in the chat after it's closed or the page reloads.
// Read-only on purpose: the flags behind it expire after 30 minutes on the server, and PayPal may have
// changed since, so acting on anything needs a fresh check-in.

const fmt = (amount: number, currency: string) => formatCurrency(amount, currency, currency);

function checkedOn(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const PayPalCheckinSummary: React.FC<{ record: PayPalCheckinRecord }> = ({ record }) => {
  const acted = record.flags.filter((f) => f.outcome && f.outcome.kind !== 'dismissed');
  const open = record.flags.filter((f) => !f.outcome);

  return (
    <div className="w-full max-w-md glass-card rounded-[24px] p-4 border border-white/10 bg-kova-surface space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
          <Wallet className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white">PayPal check-in</span>
          <span className="text-[10px] text-kova-muted">
            {checkedOn(record.checkedAt)}
            {record.mode === 'real' ? ' · PayPal sandbox' : ' · demo data'}
          </span>
        </div>
      </div>

      {record.facts && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-1.5">
            <div className="text-xs font-semibold text-white">{fmt(record.facts.spentTotal, record.facts.currency)}</div>
            <div className="text-[10px] text-kova-muted">{record.facts.paymentCount} payments, {record.facts.periodDays} days</div>
          </div>
          <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-1.5">
            <div className="text-xs font-semibold text-white">{fmt(record.facts.subscriptionsPerMonth, record.facts.currency)}</div>
            <div className="text-[10px] text-kova-muted">{record.facts.activeSubscriptions} subscriptions a month</div>
          </div>
          <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-1.5">
            <div className="text-xs font-semibold text-white">{record.facts.unfamiliarCount}</div>
            <div className="text-[10px] text-kova-muted">unfamiliar names</div>
          </div>
        </div>
      )}

      <p className="text-xs text-white/85 leading-relaxed">{record.summary}</p>

      {acted.length > 0 && (
        <div className="space-y-1.5">
          {acted.map((f) => (
            <div key={f.id} className="flex items-start gap-2 text-xs text-white">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-kova-green" />
              <span>
                <span className="font-semibold">{f.title}</span>: {f.outcome!.message}
                {f.outcome!.perYear && f.outcome!.currency ? ` About ${fmt(f.outcome!.perYear, f.outcome!.currency)} a year back.` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <p className="text-[11px] text-kova-muted leading-relaxed">
          Also flagged: {open.map((f) => `${f.title}${f.amountLabel ? ` (${f.amountLabel})` : ''}`).join(', ')}.
        </p>
      )}

      <p className="text-[10px] text-kova-muted leading-relaxed">
        This check-in has ended. Run a new PayPal check-in to act on anything here.
      </p>
    </div>
  );
};
