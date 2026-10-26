export type ViewMode = 'landing' | 'auth' | 'quiz' | 'chat' | 'log' | 'letter' | 'grow' | 'settings' | 'goal-coaching' | 'about' | 'guide';

export interface GoalContribution {
  id: string;
  amount: number; // positive for addition, negative for withdrawal
  timestamp: string; // ISO date string e.g. "2026-08-11T03:00:00.000Z"
  nativeCurrency?: string; // ISO currency code at the time of entry, e.g. "USD", "XAF"
}

export interface SavingsGoal {
  id?: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  status: 'active' | 'achieved' | 'archived';
  isArchived?: boolean;
  contributions?: GoalContribution[];
  nativeCurrency?: string; // ISO currency code at the time of creation / entry
  // 'debt' = paying something down (amounts are payments made); 'savings' = building up.
  // Older goals have no kind: use getGoalKind() (src/utils/goalKind.ts), which infers it from the title.
  kind?: GoalKind;
}

export type GoalKind = 'savings' | 'debt';

export interface UserProfile {
  firstName: string;
  email: string;
  financialFeeling: string; // e.g. "Stressed it out", "Avoid it mostly", etc.
  primaryMotivation: string; // e.g. "Want to save for something"
  overspendTrigger: string; // e.g. "Stress or a bad day"
  preferredTone: string; // e.g. "Gently, ease me in", "Straight, tell me the truth", etc.
  workingGoal: string; // e.g. "a trip to Tokyo"
  country?: string; // e.g. "United States", "Nigeria", "United Kingdom"
  currency?: string; // e.g. "USD", "NGN", "GBP", "EUR"
  savingsGoal?: SavingsGoal | null;
  isCompletedOnboarding: boolean;
  plan?: 'free' | 'premium';
  exploredTopics?: string[];
  createdAt?: string;
}

export interface GrowthMark {
  id: string;
  date: string;
  title: string;
  description: string;
}

export interface MicroLesson {
  title: string;
  concept: string;
  readTime: string;
  content: string;
  takeaway: string;
  isRead?: boolean;
}

export type ExpenseCategory = 
  | 'Shopping' 
  | 'Car repair' 
  | 'Grocery' 
  | 'Gym' 
  | 'Laundry' 
  | 'Dining out' 
  | 'Coffee' 
  | 'Subscriptions' 
  | 'Travel' 
  | 'Housing'
  | 'Income'
  | 'Other';

export interface Expense {
  id: string;
  label: string;
  category: ExpenseCategory;
  amount: number;
  type: 'outcome' | 'income';
  timestamp: string; // ISO or formatted e.g. "Just Now", "23, Jun, 2026 10:00"
  higherThanUsual?: boolean;
  note?: string;
  nativeCurrency?: string; // ISO currency code at the time of entry, e.g. "USD", "XAF"
}

export interface GoalCardData {
  id?: string;
  title: string;
  savedAmount: number;
  targetAmount: number;
  percentage: number;
  timeframe?: 'Day' | 'Week' | 'Month' | 'Year';
  chartData?: number[];
  contributions?: GoalContribution[];
  nativeCurrency?: string;
  kind?: GoalKind;
}

/** "Where October went" card under a Kova reply (KOVA-080). A snapshot, so old messages stay as they were. */
export interface CategoryBreakdownCardData {
  monthLabel: string; // e.g. "October"
  currency: string;
  total: number;
  rows: Array<{ category: string; amount: number }>; // largest first
}

