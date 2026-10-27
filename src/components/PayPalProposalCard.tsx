import React, { useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { PayPalProposal } from '../types';
import { paypalApi, PayPalActionResult, PayPalSuggestedAction } from '../utils/paypalClient';
import { formatCurrency } from '../utils/currency';

// Actions the PayPal agent proposed in chat (KOVA-087). Same wording and confirm flow as the check-in:
// nothing happens until the user taps a button, which calls the server's confirm-gated action route.

type State =
  | { status: 'idle' }
  | { status: 'working'; action: PayPalSuggestedAction }
  | { status: 'done'; result: PayPalActionResult }
  | { status: 'dismissed' }
  | { status: 'error'; message: string };

const LABEL: Record<string, string> = {
  cancel_subscription: 'Yes, cancel it',
  draft_dispute: 'Draft a message',
};
const NOTE: Record<string, string> = {
  cancel_subscription: 'This cancels the subscription in PayPal.',
  draft_dispute: "I'll write a draft for you to send. I won't contact anyone.",
};

const ProposalItem: React.FC<{ proposal: PayPalProposal; ended: boolean }> = ({ proposal, ended }) => {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [copied, setCopied] = useState(false);
  const actions = [proposal.suggestedAction, proposal.secondaryAction].filter(
    (a): a is PayPalSuggestedAction => !!a && a !== 'none'
  );

  const run = async (action: PayPalSuggestedAction) => {
    setState({ status: 'working', action });
    try {
      const result = await paypalApi.action(proposal.id, action);
      setState(result.success ? { status: 'done', result } : { status: 'error', message: result.message });
    } catch (e: any) {
      setState({ status: 'error', message: e?.message || "That didn't go through, and nothing was changed." });
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable; the text stays selectable
    }
  };

  if (state.status === 'dismissed') {
    return <p className="text-xs text-kova-muted px-1">Okay, left as it is.</p>;
  }

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className={`text-xs font-semibold text-white truncate ${proposal.type === 'unfamiliar_charge' ? 'font-mono tracking-tight' : ''}`}>
          {proposal.title}
        </div>
        {proposal.amountLabel && <div className="text-[11px] text-white/70 shrink-0">{proposal.amountLabel}</div>}
      </div>

      {state.status === 'done' ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-white">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {state.result.message}
              {state.result.savings &&
                ` That's about ${formatCurrency(state.result.savings.perYear, state.result.savings.currency, state.result.savings.currency)} a year back.`}
            </span>
          </div>
          {state.result.draftMessage && (
            <div className="space-y-2">
              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-white/85 bg-black/50 border border-white/10 rounded-xl p-3 font-sans select-text">
                {state.result.draftMessage}
              </pre>
              <button
                type="button"
                onClick={() => copy(state.result.draftMessage || '')}
                className="px-3 py-1.5 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 transition-all flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Copied' : 'Copy message'}</span>
              </button>
            </div>
          )}
        </div>
      ) : ended ? (
        // Suggestions expire with their check-in (30 min on the server). An old one is read-only.
        <p className="text-[10px] text-kova-muted">This suggestion has ended. Ask again or run a new check-in to act on it.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] text-kova-muted">
            {NOTE[actions[0]]}
            {actions[1] === 'draft_dispute' ? " Or I can draft a message for you to send; I won't contact anyone." : ''}
          </p>
          {state.status === 'error' && (
            <p className="text-xs text-kova-red-soft" role="alert">
              {state.message}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action, idx) => {
              const working = state.status === 'working' && state.action === action;
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => run(action)}
                  disabled={state.status === 'working'}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                    idx === 0 ? 'bg-white text-black hover:bg-white/90' : 'border border-white/25 text-white hover:bg-white/10'
                  }`}
                >
                  {working && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{working ? 'Working...' : idx === 0 ? LABEL[action] : `${LABEL[action]} instead`}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setState({ status: 'dismissed' })}
              disabled={state.status === 'working'}
              className="px-3.5 py-2 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Matches the server's check-in lifetime (server/paypal/checkinStore.ts). */
const PROPOSAL_LIFETIME_MS = 30 * 60 * 1000;

export const PayPalProposalCard: React.FC<{ proposals: PayPalProposal[]; createdAt?: number }> = ({ proposals, createdAt }) => {
  const ended = typeof createdAt === 'number' && Date.now() - createdAt > PROPOSAL_LIFETIME_MS;
  return (
    <div className="w-full max-w-md space-y-2.5">
      {proposals.map((p) => (
        <ProposalItem key={p.id} proposal={p} ended={ended} />
      ))}
    </div>
  );
};
