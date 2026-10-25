import { Expense, ChatMessage, GoalCardData, MonthlyLetter, NotificationBanner } from '../types';

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-1',
    label: 'Shopping',
    category: 'Shopping',
    amount: 300.00,
    type: 'outcome',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    higherThanUsual: true,
    note: 'Winter coat purchase - 20% higher than your standard apparel baseline'
  },
  {
    id: 'exp-2',
    label: 'Car repair',
    category: 'Car repair',
    amount: 125.00,
    type: 'outcome',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    higherThanUsual: false,
    note: 'Tire alignment check'
  },
  {
    id: 'exp-3',
    label: 'Grocery',
    category: 'Grocery',
    amount: 45.00,
    type: 'outcome',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    higherThanUsual: false,
    note: 'Fresh market essentials'
  },
  {
    id: 'exp-4',
    label: 'Gym',
    category: 'Gym',
    amount: 125.00,
    type: 'outcome',
    timestamp: '2026-06-23T10:00:00.000Z',
    higherThanUsual: false
  },
  {
    id: 'exp-5',
    label: 'Laundry',
    category: 'Laundry',
    amount: 200.00,
    type: 'outcome',
    timestamp: '2026-02-21T10:00:00.000Z',
    higherThanUsual: true,
    note: 'Dry cleaning & bed linen service'
  },
  {
    id: 'exp-6',
    label: 'Artisanal Coffee',
    category: 'Coffee',
    amount: 14.50,
    type: 'outcome',
    timestamp: '2026-03-08T09:15:00.000Z',
    higherThanUsual: false
  },
  {
    id: 'exp-7',
    label: 'Design Studio Stipend',
    category: 'Income',
    amount: 3200.00,
    type: 'income',
    timestamp: '2026-03-01T08:00:00.000Z',
    higherThanUsual: false
  }
];

export const INITIAL_GOAL_CARD: GoalCardData = {
  title: 'Saved This Month',
  savedAmount: 25999.00,
  targetAmount: 34665.00,
  percentage: 75,
  timeframe: 'Month',
  chartData: [12000, 15500, 18200, 21000, 23400, 25999, 27500]
};

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'kova',
    text: 'Good evening. I’ve been tracking your rhythm since this morning. You logged $45 for groceries earlier — right on pace with your gentle weekly target.',
    timestamp: '8:02 PM',
    quickReplies: [
      'How am I doing on savings?',
      'Log $12 lunch',
      'Read March letter'
    ]
  },
  {
    id: 'msg-2',
    sender: 'kova',
    text: 'Here is your current savings trajectory. You’re at 75% of your annual buffer goal — very steady.',
    timestamp: '8:03 PM',
    inlineGoalCard: INITIAL_GOAL_CARD
  }
];

export const INITIAL_MONTHLY_LETTER: MonthlyLetter = {
  month: 'March',
  year: 2026,
  headline: 'A calmer month than you think — dining out dropped 18%, and savings reached 75% of your milestone.',
  observations: [
    'Weekend spending peaked on March 14, but staycations kept total variable costs 12% lower than February.',
    'Your subscription cleanup saved $42/mo without impacting your daily routine.',
    'Grocery logs were steady at $45/visit — creating a predictable baseline for the rest of the spring.'
  ],
  suggestedShift: 'Try setting up an automated $50 transfer to your savings reserve on the 1st of the month, right before weekend plans take shape.',
  bookRecommendation: {
    title: 'Die With Zero',
    author: 'Bill Perkins',
    coverGradient: 'from-[#1c1917] via-[#292524] to-[#0c0a09]',
    whyThisPick: 'Your data shows dining out dropped 18% and savings reached 75% of your milestone, proving strong reserve building.',
    whatYouWillGet: 'A thoughtful perspective on balancing future security with memorable present experiences.',
    rationale: 'Your data shows dining out dropped 18% and savings reached 75% of your milestone — this book offers a thoughtful lens on balancing future security with memorable present experiences.'
  },
  bookRecommendations: [
    {
      title: 'Die With Zero',
      author: 'Bill Perkins',
      coverGradient: 'from-[#1c1917] via-[#292524] to-[#0c0a09]',
      whyThisPick: 'Your data shows dining out dropped 18% and savings reached 75% of your milestone, proving strong reserve building.',
      whatYouWillGet: 'A thoughtful perspective on balancing future security with memorable present experiences.',
      rationale: 'Your data shows dining out dropped 18% and savings reached 75% of your milestone — this book offers a thoughtful lens on balancing future security with memorable present experiences.'
    },
    {
      title: 'The Psychology of Money',
      author: 'Morgan Housel',
      coverGradient: 'from-[#1e1b4b] via-[#312e81] to-[#0f172a]',
      whyThisPick: 'Your weekend spending peaked on March 14, highlighting how emotional momentum impacts short-term choices.',
      whatYouWillGet: 'Understand how behavior and peace of mind shape long-term wealth far more than complex spreadsheets.',
      rationale: 'Your weekend spending peaked on March 14 — learn how behavior and peace of mind shape long-term wealth.'
    },
    {
      title: 'Atomic Habits',
      author: 'James Clear',
      coverGradient: 'from-[#203a43] via-[#2c5364] to-[#0f2027]',
      whyThisPick: 'Your subscription cleanup saved $42/mo without friction, demonstrating the power of small systemic shifts.',
      whatYouWillGet: 'Practical tools to automate positive financial choices seamlessly into your daily routine.',
      rationale: 'Your subscription cleanup saved $42/mo — practical tools to automate positive financial choices seamlessly.'
    }
  ]
};

export const INITIAL_NOTIFICATION: NotificationBanner = {
  id: 'notif-1',
  sender: 'Kova',
  timeAgo: 'from Kova · month-end',
  previewText: 'Your March letter is ready — a calmer month than you think, plus a book pick that fits it.',
  active: true
};
