import React, { useState, useCallback, useEffect, useRef } from 'react';
import { auth } from './lib/firebase';
import { initBilling } from './lib/billingService';
import { fetchWithAuth } from './utils/apiClient';
import { 
  updateUserProfile, 
  updateUserTone, 
  updateUserExpenses, 
  updateUserMessages, 
  mergeChatMessages,
  updateUserNotifications,
  updateUserSavingsGoal,
  updateUserSavingsGoals,
  updateUserGrowthMarks,
  updateUserExploredTopics,
  updateUserSubscriptionNotes,
  getLatestMonthlyLetter,
  saveMonthlyLetter,
  deleteUserData,
  UserDocument
} from './lib/userService';

import { 
  ViewMode, 
  Expense, 
  ChatMessage, 
  MonthlyLetter, 
  NotificationBanner as NotificationType,
  UserProfile,
  SavingsGoal,
  GoalContribution,
  GrowthMark,
  SendMessageOptions,
  ExpenseCategory,
  SubscriptionNote,
  PayPalCheckinRecord
} from './types';
import { 
  INITIAL_MONTHLY_LETTER, 
  INITIAL_NOTIFICATION 
} from './data/initialData';
import { RefreshCw } from 'lucide-react';
import { KovaAvatar } from './components/KovaAvatar';
import { LandingPage } from './components/LandingPage';
import { WelcomeScreen } from './components/WelcomeScreen';
import { hideSplash } from './lib/splash';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingQuizScreen } from './components/OnboardingQuizScreen';
import { Header } from './components/Header';
import { ChatScreen } from './components/ChatScreen';
import { GoalCoachingScreen } from './components/GoalCoachingScreen';
import { LogScreen } from './components/LogScreen';
import { GrowScreen } from './components/GrowScreen';
import { MonthlyLetterScreen } from './components/MonthlyLetterScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AboutScreen } from './components/AboutScreen';
import { HowToUseScreen } from './components/HowToUseScreen';
import { NotificationBanner } from './components/NotificationBanner';
import { AddExpenseModal } from './components/AddExpenseModal';
import { CsvImportModal } from './components/CsvImportModal';
import { VoiceNoteModal } from './components/VoiceNoteModal';
import { EditGoalModal } from './components/EditGoalModal';
import { PremiumUpgradeModal } from './components/PremiumUpgradeModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { adoptAccountTheme } from './lib/theme';
import { ExpenseProvider, useExpenses, sanitizeExpensesList } from './context/ExpenseContext';
import { GoalProvider, useGoals } from './context/GoalContext';
import { ModalProvider, useModal } from './context/ModalContext';
import { useToast } from './context/ToastContext';

import { downloadMonthlyReportPdf } from './utils/generateReportPdf';
import { formatWholeCurrency, formatCurrency, convertCurrency, getCurrencySymbol } from './utils/currency';
import { getGoalKind, isDebtGoal, isDebtRepayment } from './utils/goalKind';
import { Capacitor } from '@capacitor/core';
import { registerForPush, unregisterPush, shouldPromptForPush, PushRoute } from './lib/pushNotifications';
import { generateUniqueId } from './utils/id';
import { buildCategoryBreakdownCard } from './utils/analytics';
import { isCategoryBreakdownRequest } from './utils/chatIntents';
import { parseAffordRequest, parseAmountReply, buildAffordCard, isThinCard } from './utils/affordability';
import { fetchPriceUpdates, lookupPrice, shortProductName, watchPrice } from './utils/priceLookup';
import { localCategory } from './lib/statementImport/categorize';
import { paypalApi, isPayPalQuestion } from './utils/paypalClient';
import {
  findSubscriptions,
  buildRadarCard,
  radarNudges,
  renewsInText,
  dateLabel,
  cancelSavingsText,
  findByName,
  isSubscriptionRadarRequest,
} from './utils/subscriptionRadar';

import { stampNewMessages } from './utils/chatDays';

const formatToneSentence = (tone: string) => {
  const t = (tone || '').toLowerCase();
  if (t.includes('gently') || t.includes('ease')) {
    return 'I will keep our conversations gentle and supportive, focusing on awareness rather than judgment.';
  } else if (t.includes('straight') || t.includes('truth')) {
    return 'I will keep our conversations direct and honest, focusing on clarity rather than judgment.';
  } else if (t.includes('analytic') || t.includes('numbers')) {
    return 'I will keep our conversations data-driven and precise, focusing on pattern awareness.';
  } else if (t.includes('warm') || t.includes('mentor')) {
    return 'I will keep our conversations encouraging and reflective, focusing on long-term growth.';
  }
  return 'I will keep our conversations mindful, focusing on awareness rather than judgment.';
};

/** Rounds to 2 significant digits so converted suggestions read naturally (75,000 not 74,850). */
function roundToNiceAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(value)) - 1));
  return Math.round(value / magnitude) * magnitude;
}