/** "Can I afford this?" card (KOVA-085), computed on the phone in src/utils/affordability.ts. Amounts in `currency`. */
export interface AffordCardData {
  item: string;
  price: number;
  currency: string;
  monthLabel: string; // month the numbers were taken from, e.g. "October"
  spentSoFar: number; // spending this month before the purchase
  usualMonth: number | null; // average monthly spending over the last 3 months with spending
  leftAfter: number | null; // usual income − spent so far − price; null with no income logged
  goal: { title: string; kind: GoalKind; delayDays: number | null } | null; // delayDays null: no recent deposits
  otherGoals: number;
  // Where the price came from when the user didn't type one (KOVA-101). Absent when they typed it.
  // productId and title let "I'll wait" start a price watch (KOVA-102).
  priceSource?: { provider: 'Channel3'; domain: string; stores: number; quotedPrice: number; quotedCurrency: string; productId?: string; title?: string;
    // KOVA-103: photo, and on a price-drop card the earlier price and Channel3's 30-day low.
    imageUrl?: string; previousPrice?: number; lowestIn30Days?: boolean };
}

/** What the user told Kova about one subscription (KOVA-086), keyed by merchant key in `subscriptionNotes`. */
export interface SubscriptionNote {
  status?: 'kept' | 'cancelling' | 'not_subscription' | 'stopped';
  decidedAt?: string; // ISO
  nudgedFor?: string; // YYYY-MM-DD of the renewal Kova already warned about
  askedRenewedFor?: string; // YYYY-MM-DD of the renewal Kova already asked "did it renew?" about
}

/** "Your subscriptions" card (KOVA-086), computed on the phone in src/utils/subscriptionRadar.ts. */
export interface SubscriptionRadarCardData {
  currency: string;
  monthlyTotal: number;
  annualTotal: number;
  rows: Array<{
    name: string;
    amount: number;
    interval: 'weekly' | 'monthly' | 'yearly';
    nextLabel: string; // "around Oct 28"
    guess: boolean; // seen once, assumed monthly
    cancelling: boolean;
  }>;
}

/** An action the PayPal agent proposed (KOVA-087); confirmed through /api/paypal/action. */
export interface PayPalProposal {
  id: string;
  type: 'unfamiliar_charge' | 'review_subscription' | 'high_spend';
  title: string;
  amountLabel?: string;
  gentleExplanation: string;
  suggestedAction: 'cancel_subscription' | 'draft_dispute' | 'none';
  secondaryAction?: 'cancel_subscription' | 'draft_dispute' | 'none';
}

export interface ChatMessage {
  id: string;
  sender: 'kova' | 'user';
  text: string;
  timestamp: string;
  createdAt?: number; // epoch ms; used for ordering (timestamp is only a time of day)
  quickReplies?: string[];
  inlineGoalCard?: GoalCardData;
  categoryBreakdown?: CategoryBreakdownCardData;
  affordCard?: AffordCardData;
  // "I'll wait" confirmation: the product Kova is now watching (KOVA-103). Prices in the quoted currency.
  priceWatch?: { title: string; price: number; currency: string; domain: string; imageUrl?: string; until: string };
  radarCard?: SubscriptionRadarCardData;
  paypalBasis?: string; // "Based on 12 PayPal payments, Sep 22 – Oct 22"
  paypalProposals?: PayPalProposal[];
  extractedExpense?: Partial<Expense>;
  isThinking?: boolean;
}

export interface BookRecommendation {
  title: string;
  author: string;
  coverGradient: string; // Tailwind background gradient e.g. "from-[#1c1917] to-[#292524]"
  rationale?: string; // Legacy / single sentence
  whyThisPick?: string; // Grounded in a specific real observation from that month's actual data
  whatYouWillGet?: string; // One line on the specific takeaway or shift this book offers
}

export interface MonthlyLetter {
  id?: string;
  month: string; // e.g. "August"
  year: number; // e.g. 2026
  headline: string;
  observations: string[];
  suggestedShift: string;
  bookRecommendation?: BookRecommendation;
  bookRecommendations?: BookRecommendation[];
  hasNoHistory?: boolean;
  isShortTenure?: boolean;
  generatedAt?: string;
}

export interface NotificationBanner {
  id: string;
  sender: string;
  timeAgo: string;
  previewText: string;
  active: boolean;
}

export interface SendMessageOptions {
  type?: 'explore_query' | 'suggested_action' | 'chat';
  context?: string;
}
