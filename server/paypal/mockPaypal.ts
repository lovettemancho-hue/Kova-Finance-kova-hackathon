import type { PayPalProvider, PayPalSubscription, PayPalTransaction } from './types';

// MOCK PayPal: returns made-up demo data in the same shape the real
// implementation returns. Used while sandbox credentials are unavailable.
// Everything it returns is DEMO DATA, never real PayPal data.

const STREAMBOX_ID = 'I-MOCK-STREAMBOX';
const CLOUDNOTES_ID = 'I-MOCK-CLOUDNOTES';

// Per-user set of subscriptions cancelled during this server session.
const cancelledByUser = new Map<string, Set<string>>();

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function baseTransactions(): PayPalTransaction[] {
  const t = (
    id: string,
    d: number,
    amount: number,
    merchant: string,
    type: PayPalTransaction['type'] = 'purchase',
    subscriptionId?: string
  ): PayPalTransaction => ({
    id,
    date: daysAgo(d),
    amount,
    currency: 'USD',
    direction: 'out',
    merchant,
    type,
    ...(subscriptionId ? { subscriptionId } : {}),
  });

  return [
    t('MOCK-TX-001', 2, 38.4, 'FreshMart Groceries'),
    t('MOCK-TX-002', 3, 6.0, 'CityBus Transit'),
    t('MOCK-TX-003', 5, 12.99, 'StreamBox Premium', 'subscription_payment', STREAMBOX_ID),
    t('MOCK-TX-004', 6, 3.99, 'CloudNotes Pro', 'subscription_payment', CLOUDNOTES_ID),
    t('MOCK-TX-005', 8, 9.75, 'GreenLeaf Cafe'),
    // The "odd" charge for the demo: a vague merchant name the user may not recognise.
    t('MOCK-TX-006', 11, 24.99, 'GLBL*DIGITAL SVCS 8842'),
    t('MOCK-TX-007', 14, 52.1, 'FreshMart Groceries'),
    t('MOCK-TX-008', 17, 10.0, 'PhoneTopUp Express'),
    t('MOCK-TX-009', 20, 18.5, 'Book Corner'),
    t('MOCK-TX-010', 25, 22.3, 'Hardware Depot'),
    t('MOCK-TX-011', 28, 41.05, 'FreshMart Groceries'),
  ];
}

function baseSubscriptions(): PayPalSubscription[] {
  return [
    {
      id: STREAMBOX_ID,
      planName: 'StreamBox Premium (monthly)',
      merchant: 'StreamBox',
      status: 'ACTIVE',
      amount: 12.99,
      currency: 'USD',
      interval: 'MONTH',
      startedAt: daysAgo(210),
    },
    {
      id: CLOUDNOTES_ID,
      planName: 'CloudNotes Pro (monthly)',
      merchant: 'CloudNotes',
      status: 'ACTIVE',
      amount: 3.99,
      currency: 'USD',
      interval: 'MONTH',
      startedAt: daysAgo(95),
    },
  ];
}

export const mockPayPal: PayPalProvider = {
  mode: 'mock',

  async getTransactions(_uid, days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return baseTransactions().filter((tx) => new Date(tx.date).getTime() >= cutoff);
  },

  async getSubscriptions(uid) {
    const cancelled = cancelledByUser.get(uid) || new Set<string>();
    return baseSubscriptions().map((s) =>
      cancelled.has(s.id) ? { ...s, status: 'CANCELLED' as const } : s
    );
  },

  async cancelSubscription(uid, subscriptionId, _reason) {
    const exists = baseSubscriptions().some((s) => s.id === subscriptionId);
    if (!exists) {
      return { ok: false, message: 'That subscription was not found.' };
    }
    const set = cancelledByUser.get(uid) || new Set<string>();
    set.add(subscriptionId);
    cancelledByUser.set(uid, set);
    return { ok: true, message: 'Subscription cancelled (demo data).' };
  },
};

/** Test/demo helper: lets a developer reset the mock between demo runs. */
export function resetMockPayPal(uid?: string) {
  if (uid) cancelledByUser.delete(uid);
  else cancelledByUser.clear();
}
