import React, { useEffect, useRef, useState } from 'react';
import { Wallet, Loader2, X, Check, Copy } from 'lucide-react';
import {
  paypalApi,
  modeLabel,
  PayPalCheckinResult,
  PayPalFlag,
  PayPalActionResult,
  PayPalSuggestedAction,
} from '../utils/paypalClient';
import { useGoals } from '../context/GoalContext';
import { isDebtGoal } from '../utils/goalKind';
import { formatCurrency, convertCurrency } from '../utils/currency';
import { goalImpact } from '../lib/paypalImport';
import { PayPalCheckinRecord } from '../types';

interface PayPalCheckinCardProps {
  userProfile?: {
    firstName?: string;
    preferredTone?: string;
    financialFeeling?: string;
    currency?: string;
  } | null;
  onClose: () => void;
  /** Called with what was found and done, so the chat can keep it after a reload (read-only). */
  onRecord?: (record: PayPalCheckinRecord) => void;
}

type FlagState =
  | { status: 'idle' }
  | { status: 'working'; action: PayPalSuggestedAction }
  | { status: 'done'; result: PayPalActionResult }
  | { status: 'error'; message: string };

const fmt = (amount: number, currency: string) => formatCurrency(amount, currency, currency);

const ACTION_LABEL: Record<string, string> = {
  cancel_subscription: 'Yes, cancel it',
  draft_dispute: 'Draft a message',
};

const ACTION_NOTE: Record<string, string> = {
  cancel_subscription: 'This cancels the subscription in PayPal.',
  draft_dispute: "I'll write a draft for you to send. I won't contact anyone.",
};

