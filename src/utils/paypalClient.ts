import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from './apiClient';

// Client helpers for the optional PayPal "Money Check-in" feature.
// All calls go through fetchWithAuth, so they are only ever made for a logged-in user.

export type PayPalMode = 'mock' | 'real';
export type PayPalSuggestedAction = 'cancel_subscription' | 'draft_dispute' | 'none';

export interface PayPalFlag {
  id: string;
  type: 'unfamiliar_charge' | 'review_subscription' | 'high_spend';
  title: string;
  amountLabel?: string;
  gentleExplanation: string;
  suggestedAction: PayPalSuggestedAction;
  secondaryAction?: PayPalSuggestedAction;
  subscriptionId?: string;
  transactionId?: string;
}

export interface PayPalCheckinFacts {
  periodDays: number;
  currency: string;
  paymentCount: number;
  spentTotal: number;
  activeSubscriptions: number;
  subscriptionsPerMonth: number;
  unfamiliarCount: number;
}

export interface PayPalCheckinResult {
  mode: PayPalMode;
  summary: string;
  flags: PayPalFlag[];
  transactionCount: number;
  currency: string;
  facts?: PayPalCheckinFacts;
}

export interface PayPalActionResult {
  success: boolean;
  message: string;
  draftMessage?: string;
  mode?: PayPalMode;
  action?: PayPalSuggestedAction;
  /** After a cancel: what it saves (server-computed). */
  savings?: { perMonth: number; perYear: number; currency: string };
}

/** "Ask Kova about your PayPal" (KOVA-087). Proposals are confirmed with paypalApi.action like check-in flags. */
export interface PayPalAskResult {
  answer: string;
  basis?: string | null;
  proposals: PayPalFlag[];
  mode?: PayPalMode;
  limitReached?: boolean;
  usage?: { used: number; limit: number; resetsAt: string };
}

// Which messages go to the PayPal agent: one typo allowed (KOVA-099).
export { isPayPalQuestion } from './paypalIntent';

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(endpoint, init);
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON response; fall through to the generic message below
  }
  if (!res.ok) {
    const err: Error & { status?: number } = new Error(data?.error || 'Something went wrong. Please try again.');
    err.status = res.status; // 404 = not invited to PayPal, 403 = not connected
    throw err;
  }
  return data as T;
}

export const paypalApi = {
  // available=false: this account isn't invited to the PayPal demo, so the app shows no PayPal at all (KOVA-084).
  status: () => request<{ available?: boolean; connected: boolean; mode: PayPalMode | null }>('/api/paypal/status'),
  connect: () =>
    request<{ connected: boolean; mode: PayPalMode }>('/api/paypal/connect', { method: 'POST' }),
  disconnect: () => request<{ connected: boolean }>('/api/paypal/disconnect', { method: 'POST' }),
  checkin: (userProfile: {
    firstName?: string;
    preferredTone?: string;
    financialFeeling?: string;
    currency?: string;
  }) =>
    request<PayPalCheckinResult>('/api/paypal/checkin', {
      method: 'POST',
      body: JSON.stringify({ userProfile }),
    }),
  ask: (
    question: string,
    history: Array<{ sender: string; text: string }>,
    userProfile: { firstName?: string; preferredTone?: string }
  ) =>
    request<PayPalAskResult>('/api/paypal/ask', {
      method: 'POST',
      body: JSON.stringify({ question, history, userProfile }),
    }),
  action: (flagId: string, action?: PayPalSuggestedAction) =>
    request<PayPalActionResult>('/api/paypal/action', {
      method: 'POST',
      body: JSON.stringify({ flagId, ...(action ? { action } : {}) }),
    }),
};

export function modeLabel(mode: PayPalMode | null | undefined): string {
  return mode === 'real' ? 'PayPal sandbox (test data)' : 'Demo data';
}

export function usePayPalStatus() {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false); // hidden until the server says this account is invited
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<PayPalMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await paypalApi.status();
      setAvailable(s.available === true);
      setConnected(!!s.connected);
      setMode(s.mode);
    } catch (e: any) {
      setAvailable(false);
      setConnected(false);
      setError(e?.message || 'Could not check PayPal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { loading, available, connected, mode, error, setConnected, setMode, refresh };
}