function AppContent({
  currentView,
  setCurrentView,
  messages,
  setMessages,
  monthlyLetter,
  setMonthlyLetter,
  notification,
  setNotification,
  notificationSettings,
  setNotificationSettings,
  exploredTopics,
  setExploredTopics,
  subscriptionNotes,
  setSubscriptionNotes,
}: {
  currentView: ViewMode;
  setCurrentView: React.Dispatch<React.SetStateAction<ViewMode>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  monthlyLetter: MonthlyLetter | null;
  setMonthlyLetter: React.Dispatch<React.SetStateAction<MonthlyLetter | null>>;
  notification: NotificationType;
  setNotification: React.Dispatch<React.SetStateAction<NotificationType>>;
  notificationSettings: { monthlyLetter: boolean; dailyGrow: boolean };
  setNotificationSettings: React.Dispatch<React.SetStateAction<{ monthlyLetter: boolean; dailyGrow: boolean }>>;
  exploredTopics: string[];
  setExploredTopics: React.Dispatch<React.SetStateAction<string[]>>;
  subscriptionNotes: Record<string, SubscriptionNote>;
  setSubscriptionNotes: React.Dispatch<React.SetStateAction<Record<string, SubscriptionNote>>>;
}) {
  const {
    currentUser,
    userProfile,
    tempAuthUser,
    isAuthInitializing,
    plan,
    currency,
    updatePlan,
    updateTone,
    updateProfile,
    logout,
    deleteAccount,
    processUserAuth,
    noteUsage,
  } = useAuth();

  const activeCurrency = currency || userProfile?.currency || 'USD';
  const toast = useToast();

  const {
    expenses,
    setExpenses,
    addExpense,
    updateExpense,
    deleteExpense,
    bulkAddExpenses,
    processAiExtractedExpense,
  } = useExpenses();

  const {
    savingsGoal,
    savingsGoals,
    setSavingsGoal,
    setSavingsGoals,
    growthMarks,
    setGrowthMarks,
    editingGoal,
    editGoalModalMode,
    isEditGoalOpen,
    setIsEditGoalOpen,
    activeCoachingGoal,
    coachingMessages,
    isCoachingSending,
    handleOpenEditGoal,
    handleOpenAddNewGoal,
    handleCloseEditGoal,
    handleSaveGoal: ctxSaveGoal,
    handleArchiveGoal: ctxArchiveGoal,
    handleAllocateToGoal,
    handleWithdrawFromGoal,
    triggerGrowthMarkCheck,
    handleOpenCoach: ctxOpenCoach,
    handleSendCoachingMessage,
  } = useGoals();

  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('signup');

  const { openAddExpense, openCsvImport, openVoiceNote, openPremiumUpgrade } = useModal();
  const [openArchiveDirectly, setOpenArchiveDirectly] = useState(false);

  const handleOpenArchive = () => {
    const isPremium = userProfile?.plan === 'premium';
    if (!isPremium) {
      openPremiumUpgrade();
    } else {
      setOpenArchiveDirectly(true);
      setCurrentView('letter');
    }
  };

  // Loading states
  const [isSending, setIsSending] = useState(false);
  const [isRegeneratingLetter, setIsRegeneratingLetter] = useState(false);

  // Handle Onboarding Quiz Completion
  const handleCompleteQuiz = async (profile: UserProfile) => {
    let finalProfile = profile;
    if (
      finalProfile.plan !== 'premium' &&
      (finalProfile.preferredTone?.toLowerCase().includes('analytic') ||
        finalProfile.preferredTone?.toLowerCase().includes('numbers'))
    ) {
      finalProfile = {
        ...finalProfile,
        preferredTone: 'Warm, like a wise mentor',
      };
    }

    const profileWithCreation: UserProfile = {
      ...finalProfile,
      createdAt: finalProfile.createdAt || new Date().toISOString(),
    };

    const starterMark: GrowthMark[] = [
      {
        id: generateUniqueId('gm-start'),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        title: 'Started your journey with Kova',
        description: 'Began building awareness with zero shame or spreadsheets.',
      },
    ];

    const initialGoal: SavingsGoal = {
      id: generateUniqueId('goal'),
      title: profileWithCreation.workingGoal || 'Savings Goal',
      targetAmount: 0,
      currentAmount: 0,
      status: 'active',
      isArchived: false,
      kind: getGoalKind({ title: profileWithCreation.workingGoal || '' }),
    };

    const welcomeCurrency = (profileWithCreation.currency || 'USD').toUpperCase();
    // Ask in words that fit the goal (items 11 + 14): was "How much are you aiming to save for your Paying off a card?"
    const goalTitle = (profileWithCreation.workingGoal || '').trim();
    const goalQuestion = !goalTitle
      ? 'What amount would you like to aim for?'
      : initialGoal.kind === 'debt'
      ? `How much is left to pay off for "${goalTitle}"? I'll track it as you pay it down.`
      : `What's your target amount for "${goalTitle}"?`;
    const kovaWelcomeMessage: ChatMessage = {
      id: generateUniqueId('msg'),
      sender: 'kova',
      text: `Hello ${profileWithCreation.firstName}. I'm Kova. I'm here to talk with you about your money and help you build clarity at your own pace. ${formatToneSentence(profileWithCreation.preferredTone)} ${goalQuestion}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      // Suggested targets in the user's own currency (item 9): ~$500/$1k/$2.5k/$5k, rounded locally.
      quickReplies: [
        ...[500, 1000, 2500, 5000].map((usd) =>
          formatWholeCurrency(roundToNiceAmount(convertCurrency(usd, 'USD', welcomeCurrency)), welcomeCurrency, welcomeCurrency)
        ),
        'Skip for now',
      ],
    };

    const initialMsgs = [kovaWelcomeMessage];

    // Update local states immediately
    setGrowthMarks(starterMark);
    setSavingsGoal(initialGoal);
    setSavingsGoals([initialGoal]);
    setMessages(initialMsgs);
    setExpenses([]);

    // Immediately transition the view to 'chat' so screen switches without waiting for network round-trips
    setCurrentView('chat');

    // Batch network operations in parallel
    const user = currentUser || auth.currentUser;
    if (user) {
      Promise.all([
        updateProfile(profileWithCreation),
        updateUserMessages(user.uid, initialMsgs),
        updateUserExpenses(user.uid, []),
        updateUserSavingsGoal(user.uid, initialGoal),
        updateUserSavingsGoals(user.uid, [initialGoal]),
        updateUserGrowthMarks(user.uid, starterMark),
      ]).catch((err) => {
        console.warn('[handleCompleteQuiz] Background sync notice:', err);
      });
    }
  };

  // Handle Tone Preference update from Settings
  const handleUpdateTone = async (newTone: string) => {
    await updateTone(newTone);
  };

  // Prevent returning users from ever being stuck on the onboarding quiz
  // Hide the Android launch screen once the first real screen can render (KOVA-096).
  useEffect(() => {
    if (!isAuthInitializing) hideSplash();
  }, [isAuthInitializing]);

  useEffect(() => {
    if (
      currentView === 'quiz' &&
      (userProfile?.isCompletedOnboarding || expenses.length > 0 || savingsGoals.length > 0)
    ) {
      setCurrentView('chat');
    }
  }, [currentView, userProfile?.isCompletedOnboarding, expenses.length, savingsGoals.length, setCurrentView]);

  // Initialize RevenueCat In-App Billing for Native Android
  useEffect(() => {
    if (currentUser?.uid) {
      initBilling(currentUser.uid);
    }
  }, [currentUser?.uid]);

  // Plan changes go through AuthContext: purchase + server-owned entitlement (never a client write)
  const handleUpdatePlan = async (newPlan: 'free' | 'premium') => {
    await updatePlan(newPlan);
  };

  // Android push (KOVA-071). Tapping a notification opens its screen.
  const openFromPush = useCallback((route: PushRoute) => setCurrentView(route), [setCurrentView]);
  const pushWanted = notificationSettings.monthlyLetter || notificationSettings.dailyGrow;
  useEffect(() => {
    const uid = currentUser?.uid;
    // Only after onboarding, and only if a notification type is on. The permission dialog is shown
    // once per install; after that this just refreshes the device token.
    if (!uid || userProfile?.isCompletedOnboarding === false || !pushWanted) return;
    registerForPush(uid, { prompt: shouldPromptForPush(), onOpen: openFromPush });
  }, [currentUser?.uid, userProfile?.isCompletedOnboarding, pushWanted, openFromPush]);

  // Handle Notification Settings toggle
  const handleToggleNotificationSetting = async (key: 'monthlyLetter' | 'dailyGrow') => {
    const turningOn = !notificationSettings[key];
    const updated = {
      ...notificationSettings,
      [key]: turningOn,
    };
    setNotificationSettings(updated);

    const user = currentUser || auth.currentUser;
    if (user) {
      await updateUserNotifications(user.uid, updated);
      // Turning a notification on is a clear moment to ask for permission.
      if (turningOn) {
        const ok = await registerForPush(user.uid, { prompt: true, onOpen: openFromPush });
        if (!ok && Capacitor.isNativePlatform()) {
          toast.info('To get notifications, allow them for Kova in your phone settings.');
        }
      }
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    // Stop this user's notifications on this device (needs auth, so before logout).
    const uidAtLogout = currentUser?.uid || auth.currentUser?.uid;
    if (uidAtLogout) await unregisterPush(uidAtLogout);
    await logout();
    setExpenses([]);
    setMessages([]);
    setMonthlyLetter(null);
    setSavingsGoals([]);
    setSavingsGoal(null);
    setGrowthMarks([]);
    setCurrentView('landing');
  };

  // Handle Delete Account
  const handleDeleteAccount = async () => {
    await deleteAccount();
    setExpenses([]);
    setMessages([]);
    setMonthlyLetter(null);
    setSavingsGoals([]);
    setSavingsGoal(null);
    setGrowthMarks([]);
    setCurrentView('landing');
  };

  const handleSaveGoal = async (savedGoal: SavingsGoal, isNew?: boolean) => {
    await ctxSaveGoal(savedGoal, isNew, { messages, setMessages });
  };

  const handleArchiveGoal = async () => {
    await ctxArchiveGoal({ messages, setMessages });
  };

  const handleOpenCoach = async (goal: SavingsGoal) => {
    await ctxOpenCoach(goal, setCurrentView, openPremiumUpgrade);
  };

  // Adds a Kova message to the chat and saves it.
  const postKovaMessage = (fields: Omit<ChatMessage, 'id' | 'sender' | 'timestamp' | 'createdAt'>) => {
    const kovaMsg: ChatMessage = {
      id: generateUniqueId('msg'),
      sender: 'kova',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      ...fields,
    };
    setMessages((prev) => {
      const next = [...prev, kovaMsg];
      if (auth.currentUser) updateUserMessages(auth.currentUser.uid, next);
      return next;
    });
  };

  // A finished PayPal check-in stays in the chat (read-only after it's closed or the page reloads).
  // One message per check-in, updated as the user acts on its flags.
  const handleSavePayPalCheckin = (messageId: string, record: PayPalCheckinRecord) => {
    setMessages((prev) => {
      const existing = prev.find((m) => m.id === messageId);
      const next = existing
        ? prev.map((m) => (m.id === messageId ? { ...m, paypalCheckin: record } : m))
        : [
            ...prev,
            {
              id: messageId,
              sender: 'kova' as const,
              text: 'PayPal check-in',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: Date.now(),
              paypalCheckin: record,
            },
          ];
      if (auth.currentUser) updateUserMessages(auth.currentUser.uid, next);
      return next;
    });
  };

  // Subscription radar choices (KOVA-086): merged into the saved map on the user doc.
  const saveSubscriptionNote = (key: string, patch: SubscriptionNote) => {
    setSubscriptionNotes((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      if (auth.currentUser) updateUserSubscriptionNotes(auth.currentUser.uid, next);
      return next;
    });
  };

  // When the app opens on chat, mention renewals due within 3 days and charges that didn't show up,
  // once per renewal (KOVA-086). From the user's own logs; no AI call.
  const radarCheckedRef = useRef(false);
  useEffect(() => {
    if (radarCheckedRef.current || !userProfile || currentView !== 'chat' || messages.length === 0) return;
    radarCheckedRef.current = true;
    const money = (n: number) => formatCurrency(n, activeCurrency, activeCurrency);
    for (const nudge of radarNudges(findSubscriptions(expenses, activeCurrency, subscriptionNotes))) {
      const { sub } = nudge;
      if (nudge.kind === 'renews_soon') {
        postKovaMessage({
          text: `${sub.name} ${renewsInText(nudge.inDays)} (around ${dateLabel(sub.nextDate)}, ${money(sub.amount)}). Still using it?`,
          quickReplies: [`Keep ${sub.name}`, `Cancel ${sub.name}`, `${sub.name} isn't a subscription`],
        });
        saveSubscriptionNote(sub.key, { nudgedFor: sub.nextDate });
      } else {
        postKovaMessage({
          text: `Did ${sub.name} renew? I expected it around ${dateLabel(sub.nextDate)}, but it isn't in your log yet.`,
          quickReplies: [`Yes, log ${sub.name}`, `No, ${sub.name} stopped`],
        });
        saveSubscriptionNote(sub.key, { askedRenewedFor: sub.nextDate });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, currentView, messages.length, expenses, subscriptionNotes, activeCurrency]);

  // Price watch (KOVA-102): when the app opens on chat, mention real drops on products the user chose to
  // wait on, with the card redone at the new price. Prices from Channel3, checked by the server.
  // Admins can add ?simulatePriceDrop=1 to the URL to see a clearly marked test drop.
  const priceWatchCheckedRef = useRef(false);
  useEffect(() => {
    if (priceWatchCheckedRef.current || !userProfile || !currentUser || currentView !== 'chat' || messages.length === 0) return;
    priceWatchCheckedRef.current = true;
    let simulate = false;
    try {
      simulate = new URLSearchParams(window.location.search).get('simulatePriceDrop') === '1';
    } catch {
      // no URL (native shell): no simulation
    }
    fetchPriceUpdates(simulate).then((drops) => {
      const goals = savingsGoals.length > 0 ? savingsGoals : savingsGoal ? [savingsGoal] : [];
      for (const d of drops) {
        const name = shortProductName(d.title);
        const price = d.currency !== activeCurrency ? convertCurrency(d.newPrice, d.currency, activeCurrency) : d.newPrice;
        const before = d.currency !== activeCurrency ? convertCurrency(d.oldPrice, d.currency, activeCurrency) : d.oldPrice;
        const money = (n: number) => formatWholeCurrency(n, activeCurrency, activeCurrency);
        const card = {
          ...buildAffordCard({ item: name, price, currency: activeCurrency, expenses, goals }),
          priceSource: {
            provider: 'Channel3' as const, domain: d.domain, stores: 1, quotedPrice: d.newPrice, quotedCurrency: d.currency,
            productId: d.productId, title: d.title, previousPrice: d.oldPrice,
            ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}), ...(d.lowestIn30Days ? { lowestIn30Days: true } : {}),
          },
        };
        postKovaMessage({
          text: `${d.simulated ? '(Test, not a real price) ' : ''}The ${name} dropped to ${money(price)} at ${d.domain}, from ${money(before)} when you asked${d.lowestIn30Days ? ', the lowest in 30 days' : ''}. Still want it? Here's how it fits now.`,
          affordCard: card,
          quickReplies: ['I bought it, log it', "I'll wait"],
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, currentUser, currentView, messages.length]);

  // Handle sending chat message to Kova
  // Item waiting for its price after Kova asked "How much is it?" (KOVA-085).
  const pendingAffordRef = useRef<{ item: string } | null>(null);

  const handleSendMessage = async (text: string, options?: SendMessageOptions) => {
    const isExplore = options?.type === 'explore_query';

    // Navigation pills ("View Log overview", "Read monthly letter", "Log an expense") open the screen
    // directly. They used to go to the AI, costing a reply, and did nothing once the daily limit
    // was reached, even though the limit message offers them (KOVA-076).
    if (!isExplore) {
      const nav = text.toLowerCase().trim();
      if (/^(view log overview|show my spending log|view (my )?log)$/.test(nav)) {
        setCurrentView('log');
        return;
      }
      if (/^(read|show) (updated )?(monthly|march|my) letter$/.test(nav) || nav === 'read monthly letter') {
        setCurrentView('letter');
        return;
      }
      if (/^(log an expense|log another|add an expense)$/.test(nav)) {
        openAddExpense();
        return;
      }
      if (/^(import a statement|import csv)$/.test(nav)) {
        openCsvImport();
        return;
      }
      if (/^(see premium|more with premium|upgrade to premium)$/.test(nav)) {
        openPremiumUpgrade();
        return;
      }
    }
    const userMsg: ChatMessage = {
      id: generateUniqueId('msg'),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
    };

    // 1. Instantly append the user message to UI optimistically
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    // 2. Persist to Firestore asynchronously in background
    const currentUser = auth.currentUser;
    if (currentUser) {
      updateUserMessages(currentUser.uid, [...messages, userMsg]).catch((err) => {
        console.warn('[handleSendMessage] Persist notice:', err);
      });
    }

    const lower = text.toLowerCase().trim();

    // Fast-path intent routing only for regular conversational messages, NOT for educational explore queries
    if (!isExplore) {
      // "Show all categories" / "where did my money go": the breakdown card, from the user's own
      // logs, with no AI call and no reply counted (KOVA-080).
      if (isCategoryBreakdownRequest(lower)) {
        setIsSending(false);
        const card = buildCategoryBreakdownCard(expenses, activeCurrency);
        const top = card.rows[0];
        const share = top && card.total > 0 ? Math.round((top.amount / card.total) * 100) : 0;
        const kovaMsg: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text: top
            ? `Here's where ${card.monthLabel} went. ${top.category} is the biggest share, ${share}% of your spending.`
            : `Nothing logged for ${card.monthLabel} yet. Log an expense and I'll show you where your money goes.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: Date.now(),
          ...(top ? { categoryBreakdown: card } : {}),
          quickReplies: top ? ['View Log overview', 'Log an expense', 'How am I doing this month?'] : ['Log an expense'],
        };
        setMessages((prev) => {
          const next = [...prev, kovaMsg];
          if (currentUser) updateUserMessages(currentUser.uid, next);
          return next;
        });
        return;
      }

      // "Ask Kova about your PayPal" (KOVA-087): questions that mention PayPal go to the PayPal agent, which
      // answers from the user's PayPal data and can propose an action they confirm. Accounts that aren't
      // invited get a 404 from the server and carry on to the normal chat below.
      if (isPayPalQuestion(text)) {
        try {
          const history = messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text }));
          const r = await paypalApi.ask(text, history, {
            firstName: userProfile?.firstName,
            preferredTone: userProfile?.preferredTone,
          });
          setIsSending(false);
          if (r.usage) noteUsage('chat', r.usage);
          postKovaMessage({
            text: r.answer,
            ...(r.basis ? { paypalBasis: r.basis } : {}),
            ...(r.proposals?.length ? { paypalProposals: r.proposals } : {}),
            quickReplies: r.limitReached
              ? ['Log an expense', 'View Log overview']
              : r.proposals?.length
                ? []
                : ['Anything I should cancel on PayPal?', 'My PayPal subscriptions'],
          });
          return;
        } catch (e: any) {
          if (e?.status !== 404) {
            setIsSending(false);
            postKovaMessage({
              text: e?.status === 403 ? 'Connect PayPal in Settings first, then ask me again.' : e?.message || "I couldn't look at your PayPal just now.",
            });
            return;
          }
        }
      }

      // "Can I afford this?": the trade-off from the user's own logs, with no AI call and no reply
      // counted (KOVA-085). Kova shows how it fits and leaves the choice to the user.
      const pendingAfford = pendingAffordRef.current;
      pendingAffordRef.current = null;
      const affordAsk = parseAffordRequest(text, activeCurrency);
      const followUpPrice = !affordAsk && pendingAfford ? parseAmountReply(text, activeCurrency) : null;
      if (affordAsk || followUpPrice) {
        const item = affordAsk ? affordAsk.item : pendingAfford!.item;
        const parsed = affordAsk ? affordAsk.price : followUpPrice;
        const base = {
          id: generateUniqueId('msg'),
          sender: 'kova' as const,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: Date.now(),
        };
        const goals = savingsGoals.length > 0 ? savingsGoals : savingsGoal ? [savingsGoal] : [];
        // No price typed: ask the server for a real one first (Channel3, KOVA-101). A vague item or no clear
        // match comes back empty, and Kova asks "How much is it?" as before. Only the item name is sent.
        const quote = !parsed && affordAsk && item !== 'it' ? await lookupPrice(item, activeCurrency) : null;
        let kovaMsg: ChatMessage;
        if (quote) {
          const price = quote.currency !== activeCurrency ? convertCurrency(quote.price, quote.currency, activeCurrency) : quote.price;
          const name = shortProductName(quote.title);
          const card = {
            ...buildAffordCard({ item: name, price, currency: activeCurrency, expenses, goals }),
            priceSource: { provider: 'Channel3' as const, domain: quote.domain, stores: quote.stores, quotedPrice: quote.price, quotedCurrency: quote.currency, productId: quote.productId, title: quote.title, imageUrl: quote.imageUrl },
          };
          const priceText = formatWholeCurrency(price, activeCurrency, activeCurrency);
          const where = quote.stores > 1 ? `the lowest in-stock price I found across ${quote.stores} stores` : 'the in-stock price I found';
          const intro = `${name} is about ${priceText} at ${quote.domain}, ${where}.`;
          kovaMsg = {
            ...base,
            text: isThinCard(card)
              ? `${intro} Here's this month so far. Once you've logged a month or two, I can show how it affects your goals too.`
              : `${intro} Here's how it fits, so you can decide.`,
            affordCard: card,
            quickReplies: ['I bought it, log it', "I'll wait", 'Use a different price'],
          };
        } else if (!parsed) {
          pendingAffordRef.current = { item };
          kovaMsg = { ...base, text: item === 'it' ? 'How much is it?' : `How much is the ${item}?` };
        } else {
          const price =
            parsed.currency && parsed.currency !== activeCurrency
              ? convertCurrency(parsed.amount, parsed.currency, activeCurrency)
              : parsed.amount;
          const card = buildAffordCard({ item, price, currency: activeCurrency, expenses, goals });
          const priceText = formatWholeCurrency(price, activeCurrency, activeCurrency);
          const intro = item === 'it' ? `That's ${priceText}.` : `That's ${priceText} for ${item}.`;
          kovaMsg = {
            ...base,
            text: isThinCard(card)
              ? `${intro} Here's this month so far. Once you've logged a month or two, I can show how it affects your goals too.`
              : `${intro} Here's how it fits, so you can decide.`,
            affordCard: card,
            quickReplies: ['I bought it, log it', "I'll wait"],
          };
        }
        setIsSending(false);
        setMessages((prev) => {
          const next = [...prev, kovaMsg];
          if (currentUser) updateUserMessages(currentUser.uid, next);
          return next;
        });
        return;
      }

      // The quoted price isn't what they'd pay: ask for theirs and redo the card (KOVA-101).
      if (lower === 'use a different price') {
        const lastAsk = [...messages].reverse().find((m) => m.affordCard)?.affordCard;
        if (lastAsk) {
          setIsSending(false);
          pendingAffordRef.current = { item: lastAsk.item };
          const kovaMsg: ChatMessage = {
            id: generateUniqueId('msg'),
            sender: 'kova',
            text: `Sure. How much is the ${lastAsk.item} where you'd buy it?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: Date.now(),
          };
          setMessages((prev) => {
            const next = [...prev, kovaMsg];
            if (currentUser) updateUserMessages(currentUser.uid, next);
            return next;
          });
          return;
        }
      }

      if (lower === 'i bought it, log it') {
        const lastAsk = [...messages].reverse().find((m) => m.affordCard)?.affordCard;
        if (lastAsk) {
          setIsSending(false);
          const label = lastAsk.item === 'it' ? 'Purchase' : lastAsk.item.charAt(0).toUpperCase() + lastAsk.item.slice(1);
          // Logs in one tap; handleAddExpense posts the usual "Logged …" confirmation.
          await handleAddExpense({
            label,
            category: localCategory(lastAsk.item, 'out') as ExpenseCategory,
            amount: lastAsk.price,
            type: 'outcome',
            timestamp: new Date().toISOString(),
            nativeCurrency: lastAsk.currency,
          });
          return;
        }
      }

      if (lower === "i'll wait") {
        setIsSending(false);
        // A product Kova priced: offer to watch its price while they wait (KOVA-102).
        const lastAsk = [...messages].reverse().find((m) => m.affordCard)?.affordCard;
        const src = lastAsk?.priceSource;
        let text = "Okay. A day or two often makes the choice clearer. Ask me again anytime.";
        let watchCard: ChatMessage['priceWatch'];
        if (lastAsk && src?.productId) {
          const watched = await watchPrice({ productId: src.productId, title: src.title || lastAsk.item, price: src.quotedPrice, currency: src.quotedCurrency, domain: src.domain, imageUrl: src.imageUrl });
          if (watched === 'ok') {
            // The card below names the product, so the sentence stays short (KOVA-103).
            text = "Okay. I'll keep an eye on the price for you and tell you here if it drops. A day or two often makes the choice clearer.";
            watchCard = {
              title: lastAsk.item,
              price: src.quotedPrice,
              currency: src.quotedCurrency,
              domain: src.domain,
              ...(src.imageUrl ? { imageUrl: src.imageUrl } : {}),
              until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            };
          } else if (watched === 'limit') {
            text = "Okay. I'm already watching the most prices I can for you, so I won't track this one. A day or two often makes the choice clearer.";
          }
        }
        const kovaMsg: ChatMessage = {
          id: generateUniqueId('msg'),
          sender: 'kova',
          text,
          ...(watchCard ? { priceWatch: watchCard } : {}),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: Date.now(),
          quickReplies: ['How am I doing this month?'],
        };
        setMessages((prev) => {
          const next = [...prev, kovaMsg];
          if (currentUser) updateUserMessages(currentUser.uid, next);
          return next;
        });
        return;
      }

      // Subscription radar (KOVA-086): from the user's own logs, with no AI call and no reply counted.
      if (isSubscriptionRadarRequest(lower)) {
        setIsSending(false);
        const subs = findSubscriptions(expenses, activeCurrency, subscriptionNotes);
        if (subs.length === 0) {
          postKovaMessage({
            text: "I haven't spotted any repeating payments yet. When the same charge shows up a couple of months in a row, or you log something under Subscriptions, it'll appear here. Importing a statement finds them fastest.",
            quickReplies: ['Import a statement'],
          });
        } else {
          postKovaMessage({
            text:
              subs.length === 1
                ? "Here's the repeating payment I've found."
                : `Here are the ${subs.length} repeating payments I've found, soonest first.`,
            radarCard: buildRadarCard(subs, activeCurrency),
            quickReplies: ['View Log overview'],
          });
        }
        return;
      }

      // Answers to the radar's questions: "Keep Netflix", "Cancel Netflix", "Netflix isn't a subscription",
      // "Yes, log Netflix", "No, Netflix stopped". Unknown names fall through to the normal chat.
      const radarReply =
        text.match(/^(keep|cancel) (.+?)\.?$/i) ||
        text.match(/^(yes, log|no,) (.+?)(?: stopped)?\.?$/i) ||
        text.match(/^(.+?) (isn't|is not) a subscription\.?$/i);
      if (radarReply) {
        const subs = findSubscriptions(expenses, activeCurrency, subscriptionNotes);
        const notSub = /a subscription\.?$/i.test(text);
        const sub = findByName(subs, notSub ? radarReply[1] : radarReply[2]);
        const action = notSub ? 'not' : radarReply[1].toLowerCase();
        if (sub && !(action === 'no,' && !/stopped\.?$/i.test(text))) {
          setIsSending(false);
          const decidedAt = new Date().toISOString();
          if (action === 'keep') {
            saveSubscriptionNote(sub.key, { status: 'kept', decidedAt });
            postKovaMessage({ text: `Okay, keeping ${sub.name}. It stays on your radar, and I won't remind you about it again.`, quickReplies: ['Show my subscriptions'] });
          } else if (action === 'cancel') {
            saveSubscriptionNote(sub.key, { status: 'cancelling', decidedAt });
            const money = (n: number) => formatWholeCurrency(n, activeCurrency, activeCurrency);
            const goals = savingsGoals.length > 0 ? savingsGoals : savingsGoal ? [savingsGoal] : [];
            postKovaMessage({
              text: `Okay. Cancel it where you signed up: ${sub.name}'s account settings, or your phone's app store subscriptions if you subscribed there. ${cancelSavingsText(sub, activeCurrency, goals, money)} If it charges again, I'll ask.`,
              quickReplies: ['Show my subscriptions'],
            });
          } else if (action === 'not') {
            saveSubscriptionNote(sub.key, { status: 'not_subscription', decidedAt });
            postKovaMessage({ text: `Got it. I'll stop treating ${sub.name} as a subscription.` });
          } else if (action === 'yes, log') {
            saveSubscriptionNote(sub.key, { askedRenewedFor: sub.nextDate });
            await handleAddExpense({
              label: sub.name,
              category: 'Subscriptions',
              amount: sub.amount,
              type: 'outcome',
              timestamp: new Date().toISOString(),
              nativeCurrency: activeCurrency,
            });
          } else {
            saveSubscriptionNote(sub.key, { status: 'stopped', decidedAt });
            postKovaMessage({ text: `Okay, ${sub.name} is off your radar. If it charges again, it'll come back.` });
          }
          return;
        }
      }

      // 1. Check if user is responding to next steps after goal completion
    if (lower === 'set a new goal') {
      setIsSending(false);
      handleOpenAddNewGoal();
      const kovaMsg: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'kova',
        text: `Let's set your next milestone! I've opened the goal editor so you can define your new title and target amount.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['Log an expense', 'Read monthly letter'],
      };
      setMessages((prev) => {
        const next = [...prev, kovaMsg];
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
        return next;
      });
      return;
    }

    if (lower === 'keep saving past this') {
      setIsSending(false);
      const kovaMsg: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'kova',
        text: `Understood! We'll keep tracking your ongoing balance for ${savingsGoal?.title || 'your goal'} as you add more over time.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['How am I doing on spending?', 'Log an expense', 'Read monthly letter'],
      };
      setMessages((prev) => {
        const next = [...prev, kovaMsg];
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
        return next;
      });
      return;
    }

    if (lower === 'leave it as-is') {
      setIsSending(false);
      const kovaMsg: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'kova',
        text: `Your completed milestone remains recorded in your Grow tab timeline. Excellent progress!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['Log an expense', 'Read monthly letter'],
      };
      setMessages((prev) => {
        const next = [...prev, kovaMsg];
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
        return next;
      });
      return;
    }

    // 2. Check if user is skipping setting a target amount
    if (
      lower === 'skip for now' ||
      lower === 'skip' ||
      lower === 'skip target' ||
      lower.startsWith('skip for')
    ) {
      setIsSending(false);
      const title = savingsGoal?.title || userProfile?.workingGoal || 'your goal';
      const kovaMsg: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'kova',
        text: `No problem at all! We'll keep ${title} open without a target amount for now. You can set one whenever you're ready by tapping the card above or letting me know in chat. What would you like to explore or log today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['Log an expense', 'Read monthly letter', 'Explore Grow topics'],
      };
      setMessages((prev) => {
        const next = [...prev, kovaMsg];
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
        return next;
      });
      return;
    }

    // 3. Check if setting/updating target amount (when targetAmount === 0 or user says "set target $1000")
    const numMatch = text.match(/\$?\s*([0-9,]+(\.[0-9]{1,2})?)/);
    const parsedNum = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 0;

    const isSettingTarget =
      (!savingsGoal || savingsGoal.targetAmount === 0) && parsedNum > 0 && !lower.includes('spent') && !lower.includes('log');

    if (isSettingTarget) {
      setIsSending(false);
      const newTarget = parsedNum;
      const title = savingsGoal?.title || userProfile?.workingGoal || 'Savings Goal';
      const updated: SavingsGoal = {
        id: savingsGoal?.id || generateUniqueId('goal'),
        title,
        targetAmount: newTarget,
        currentAmount: savingsGoal?.currentAmount || 0,
        nativeCurrency: activeCurrency,
        status: (savingsGoal?.currentAmount || 0) >= newTarget ? 'achieved' : 'active',
        isArchived: false,
      };

      setSavingsGoal(updated);
      setSavingsGoals((prev) => {
        const idx = prev.findIndex((g) => g.id === updated.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [updated, ...prev];
      });

      if (currentUser) {
        await updateUserSavingsGoal(currentUser.uid, updated);
        await updateUserSavingsGoals(currentUser.uid, [updated]);
      }

      const kovaMsg: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'kova',
        text: `Got it — aiming for ${formatWholeCurrency(newTarget, activeCurrency, activeCurrency)} for your ${title}. I've set up your goal progress ring above. Every time you log income or allocate funds, we'll watch your progress ring grow.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: [`Put ${formatWholeCurrency(100, activeCurrency)} toward ${title}`, 'Log an expense', 'Read monthly letter'],
      };

      setMessages((prev) => {
        const next = [...prev, kovaMsg];
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
        return next;
      });
      return;
    }

    // 4. Check allocating funds ("Put $50 toward...", "put this toward my trip", "put $100 toward trip")
    const activeGoalsForAlloc = savingsGoals.length > 0
      ? savingsGoals.filter((g) => !g.isArchived)
      : savingsGoal && !savingsGoal.isArchived
      ? [savingsGoal]
      : [];

    // A goal counts as mentioned only if its title is real text (a blank title used to match every message).
    const goalMentioned = (g: SavingsGoal) => {
      const t = (g.title || '').trim().toLowerCase();
      return t.length > 2 && lower.includes(t);
    };

    // "Just log $X as income" (quick reply after logging income): keep it as income only. No goal
    // change, and no AI call that could log the same income again (item 11b).
    if (/\bjust log\b/.test(lower) && /\bas income\b/.test(lower)) {
      setIsSending(false);
      const kovaMsg: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'kova',
        text: 'Done. It stays logged as income, and your goals are unchanged.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['View Log overview', 'How is my savings goal?'],
      };
      setMessages((prev) => {
        const next = [...prev, kovaMsg];
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
        return next;
      });
      return;
    }

    // Explicit allocation only: "put/add/move/allocate/transfer/save X toward(s) / into / to my <goal|fund>".
    // The old check matched any message containing "put", "add" or "save" plus "fund"/"trip"/a goal title
    // (e.g. "computer" contains "put").
    const isAllocating =
      /\b(put|add|move|allocate|transfer|save)\b/.test(lower) &&
      (/\btowards?\b/.test(lower) ||
        /\b(in|into|to)\s+(my\s+)?(goal|fund|savings)\b/.test(lower) ||
        activeGoalsForAlloc.some(goalMentioned));

    if (isAllocating && parsedNum > 0 && activeGoalsForAlloc.length > 0) {
      setIsSending(false);
      const targetGoal = activeGoalsForAlloc.find(goalMentioned) || activeGoalsForAlloc[0];
      await handleAllocateToGoal(targetGoal, parsedNum, { messages, setMessages });
      return;
    }

    // 5. Check withdrawing funds ("take $50 out of my trip fund", "withdraw $50 from my goal")
    const isWithdrawing =
      /\b(take|withdraw|remove|subtract)\b/.test(lower) &&
      /\b(out of|from)\b/.test(lower) &&
      (/\b(goal|fund|savings)\b/.test(lower) || activeGoalsForAlloc.some(goalMentioned));

    if (isWithdrawing && parsedNum > 0 && activeGoalsForAlloc.length > 0) {
      setIsSending(false);
      const targetGoal = activeGoalsForAlloc.find(goalMentioned) || activeGoalsForAlloc[0];
      await handleWithdrawFromGoal(targetGoal, parsedNum, { messages, setMessages });
      return;
    }
  }

    // Standard AI Chat Call with real-time SSE streaming
    try {
      const res = await fetchWithAuth('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-15),
          expenses,
          userProfile,
          savingsGoal,
          savingsGoals,
          currency: activeCurrency,
          currencySymbol: getCurrencySymbol(activeCurrency),
          stream: true,
          type: options?.type || 'chat',
          context: options?.context,
        }),
      });

      if (!res.ok || !res.body) {
        // Rate limit (429) or a plan limit: show the server's calm message as Kova's reply.
        const errData = await res.json().catch(() => null);
        if ((res.status === 429 || res.status === 403) && errData?.error) {
          const limitMsg: ChatMessage = {
            id: generateUniqueId('msg'),
            sender: 'kova',
            text: errData.error,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            quickReplies:
              plan === 'premium' ? ['Log an expense', 'View Log overview'] : ['See Premium', 'Log an expense', 'View Log overview'],
          };
          setMessages((prev) => [...prev, limitMsg]);
          return;
        }
        throw new Error('Chat response was not ok');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedReply = '';
      const kovaMsgId = generateUniqueId('msg');
      let finalExtractedExpense: any = null;
      let finalQuickReplies: string[] = ['How am I doing on spending?', 'Read monthly letter'];

      // Insert initial streaming message bubble
      setMessages((prev) => [
        ...prev,
        {
          id: kovaMsgId,
          sender: 'kova',
          text: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: [],
        },
      ]);

      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              try {
                const payload = JSON.parse(dataStr);
                if (payload.type === 'chunk') {
                  accumulatedReply += payload.text;
                  const displayChunk = accumulatedReply.replace(/```json[\s\S]*$/, '').trim();
                  if (displayChunk) {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === kovaMsgId ? { ...m, text: displayChunk } : m))
                    );
                  }
                } else if (payload.type === 'done') {
                  if (payload.reply) accumulatedReply = payload.reply;
                  if (payload.quickReplies) finalQuickReplies = payload.quickReplies;
                  if (payload.extractedExpense) finalExtractedExpense = payload.extractedExpense;
                  if (payload.usage) noteUsage('chat', payload.usage);
                }
              } catch (e) {
                // Ignore parse errors on partial frames
              }
            }
          }
        }
      }

      const cleanFinalText = accumulatedReply.replace(/```json\s*[\s\S]*?\s*```/, '').trim() || "I've noted that for you.";

      // A reply about categories ("explain my categories and what you think") also gets the
      // "Where October went" card, so the numbers are visible, not just described (KOVA-082).
      const categoryCard = /categor/i.test(text) ? buildCategoryBreakdownCard(expenses, activeCurrency) : null;
      const finalKovaMsg: ChatMessage = {
        id: kovaMsgId,
        sender: 'kova',
        text: cleanFinalText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: finalQuickReplies,
        extractedExpense: finalExtractedExpense || undefined,
        ...(categoryCard && categoryCard.rows.length > 0 ? { categoryBreakdown: categoryCard } : {}),
      };

      setMessages((prev) => {
        const next = prev.map((m) => (m.id === kovaMsgId ? finalKovaMsg : m));
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
        return next;
      });

      // Automatically add expense if detected by AI (only for regular logging, never for explore queries)
      if (!isExplore && finalExtractedExpense && finalExtractedExpense.amount) {
        const logged = await processAiExtractedExpense(finalExtractedExpense);
        await applyDebtRepaymentToGoal(logged, text);
      }
    } catch (err) {
      console.error('Chat error:', err);
      toast.error("Couldn't reach Kova — check your connection");
      const fallbackReply: ChatMessage = {
        id: generateUniqueId('msg'),
        sender: 'kova',
        text: "I've noted that for you. Let me know if you'd like to adjust any details.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['Show my spending log', 'Read monthly letter'],
      };
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.text.length > 0);
        const next = [...filtered, fallbackReply];
        if (currentUser) {
          updateUserMessages(currentUser.uid, next);
        }
        return next;
      });
    } finally {
      setIsSending(false);
    }
  };

  // Add expense manually
  /**
   * A debt-repayment expense also counts as progress on the user's debt goal (item 11). It stays
   * real spending in the Log; the goal just moves forward. Applied when exactly one active debt goal
   * exists, or when the message names one. Silent (no chat message), so it can't race the AI reply.
   */
  const applyDebtRepaymentToGoal = async (logged: Expense | null | undefined, sourceText = '') => {
    if (!logged || !isDebtRepayment(logged)) return;
    const debtGoals = (savingsGoals.length > 0 ? savingsGoals : savingsGoal ? [savingsGoal] : []).filter(
      (g) => !g.isArchived && isDebtGoal(g)
    );
    const lowerText = sourceText.toLowerCase();
    const named = debtGoals.find((g) => (g.title || '').trim().length > 2 && lowerText.includes(g.title.toLowerCase()));
    const target = named || (debtGoals.length === 1 ? debtGoals[0] : null);
    if (!target) return;
    const amountInGoalCurrency = convertCurrency(
      logged.amount,
      logged.nativeCurrency || activeCurrency,
      target.nativeCurrency || activeCurrency
    );
    await handleAllocateToGoal(target, Math.round(amountInGoalCurrency * 100) / 100);
  };

  const handleAddExpense = async (newExp: Omit<Expense, 'id'>) => {
    const fullExpense = await addExpense(newExp);
    await applyDebtRepaymentToGoal(fullExpense);
    const updatedExpenses = [fullExpense, ...expenses.filter((e) => e.id !== fullExpense.id)];

    triggerGrowthMarkCheck(updatedExpenses, savingsGoal);

    // If income is logged and a goal exists, prompt quick reply allocation
    const activeGoalsList = savingsGoals.length > 0
      ? savingsGoals.filter((g) => !g.isArchived)
      : savingsGoal && !savingsGoal.isArchived
      ? [savingsGoal]
      : [];

    const hasActiveGoals = activeGoalsList.length > 0;

    // Amounts in the user's currency (item 9); was a hardcoded "$" with raw numbers like $4745775.00.
    const loggedAmount = formatCurrency(newExp.amount, activeCurrency, newExp.nativeCurrency || activeCurrency);
    const wholeAmount = formatWholeCurrency(newExp.amount, activeCurrency, newExp.nativeCurrency || activeCurrency);
    let kovaMessageText = `Logged ${loggedAmount} for ${newExp.label}. I've updated your rhythm accordingly.`;
    let quickReplies = ['View Log overview', 'How is my savings goal?'];

    if (newExp.type === 'income' && hasActiveGoals) {
      if (activeGoalsList.length === 1) {
        const primaryG = activeGoalsList[0];
        kovaMessageText = `Logged ${loggedAmount} income for ${newExp.label}. Would you like to put this toward your ${primaryG.title} goal, or just log it as income?`;
        quickReplies = [
          `Put ${wholeAmount} toward ${primaryG.title}`,
          `Just log ${wholeAmount} as income`,
        ];
      } else {
        kovaMessageText = `Logged ${loggedAmount} income for ${newExp.label}. Which goal would you like to allocate this toward?`;
        quickReplies = [
          ...activeGoalsList.map((g) => `Put ${wholeAmount} toward ${g.title}`),
          `Just log ${wholeAmount} as income`,
        ];
      }
    }

    // Kova confirmation message in chat
    const kovaMessage: ChatMessage = {
      id: generateUniqueId('msg'),
      sender: 'kova',
      text: kovaMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies,
    };
    const updatedMsgs = [...messages, kovaMessage];
    setMessages(updatedMsgs);
    if (currentUser) {
      updateUserMessages(currentUser.uid, updatedMsgs);
    }
  };

  // Delete expense
  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(id);
  };

  // Update expense (editing an existing entry)
  const handleUpdateExpense = async (updatedExp: Expense) => {
    await updateExpense(updatedExp);
  };

  // Bulk import CSV expenses
  const handleImportExpenses = async (newExpenses: Expense[], info?: { source: 'paypal' | 'bank' | 'ai'; insight: string }) => {
    await bulkAddExpenses(newExpenses);
    const updated = [...newExpenses, ...expenses];

    triggerGrowthMarkCheck(updated, savingsGoal);

    const kovaMsg: ChatMessage = {
      id: generateUniqueId('msg'),
      sender: 'kova',
      // Facts from the import itself (KOVA-081): recurring charges and unfamiliar names, no AI call.
      text:
        `Imported ${newExpenses.length} ${newExpenses.length === 1 ? 'transaction' : 'transactions'} from your ${info?.source === 'paypal' ? 'PayPal' : ''} statement.`.replace('your  statement', 'your statement') +
        (info?.insight ? ` I noticed ${info.insight}.` : ''),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies: ['Show all categories', 'View Log overview'],
    };
    setMessages((prev) => {
      const next = [...prev, kovaMsg];
      if (currentUser) {
        updateUserMessages(currentUser.uid, next);
      }
      return next;
    });
  };

  // Handle Topic Exploration from Grow screen
  const handleExploreTopic = (topic: string, category?: string) => {
    // 1. Mark explored
    const nextExplored = Array.from(new Set([...exploredTopics, topic]));
    setExploredTopics(nextExplored);
    if (currentUser) {
      updateUserExploredTopics(currentUser.uid, nextExplored);
    }

    // 2. Switch active view/tab to Chat
    setCurrentView('chat');

    // 3. Dispatch the topic as an actual user message with explicit intent metadata
    handleSendMessage(topic, {
      type: 'explore_query',
      context: category ? `Topic from category "${category}": "${topic}"` : `Explore topic: "${topic}"`,
    });
  };

  // Regenerate Monthly Briefing Letter with AI
  const handleRegenerateLetter = async () => {
    setIsRegeneratingLetter(true);
    const now = new Date();
    const currentMonthName = now.toLocaleDateString('en-US', { month: 'long' });
    const currentYear = now.getFullYear();

    try {
      const res = await fetchWithAuth('/api/monthly-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses,
          savingsGoal,
          savingsGoals, // all goals, for the letter's server-computed snapshot (item 7)
          month: currentMonthName,
          year: currentYear,
          userProfile,
          currency: activeCurrency,
          currencySymbol: getCurrencySymbol(activeCurrency),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Plan limit on letters (429): a calm explanation, not a connection error.
        toast.info(data?.error || "Couldn't generate the letter right now.");
        return;
      }
      if (data.letter) {
        setMonthlyLetter(data.letter);
        toast.success('Monthly letter generated');
        setNotification({
          id: generateUniqueId('notif'),
          sender: 'Kova',
          timeAgo: 'from Kova · month-end',
          previewText: `Your ${data.letter.month} letter is ready — "${data.letter.headline}"`,
          active: true,
        });

        const currentUser = auth.currentUser;
        if (currentUser) {
          const yearMonth = `${data.letter.year || currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          await saveMonthlyLetter(currentUser.uid, yearMonth, data.letter);
        }
      }
    } catch (err) {
      console.error('Failed to regenerate letter', err);
      toast.error("Couldn't generate letter — check your connection");
    } finally {
      setIsRegeneratingLetter(false);
    }
  };

  // 0. Initial Auth Initialization Loading View
  if (isAuthInitializing) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans select-none">
        <KovaAvatar size="lg" isPulsing={true} />
        <div className="mt-4 flex items-center gap-2 text-xs text-kova-muted font-medium tracking-tight">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
          <span>Connecting to Kova...</span>
        </div>
        <button
          type="button"
          onClick={() => setCurrentView('landing')}
          className="mt-6 text-[11px] text-kova-muted hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
        >
          Taking longer than usual? Continue to app →
        </button>
      </div>
    );
  }

  // 1. Landing Page View. The Android app opens on a single welcome screen; the web keeps the
  // marketing landing page (KOVA-096).
  if (currentView === 'landing' && Capacitor.isNativePlatform()) {
    return (
      <WelcomeScreen
        onGetStarted={() => {
          setAuthInitialMode('signup');
          setCurrentView('auth');
        }}
        onLogin={() => {
          setAuthInitialMode('login');
          setCurrentView('auth');
        }}
      />
    );
  }
  if (currentView === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => {
          setAuthInitialMode('signup');
          setCurrentView('auth');
        }}
        onLogin={() => {
          setAuthInitialMode('login');
          setCurrentView('auth');
        }}
        onOpenAbout={() => {
          setCurrentView('about');
        }}
      />
    );
  }

  // Pre-auth About screen view if user visits from landing page
  if (currentView === 'about' && !currentUser) {
    return (
      <AboutScreen
        onBack={() => setCurrentView('landing')}
        onSelectView={(view) => {
          if (view === 'chat' || view === 'grow') {
            setAuthInitialMode('signup');
            setCurrentView('auth');
          } else {
            setCurrentView(view);
          }
        }}
      />
    );
  }

  // 2. Auth Screen (Login / Sign Up) View
  if (currentView === 'auth') {
    return (
      <AuthScreen
        initialMode={authInitialMode}
        onBackToLanding={() => {
          setCurrentView('landing');
        }}
      />
    );
  }

  // 3. Onboarding Quiz View
  if (currentView === 'quiz') {
    if (userProfile?.isCompletedOnboarding || expenses.length > 0 || savingsGoals.length > 0) {
      return null;
    }
    return (
      <OnboardingQuizScreen
        userFirstName={tempAuthUser?.firstName || userProfile?.firstName || 'Friend'}
        userEmail={tempAuthUser?.email || userProfile?.email || ''}
        onCompleteQuiz={handleCompleteQuiz}
      />
    );
  }

  // Main App Views (Chat, Log, Letter, Settings)
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black flex flex-col antialiased">
      {/* App Top Navigation Bar */}
      <Header
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenAddExpense={openAddExpense}
        onToggleNotification={() => setNotification((prev) => ({ ...prev, active: !prev.active }))}
        notificationActive={notification.active}
        userName={userProfile?.firstName}
        onLogout={handleLogout}
      />

      {/* Lock-Screen Notification Banner */}
      <NotificationBanner
        notification={notification}
        onOpenLetter={() => {
          setCurrentView('letter');
          setNotification((prev) => ({ ...prev, active: false }));
        }}
        onDismiss={() => setNotification((prev) => ({ ...prev, active: false }))}
        onDownloadReport={() => {
          downloadMonthlyReportPdf(
            monthlyLetter,
            userProfile?.firstName || 'Friend',
            userProfile?.workingGoal || 'Financial Clarity'
          );
        }}
      />

      {/* Primary Screen Views */}
      <main className="flex-1 w-full relative overflow-x-hidden">
        {currentView === 'chat' && (
          <ErrorBoundary sectionName="Chat Screen">
            <ChatScreen
              messages={messages}
              onSendMessage={handleSendMessage}
              onSelectView={setCurrentView}
              onOpenCsvImport={openCsvImport}
              onOpenVoiceNote={openVoiceNote}
              isSending={isSending}
              savingsGoal={savingsGoal}
              savingsGoals={savingsGoals}
              onEditGoal={handleOpenEditGoal}
              onAddNewGoal={handleOpenAddNewGoal}
              onOpenCoach={handleOpenCoach}
              onSavePayPalCheckin={handleSavePayPalCheckin}
            />
          </ErrorBoundary>
        )}

        {currentView === 'goal-coaching' && activeCoachingGoal && (
          <ErrorBoundary sectionName="Goal Coaching Screen">
            <GoalCoachingScreen
              goal={activeCoachingGoal}
              userProfile={userProfile}
              messages={coachingMessages}
              onSendMessage={handleSendCoachingMessage}
              onBack={() => setCurrentView('chat')}
              isSending={isCoachingSending}
            />
          </ErrorBoundary>
        )}

        {currentView === 'log' && (
          <ErrorBoundary sectionName="Spending Log">
            <LogScreen
              expenses={expenses}
              onOpenAddExpense={openAddExpense}
              onSelectView={setCurrentView}
              onDeleteExpense={handleDeleteExpense}
              onUpdateExpense={handleUpdateExpense}
              userProfile={userProfile}
              onUpgradePlan={() => handleUpdatePlan('premium')}
              onOpenUpgradeModal={openPremiumUpgrade}
            />
          </ErrorBoundary>
        )}

        {currentView === 'grow' && (
          <ErrorBoundary sectionName="Grow & Insights">
            <GrowScreen
              userProfile={userProfile}
              monthlyLetter={monthlyLetter}
              onSelectView={(v) => {
                setOpenArchiveDirectly(false);
                setCurrentView(v);
              }}
              expensesCount={expenses.length}
              growthMarks={growthMarks}
              savingsGoal={savingsGoal}
              exploredTopics={exploredTopics}
              onExploreTopic={handleExploreTopic}
              onOpenArchive={handleOpenArchive}
            />
          </ErrorBoundary>
        )}

        {currentView === 'letter' && (
          <ErrorBoundary sectionName="Monthly Letter">
            <MonthlyLetterScreen
              letter={monthlyLetter}
              onSelectView={(v) => {
                setOpenArchiveDirectly(false);
                setCurrentView(v);
              }}
              onRegenerateLetter={handleRegenerateLetter}
              isRegenerating={isRegeneratingLetter}
              userProfile={userProfile}
              userUid={auth.currentUser?.uid}
              onUpgradePlan={() => handleUpdatePlan('premium')}
              onOpenUpgradeModal={openPremiumUpgrade}
              openArchiveDirectly={openArchiveDirectly}
            />
          </ErrorBoundary>
        )}

        {currentView === 'settings' && (
          <ErrorBoundary sectionName="Settings">
            <SettingsScreen
              userProfile={userProfile}
              onUpdateTone={handleUpdateTone}
              notifications={notificationSettings}
              onToggleNotification={handleToggleNotificationSetting}
              onLogout={handleLogout}
              onBack={() => setCurrentView('chat')}
              onNavigateToAbout={() => setCurrentView('about')}
              onNavigateToGuide={() => setCurrentView('guide')}
              expenses={expenses}
              messages={messages}
              monthlyLetter={monthlyLetter}
              onDeleteAccount={handleDeleteAccount}
              onUpdatePlan={handleUpdatePlan}
              onRegenerateLetter={handleRegenerateLetter}
              isRegeneratingLetter={isRegeneratingLetter}
            />
          </ErrorBoundary>
        )}

        {currentView === 'about' && (
          <ErrorBoundary sectionName="About Kova">
            <AboutScreen
              onBack={() => setCurrentView('settings')}
              onSelectView={setCurrentView}
            />
          </ErrorBoundary>
        )}

        {currentView === 'guide' && (
          <ErrorBoundary sectionName="User Guide">
            <HowToUseScreen
              onBack={() => setCurrentView('settings')}
              onSelectView={setCurrentView}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Interactive Modals */}
      <ErrorBoundary sectionName="Add Expense Dialog">
        <AddExpenseModal onAddExpense={handleAddExpense} />
      </ErrorBoundary>
      <ErrorBoundary sectionName="CSV Import Dialog">
        <CsvImportModal onImportExpenses={handleImportExpenses} onUpgrade={() => handleUpdatePlan('premium')} />
      </ErrorBoundary>
      <ErrorBoundary sectionName="Voice Note Dialog">
        <VoiceNoteModal onSendVoiceNote={handleSendMessage} />
      </ErrorBoundary>
      <ErrorBoundary sectionName="Goal Settings Dialog">
        <EditGoalModal
          onSaveGoal={handleSaveGoal}
          onArchiveGoal={handleArchiveGoal}
          onUpgradePlan={() => handleUpdatePlan('premium')}
        />
      </ErrorBoundary>
      <ErrorBoundary sectionName="Upgrade Dialog">
        <PremiumUpgradeModal
          onUpgrade={async () => {
            if (!(await updatePlan('premium'))) return;
            setOpenArchiveDirectly(true);
            setCurrentView('letter');
          }}
        />
      </ErrorBoundary>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('landing');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  // Every message that enters the chat is stamped with a real creation time (createdAt),
  // which is what the day labels ("Today", "Yesterday") and the ordering are based on.
  const setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>> = useCallback((update) => {
    setMessagesState((prev) =>
      stampNewMessages(
        typeof update === 'function' ? (update as (p: ChatMessage[]) => ChatMessage[])(prev) : update,
        prev
      )
    );
  }, []);
  const [monthlyLetter, setMonthlyLetter] = useState<MonthlyLetter | null>(null);
  const [notification, setNotification] = useState<NotificationType>({
    id: 'notif-1',
    sender: 'Kova',
    timeAgo: '',
    previewText: '',
    active: false,
  });
  const [notificationSettings, setNotificationSettings] = useState({
    monthlyLetter: true,
    dailyGrow: true,
  });
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [growthMarks, setGrowthMarks] = useState<GrowthMark[]>([]);
  const [exploredTopics, setExploredTopics] = useState<string[]>([]);
  const [subscriptionNotes, setSubscriptionNotes] = useState<Record<string, SubscriptionNote>>({});

  const handleUserDataLoaded = useCallback(async (userDoc: UserDocument, isReturning: boolean) => {
    adoptAccountTheme(userDoc.appearance?.theme); // Settings → Appearance, saved on the account
    if (isReturning && userDoc.profile) {
      const rawExpenses = userDoc.expenses || [];
      const sanitizedExpenses = rawExpenses.filter(
        (e) => !(e.amount === 100 && (e.label.toLowerCase().includes('other entry') || e.label.toLowerCase().includes('investing')))
      );
      if (sanitizedExpenses.length !== rawExpenses.length && auth.currentUser) {
        updateUserExpenses(auth.currentUser.uid, sanitizedExpenses);
      }
      setExpenses(sanitizedExpenses);

      if (userDoc.notifications) {
        setNotificationSettings(userDoc.notifications);
      }
      if (userDoc.exploredTopics && Array.isArray(userDoc.exploredTopics)) {
        setExploredTopics(userDoc.exploredTopics);
      } else {
        setExploredTopics([]);
      }
      setSubscriptionNotes(
        userDoc.subscriptionNotes && typeof userDoc.subscriptionNotes === 'object' ? userDoc.subscriptionNotes : {}
      );
      if (userDoc.savingsGoals && userDoc.savingsGoals.length > 0) {
        setSavingsGoals(userDoc.savingsGoals);
        const primaryG = userDoc.savingsGoals.find((g) => !g.isArchived) || null;
        setSavingsGoal(primaryG);
      } else if (userDoc.savingsGoal) {
        setSavingsGoals([userDoc.savingsGoal]);
        setSavingsGoal(userDoc.savingsGoal.isArchived ? null : userDoc.savingsGoal);
      } else if (userDoc.profile.workingGoal) {
        const initG: SavingsGoal = {
          id: `goal-${Date.now()}`,
          title: userDoc.profile.workingGoal,
          targetAmount: 0,
          currentAmount: 0,
          status: 'active',
          isArchived: false,
        };
        setSavingsGoals([initG]);
        setSavingsGoal(initG);
      }
      if (userDoc.growthMarks && userDoc.growthMarks.length > 0) {
        setGrowthMarks(userDoc.growthMarks);
      }

      if (auth.currentUser) {
        const latestLetter = await getLatestMonthlyLetter(auth.currentUser.uid);
        if (latestLetter) {
          setMonthlyLetter(latestLetter);
          setNotification({
            id: `notif-${Date.now()}`,
            sender: 'Kova',
            timeAgo: 'from Kova · month-end',
            previewText: `Your ${latestLetter.month} letter is ready — "${latestLetter.headline}"`,
            active: true,
          });
        } else {
          setMonthlyLetter(null);
          setNotification({
            id: 'notif-1',
            sender: 'Kova',
            timeAgo: '',
            previewText: '',
            active: false,
          });
        }
      }

      if (userDoc.messages && userDoc.messages.length > 0) {
        setMessages((currentMsgs) => {
          if (currentMsgs.length === 0) return userDoc.messages;
          return mergeChatMessages(currentMsgs, userDoc.messages);
        });
      } else {
        const welcomeMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          sender: 'kova',
          text: `Welcome back, ${userDoc.profile.firstName}. Ready to check in on your financial rhythm today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: ['How am I doing on spending?', 'Log an expense', 'How is my savings goal?'],
        };
        setMessages((current) => (current.length === 0 ? [welcomeMsg] : current));
      }
    } else {
      setExpenses([]);
      setMessages([]);
      setMonthlyLetter(null);
      setSavingsGoals([]);
      setSavingsGoal(null);
      setGrowthMarks([]);
      setExploredTopics([]);
      setSubscriptionNotes({});
    }
  }, []);

  const handleUserLoggedOut = useCallback(() => {
    setExpenses([]);
    setMessages([]);
    setMonthlyLetter(null);
    setSavingsGoals([]);
    setSavingsGoal(null);
    setGrowthMarks([]);
    setExploredTopics([]);
    setSubscriptionNotes({});
  }, []);

  const handleNavigate = useCallback((view: ViewMode) => {
    setCurrentView(view);
  }, []);

  return (
    <AuthProvider
      onNavigate={handleNavigate}
      onUserDataLoaded={handleUserDataLoaded}
      onUserLoggedOut={handleUserLoggedOut}
    >
      <ExpenseProvider initialExpenses={expenses}>
        <GoalProvider
          initialSavingsGoal={savingsGoal}
          initialSavingsGoals={savingsGoals}
          initialGrowthMarks={growthMarks}
        >
          <ModalProvider>
            <AppContent
              currentView={currentView}
              setCurrentView={setCurrentView}
              messages={messages}
              setMessages={setMessages}
              monthlyLetter={monthlyLetter}
              setMonthlyLetter={setMonthlyLetter}
              notification={notification}
              setNotification={setNotification}
              notificationSettings={notificationSettings}
              setNotificationSettings={setNotificationSettings}
              exploredTopics={exploredTopics}
              setExploredTopics={setExploredTopics}
              subscriptionNotes={subscriptionNotes}
              setSubscriptionNotes={setSubscriptionNotes}
            />
          </ModalProvider>
        </GoalProvider>
      </ExpenseProvider>
    </AuthProvider>
  );
}