// Runs a check-in when opened. Kova only PROPOSES; nothing happens until the user taps
// the action button on a card (which calls the server's confirm-gated action route).
export const PayPalCheckinCard: React.FC<PayPalCheckinCardProps> = ({ userProfile, onClose, onRecord }) => {
  const { activeGoals } = useGoals();
  // The goal a freed-up subscription could go toward: the first savings goal with money left to reach.
  const goal = (activeGoals || []).find((g) => !isDebtGoal(g) && g.targetAmount > g.currentAmount);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [result, setResult] = useState<PayPalCheckinResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [flagStates, setFlagStates] = useState<Record<string, FlagState>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const runCheckin = async () => {
    setPhase('loading');
    setErrorMessage('');
    setFlagStates({});
    setDismissed(new Set());
    try {
      const data = await paypalApi.checkin({
        firstName: userProfile?.firstName,
        preferredTone: userProfile?.preferredTone,
        financialFeeling: userProfile?.financialFeeling,
        currency: userProfile?.currency,
      });
      setResult(data);
      setPhase('ready');
    } catch (e: any) {
      setErrorMessage(e?.message || "I couldn't reach PayPal just now. Nothing was changed.");
      setPhase('error');
    }
  };

  useEffect(() => {
    if (startedRef.current) return; // guard against double-run in React StrictMode
    startedRef.current = true;
    runCheckin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [phase, flagStates]);

  // Keep a read-only record in the chat: the summary, the figures, and what happened to each flag.
  const checkedAtRef = useRef<string>('');
  useEffect(() => {
    if (phase !== 'ready' || !result || !onRecord) return;
    if (!checkedAtRef.current) checkedAtRef.current = new Date().toISOString();
    onRecord({
      checkedAt: checkedAtRef.current,
      mode: result.mode,
      summary: result.summary,
      facts: result.facts,
      flags: result.flags.map((f) => {
        const state = flagStates[f.id];
        let outcome: PayPalCheckinRecord['flags'][number]['outcome'];
        if (state?.status === 'done') {
          const res = state.result;
          outcome = res.draftMessage
            ? { kind: 'draft', message: "Draft written. Kova didn't contact anyone." }
            : {
                kind: 'cancelled',
                message: res.message || 'Cancelled.',
                perYear: res.savings?.perYear,
                currency: res.savings?.currency,
              };
        } else if (dismissed.has(f.id)) {
          outcome = { kind: 'dismissed', message: 'Left as it is.' };
        }
        return {
          id: f.id,
          type: f.type,
          title: f.title,
          amountLabel: f.amountLabel,
          gentleExplanation: f.gentleExplanation,
          outcome,
        };
      }),
    });
    // onRecord is a fresh closure each render; the record only changes with these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, flagStates, dismissed]);

  const handleAction = async (flag: PayPalFlag, action: PayPalSuggestedAction) => {
    setFlagStates((s) => ({ ...s, [flag.id]: { status: 'working', action } }));
    try {
      const res = await paypalApi.action(flag.id, action);
      if (res.success) {
        setFlagStates((s) => ({ ...s, [flag.id]: { status: 'done', result: res } }));
      } else {
        setFlagStates((s) => ({
          ...s,
          [flag.id]: { status: 'error', message: res.message || 'That did not go through.' },
        }));
      }
    } catch (e: any) {
      setFlagStates((s) => ({
        ...s,
        [flag.id]: { status: 'error', message: e?.message || 'That did not go through.' },
      }));
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      // clipboard unavailable; the text stays selectable in the box
    }
  };

  const visibleFlags = (result?.flags || []).filter((f) => !dismissed.has(f.id));

  return (
    <div
      ref={cardRef}
      className="w-full max-w-md glass-card rounded-[24px] p-5 border border-white/10 bg-kova-surface space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">PayPal check-in</span>
            {result && (
              <span className="text-[10px] text-kova-muted">{modeLabel(result.mode)}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close PayPal check-in"
          className="w-7 h-7 rounded-full flex items-center justify-center text-kova-muted hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {phase === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-white/80" role="status">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Kova is looking through your PayPal activity...</span>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-3" role="alert">
          <p className="text-xs text-kova-red-soft leading-relaxed">{errorMessage}</p>
          <button
            type="button"
            onClick={runCheckin}
            className="px-3.5 py-2 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 transition-all"
          >
            Try again
          </button>
        </div>
      )}

      {phase === 'ready' && result && (
        <div className="space-y-4" aria-live="polite">
          {result.facts && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-2">
                <div className="text-sm font-semibold text-white">{fmt(result.facts.spentTotal, result.facts.currency)}</div>
                <div className="text-[10px] text-kova-muted">
                  {result.facts.paymentCount} payment{result.facts.paymentCount === 1 ? '' : 's'}, {result.facts.periodDays} days
                </div>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-2">
                <div className="text-sm font-semibold text-white">{fmt(result.facts.subscriptionsPerMonth, result.facts.currency)}</div>
                <div className="text-[10px] text-kova-muted">
                  {result.facts.activeSubscriptions} subscription{result.facts.activeSubscriptions === 1 ? '' : 's'} a month
                </div>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/10 px-2 py-2">
                <div className="text-sm font-semibold text-white">{result.facts.unfamiliarCount}</div>
                <div className="text-[10px] text-kova-muted">unfamiliar name{result.facts.unfamiliarCount === 1 ? '' : 's'}</div>
              </div>
            </div>
          )}

          <p className="text-sm text-white/95 leading-relaxed">{result.summary}</p>

          {visibleFlags.length === 0 ? (
            <p className="text-xs text-kova-muted leading-relaxed">
              Nothing stood out in this check-in.
            </p>
          ) : (
            <div className="space-y-2.5">
              {visibleFlags.map((flag) => {
                const state: FlagState = flagStates[flag.id] || { status: 'idle' };
                const hasAction = flag.suggestedAction !== 'none';

                return (
                  <div
                    key={flag.id}
                    className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className={`text-xs font-semibold text-white ${flag.type === 'unfamiliar_charge' ? 'font-mono tracking-tight' : ''}`}>
                        {flag.title}
                      </div>
                      {flag.amountLabel && <div className="text-[11px] text-white/70 shrink-0">{flag.amountLabel}</div>}
                    </div>
                    <p className="text-xs text-white/75 leading-relaxed">{flag.gentleExplanation}</p>

                    {state.status === 'done' ? (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-xs text-white">
                          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            {state.result.message}
                            {state.result.savings &&
                              ` That's about ${fmt(state.result.savings.perYear, state.result.savings.currency)} a year back.`}
                          </span>
                        </div>
                        {state.result.savings && goal && (() => {
                          const native = goal.nativeCurrency || state.result.savings.currency;
                          const perMonth = convertCurrency(state.result.savings.perMonth, state.result.savings.currency, native);
                          const impact = goalImpact(goal, perMonth);
                          if (!impact.monthsToReach) return null;
                          return (
                            <p className="text-[11px] text-white/70 leading-relaxed pl-5">
                              Put toward {goal.title}, {fmt(perMonth, native)} a month would cover what's left (
                              {fmt(impact.remaining, native)}) in about {impact.monthsToReach} month{impact.monthsToReach === 1 ? '' : 's'} on its own.
                            </p>
                          );
                        })()}
                        {state.result.draftMessage && (
                          <div className="space-y-2">
                            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/85 bg-black/50 border border-white/10 rounded-xl p-3 font-sans select-text">
                              {state.result.draftMessage}
                            </pre>
                            <button
                              type="button"
                              onClick={() => handleCopy(flag.id, state.result.draftMessage || '')}
                              className="px-3 py-1.5 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 transition-all flex items-center gap-1.5"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>{copiedId === flag.id ? 'Copied' : 'Copy message'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : hasAction ? (
                      <div className="space-y-2">
                        <p className="text-[10px] text-kova-muted">
                          {ACTION_NOTE[flag.suggestedAction]}
                          {flag.secondaryAction === 'draft_dispute' ? " Or I can draft a message for you to send; I won't contact anyone." : ''}
                        </p>
                        {state.status === 'error' && (
                          <p className="text-xs text-kova-red-soft" role="alert">
                            {state.message}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {[flag.suggestedAction, flag.secondaryAction]
                            .filter((a): a is PayPalSuggestedAction => !!a && a !== 'none')
                            .map((action, idx) => {
                              const working = state.status === 'working' && state.action === action;
                              return (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => handleAction(flag, action)}
                                  disabled={state.status === 'working'}
                                  className={`px-3.5 py-2 rounded-full text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                                    idx === 0 ? 'bg-white text-black hover:bg-white/90' : 'border border-white/25 text-white hover:bg-white/10'
                                  }`}
                                >
                                  {working && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  <span>{working ? 'Working...' : ACTION_LABEL[action]}</span>
                                </button>
                              );
                            })}
                          <button
                            type="button"
                            onClick={() =>
                              setDismissed((d) => new Set(d).add(flag.id))
                            }
                            disabled={state.status === 'working'}
                            className="px-3.5 py-2 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 transition-all disabled:opacity-50"
                          >
                            Not now
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDismissed((d) => new Set(d).add(flag.id))}
                        className="px-3.5 py-2 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 transition-all"
                      >
                        Got it
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-kova-muted leading-relaxed">
            Kova only acts when you confirm. You can disconnect PayPal any time in Settings.
          </p>
        </div>
      )}
    </div>
  );
};
