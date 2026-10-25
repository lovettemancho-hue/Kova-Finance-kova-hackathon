// Shared types for the optional PayPal "Money Check-in" feature.

export type PayPalMode = 'mock' | 'real';

export interface PayPalTransaction {
  id: string;
  date: string; // ISO string
  amount: number; // always positive; see `direction`
  currency: string;
  direction: 'out' | 'in';
  merchant: string;
  type: 'purchase' | 'subscription_payment' | 'refund' | 'other';
  subscriptionId?: string;
}

export interface PayPalSubscription {
  id: string;
  planName: string;
  merchant: string;
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'OTHER';
  amount: number;
  currency: string;
  interval: 'WEEK' | 'MONTH' | 'YEAR';
  startedAt: string; // ISO string
}

/**
 * The ONLY thing the rest of the app knows about PayPal.
 * The mock and the real implementation both satisfy this interface,
 * so switching between them never touches routes or screens.
 */
export interface PayPalProvider {
  mode: PayPalMode;
  getTransactions(uid: string, days: number): Promise<PayPalTransaction[]>;
  getSubscriptions(uid: string): Promise<PayPalSubscription[]>;
  cancelSubscription(
    uid: string,
    subscriptionId: string,
    reason: string
  ): Promise<{ ok: boolean; message: string }>;
}

export type FlagType = 'unfamiliar_charge' | 'review_subscription' | 'high_spend';
export type SuggestedAction = 'cancel_subscription' | 'draft_dispute' | 'none';

export interface CheckinFlag {
  id: string; // server-generated, never taken from the AI
  type: FlagType;
  title: string; // the store name as it appears on a statement (server-set)
  amountLabel?: string; // e.g. "14.99 USD a month" (server-computed)
  gentleExplanation: string;
  suggestedAction: SuggestedAction;
  /** A second action the flag allows, e.g. Draft a message on an unfamiliar subscription. */
  secondaryAction?: SuggestedAction;
  subscriptionId?: string;
  transactionId?: string;
  resolved?: boolean;
}

/** The numbers on the card, computed by the server (KOVA-079). */
export interface CheckinFacts {
  periodDays: number;
  currency: string;
  paymentCount: number;
  spentTotal: number;
  activeSubscriptions: number;
  subscriptionsPerMonth: number;
  unfamiliarCount: number;
}

export interface CheckinResult {
  mode: PayPalMode;
  summary: string;
  flags: CheckinFlag[];
  transactionCount: number;
  currency: string;
  facts?: CheckinFacts;
}
