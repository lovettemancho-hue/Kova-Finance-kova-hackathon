import React, { useState } from 'react';
import { 
  User, 
  Bell, 
  Sparkles, 
  Shield, 
  Info, 
  LogOut, 
  ArrowLeft, 
  Check, 
  Lock, 
  Download, 
  Trash2, 
  CreditCard,
  AlertTriangle,
  Code2,
  Crown,
  RefreshCw,
  Globe,
  ChevronRight,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import { UserProfile, Expense, ChatMessage, MonthlyLetter } from '../types';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../context/ExpenseContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { PremiumUpgradeCard } from './PremiumUpgradeCard';
import { SUPPORTED_COUNTRIES, getCurrencyForCountry, getCountryOption } from '../utils/currency';
import { CountrySearchSelect } from './CountrySearchSelect';
import { AboutBankScene } from './AboutBankScene';
import { PayPalSettingsCard } from './PayPalSettingsCard';
import { useEscapeKey } from '../utils/useEscapeKey';

interface SettingsScreenProps {
  userProfile?: UserProfile | null;
  onUpdateTone?: (newTone: string) => void;
  notifications: { monthlyLetter: boolean; dailyGrow: boolean };
  onToggleNotification: (key: 'monthlyLetter' | 'dailyGrow') => void;
  onLogout?: () => void;
  onBack: () => void;
  onNavigateToAbout?: () => void;
  onNavigateToGuide?: () => void;
  expenses?: Expense[];
  messages: ChatMessage[];
  monthlyLetter: MonthlyLetter | null;
  onDeleteAccount?: () => Promise<void>;
  onUpdatePlan?: (newPlan: 'free' | 'premium') => Promise<void>;
  onRegenerateLetter?: () => Promise<void>;
  isRegeneratingLetter?: boolean;
}

const TONE_OPTIONS = [
  {
    id: 'Gently, ease me in',
    title: 'Gently, ease me in',
    desc: 'Soft, supportive, and focused on progress without pressure',
  },
  {
    id: 'Straight, tell me the truth',
    title: 'Straight, tell me the truth',
    desc: 'Direct, honest, and concise without sugarcoating',
  },
  {
    id: 'Analytic, show me the numbers',
    title: 'Analytic, show me the numbers',
    desc: 'Data-driven, precise breakdown of spending metrics',
    isPremium: true,
  },
  {
    id: 'Warm, like a wise mentor',
    title: 'Warm, like a wise mentor',
    desc: 'Encouraging, reflective, and focused on lifelong habits',
  },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  userProfile: propUserProfile,
  onUpdateTone: propOnUpdateTone,
  notifications,
  onToggleNotification,
  onLogout: propOnLogout,
  onBack,
  onNavigateToAbout,
  onNavigateToGuide,
  expenses: propExpenses,
  messages,
  monthlyLetter,
  onDeleteAccount: propOnDeleteAccount,
  onUpdatePlan: propOnUpdatePlan,
  onRegenerateLetter,
  isRegeneratingLetter = false,
}) => {
  const { 
    currentUser, 
    userProfile: authUserProfile, 
    plan: authPlan, 
    updatePlan: authUpdatePlan, 
    updateTone: authUpdateTone, 
    updateCountryAndCurrency: authUpdateCountryAndCurrency,
    logout: authLogout,
    deleteAccount: authDeleteAccount,
    canManagePlans,
    planLimits,
    setPlanAsAdmin,
    sendPasswordReset 
  } = useAuth();

  const { openDeleteAccount, openPremiumUpgrade, isModalOpen, closeModal } = useModal();
  const isDeleteModalOpen = isModalOpen('delete-account');
  const toast = useToast();

  const expenseCtx = useExpenses();
  const expenses = propExpenses || expenseCtx.expenses;

  const userProfile = propUserProfile !== undefined ? propUserProfile : authUserProfile;
  const onUpdateTone = propOnUpdateTone || authUpdateTone;
  const onLogout = propOnLogout || authLogout;
  const onDeleteAccount = propOnDeleteAccount || authDeleteAccount;
  const onUpdatePlan = propOnUpdatePlan || authUpdatePlan;

  const isGoogleAccount = currentUser?.providerData?.some(
    (p) => p.providerId === 'google.com'
  );

  // The server's entitlement decides the plan (profile.plan is client-writable and can be stale).
  const currentPlan = authPlan || 'free';

  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  useEscapeKey(() => { if (!isDeleting) closeModal(); }, isDeleteModalOpen);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [showUpgradeCard, setShowUpgradeCard] = useState(false);
  const [adminTargetEmail, setAdminTargetEmail] = useState('');

  // Admin-only plan change through the server (PLAN_ADMIN_UIDS). No email means the admin's own account.
  const runAdminPlanChange = async (plan: 'free' | 'premium', email?: string) => {
    setIsUpdatingPlan(true);
    try {
      await setPlanAsAdmin(plan, email);
      const label = plan === 'premium' ? 'Premium' : 'Free';
      showToast(email ? `Plan set to ${label} for ${email}` : `Test Mode: Plan set to ${label}`);
      if (email) setAdminTargetEmail('');
    } catch (err: any) {
      showToast(err?.message || 'Could not update the plan.');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const showToast = (msg: string) => {
    toast.info(msg);
  };

  const handlePasswordReset = async () => {
    const userEmail = currentUser?.email || userProfile?.email;
    if (!userEmail) return;

    setIsSendingReset(true);
    setResetMessage(null);
    setResetError(null);

    try {
      await sendPasswordReset(userEmail);
      setResetMessage(`Password reset link sent to ${userEmail}`);
      toast.success(`Password reset link sent to ${userEmail}`);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResetError('Failed to send reset email. Please try again.');
      toast.error('Failed to send reset email. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleExportData = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        firstName: userProfile?.firstName || currentUser?.displayName || 'User',
        email: userProfile?.email || currentUser?.email || '',
        profile: userProfile,
      },
      expenses,
      chatMessagesCount: messages.length,
      monthlyLetter,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `kova-data-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    toast.success('Data exported successfully');
  };

  const handleConfirmDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
      onLogout();
      toast.info('Account deleted');
    } catch (err: any) {
      console.error('Error deleting account:', err?.code || err?.message || err);
      toast.error(err?.message || "We couldn't finish deleting your account. Please try again.");
    } finally {
      setIsDeleting(false);
      closeModal();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-4 py-6 font-sans max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <button
          onClick={onBack}
          className="text-xs text-[#8A8A8E] hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <h1 className="text-base font-bold text-white tracking-tight">Settings</h1>

        <div className="w-12" /> {/* Spacer */}
      </div>

      {/* 1. Account Section */}
      <section className="glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
          <User className="w-4 h-4 text-white/60" />
          <span>Account</span>
        </div>

        <div className="flex items-center justify-between bg-black/40 p-3.5 rounded-2xl border border-white/5">
          <div>
            <div className="text-sm font-bold text-white">
              {userProfile?.firstName || currentUser?.displayName || 'Kova User'}
            </div>
            <div className="text-xs text-[#8A8A8E]">
              {userProfile?.email || currentUser?.email || 'No email associated'}
            </div>
          </div>

          {isGoogleAccount ? (
            <span className="text-[11px] font-medium text-[#30D158] bg-[#30D158]/10 px-3 py-1 rounded-full border border-[#30D158]/20 flex items-center gap-1.5">
              <Check className="w-3 h-3" />
              <span>Managed by Google</span>
            </span>
          ) : (
            <button
              onClick={handlePasswordReset}
              disabled={isSendingReset}
              className="text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full border border-white/15 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-3 h-3 text-white/70" />
              <span>{isSendingReset ? 'Sending...' : 'Change password'}</span>
            </button>
          )}
        </div>

        {resetMessage && (
          <div className="text-xs text-[#30D158] bg-[#30D158]/10 p-2.5 rounded-xl border border-[#30D158]/20 text-center">
            {resetMessage}
          </div>
        )}
        {resetError && (
          <div className="text-xs text-[#FF6B6B] bg-[#FF3B30]/10 p-2.5 rounded-xl border border-[#FF3B30]/20 text-center">
            {resetError}
          </div>
        )}
      </section>

      {/* 2. Country & Currency Localization Section */}
      <section className="glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
            <Globe className="w-4 h-4 text-white/60" />
            <span>Country & Currency</span>
          </div>
          <span className="text-[10px] font-mono text-white/70 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
            {userProfile?.currency || 'USD'}
          </span>
        </div>

        <p className="text-xs text-[#8A8A8E] leading-relaxed">
          Choose your local region from all 190+ ISO countries. All transaction amounts, savings goals, and budget insights will be formatted with your local currency.
        </p>

        <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5">
          <CountrySearchSelect
            label="Selected Country"
            value={userProfile?.country || 'United States'}
            onChange={async (selected) => {
              const newCountry = selected.countryName;
              const newCurrency = selected.currencyCode;
              await authUpdateCountryAndCurrency(newCountry, newCurrency);
              showToast(`Currency updated to ${newCurrency} (${newCountry})`);
            }}
          />

          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
            <span className="text-[#8A8A8E]">Active Currency:</span>
            <span className="text-white font-semibold flex items-center gap-1.5">
              <span>{getCountryOption(userProfile?.country || 'United States')?.flag || '🇺🇸'}</span>
              <span>{userProfile?.currency || 'USD'}</span>
              <span className="text-[#8A8A8E]">({getCountryOption(userProfile?.country || 'United States')?.symbol || '$'})</span>
            </span>
          </div>
        </div>
      </section>

      {/* 3. Notifications Section */}
      <section className="glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
          <Bell className="w-4 h-4 text-white/60" />
          <span>Notifications</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
            <div>
              <div className="text-xs font-semibold text-white">Monthly Letter Briefing</div>
              <div className="text-[11px] text-[#8A8A8E]">Receive an alert when your month-end financial letter is ready</div>
            </div>
            <button
              onClick={() => onToggleNotification('monthlyLetter')}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                notifications.monthlyLetter ? 'bg-white' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full shadow-md transition-transform ${
                  notifications.monthlyLetter ? 'bg-black translate-x-5' : 'bg-white translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5">
            <div>
              <div className="text-xs font-semibold text-white">Daily Grow Micro-Lessons</div>
              <div className="text-[11px] text-[#8A8A8E]">Daily bite-sized insights to build financial literacy</div>
            </div>
            <button
              onClick={() => onToggleNotification('dailyGrow')}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                notifications.dailyGrow ? 'bg-white' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full shadow-md transition-transform ${
                  notifications.dailyGrow ? 'bg-black translate-x-5' : 'bg-white translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Tone Preference Section */}
      <section className="glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-white/60" />
            <span>Kova's Speaking Tone</span>
          </div>
          <span className="text-[10px] text-[#8A8A8E]">Affects next chat response</span>
        </div>

        <p className="text-xs text-[#8A8A8E]">
          How do you want Kova to talk to you about your money?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {TONE_OPTIONS.map((opt) => {
            const isSelected = userProfile?.preferredTone === opt.id;
            const isLocked = opt.isPremium && currentPlan !== 'premium';

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (isLocked) {
                    setShowUpgradeCard(true);
                    showToast('Analytic tone is a Premium feature. Upgrade to unlock!');
                    return;
                  }
                  onUpdateTone(opt.id);
                  showToast(`Tone updated to "${opt.title}"`);
                }}
                className={`p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between space-y-1.5 cursor-pointer relative ${
                  isSelected
                    ? 'bg-white/15 border-white text-white shadow-lg'
                    : isLocked
                    ? 'bg-black/30 border-amber-500/20 text-[#8A8A8E] opacity-75 hover:border-amber-500/40 hover:opacity-100'
                    : 'bg-black/40 border-white/5 text-[#8A8A8E] hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-white">{opt.title}</span>
                    {opt.isPremium && (
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-400/30 font-semibold">
                        Pro
                      </span>
                    )}
                  </div>
                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 text-white shrink-0" />
                  ) : isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : null}
                </div>
                <p className="text-[10px] text-[#8A8A8E] leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Data & Privacy Section */}
      <section className="glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
          <Shield className="w-4 h-4 text-white/60" />
          <span>Data & Privacy</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            onClick={handleExportData}
            className="flex-1 p-3 rounded-2xl bg-black/40 hover:bg-white/10 border border-white/10 text-xs text-white font-medium transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5 text-white/70" />
            <span>Export my data (JSON)</span>
          </button>

          <button
            onClick={openDeleteAccount}
            className="p-3 rounded-2xl bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 border border-[#FF3B30]/20 text-xs text-[#FF6B6B] font-medium transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#FF6B6B]" />
            <span>Delete account</span>
          </button>
        </div>

        <a
          href={`${import.meta.env.VITE_API_URL || ''}/privacy`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[11px] text-[#8A8A8E] hover:text-white underline underline-offset-2 transition-colors"
        >
          Privacy policy
        </a>
      </section>

      {/* 4b. Optional PayPal check-in */}
      <PayPalSettingsCard />

      {/* 5. Plan Section */}
      <section className="space-y-3">
        <div className="glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${
              currentPlan === 'premium' ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' : 'bg-white/10 text-white border-white/10'
            }`}>
              {currentPlan === 'premium' ? <Crown className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Current Plan: {currentPlan === 'premium' ? 'Premium' : 'Free'}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full border ${
                  currentPlan === 'premium'
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/30 font-semibold'
                    : 'bg-white/10 text-white border-white/10'
                }`}>
                  Active
                </span>
              </div>
              <div className="text-[11px] text-[#8A8A8E]">
                {currentPlan === 'premium'
                  ? `Up to ${planLimits.premium.quotas.chat} replies a day, all goals, statement imports & letter archive`
                  : `Unlimited logging, ${planLimits.free.quotas.chat} Kova replies a day`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowUpgradeCard(!showUpgradeCard)}
            className="text-xs text-black font-semibold bg-amber-400 hover:bg-amber-300 px-3.5 py-2 rounded-full transition-all active:scale-95 cursor-pointer shadow-md"
          >
            {showUpgradeCard ? 'Hide Details' : currentPlan === 'premium' ? 'Plan Benefits' : 'Upgrade →'}
          </button>
        </div>

        {/* Embedded Premium Upgrade Card */}
        {showUpgradeCard && (
          <div className="animate-in fade-in duration-200">
            <PremiumUpgradeCard
              onUpgrade={async () => {
                setIsUpdatingPlan(true);
                try {
                  const targetPlan = currentPlan === 'premium' ? 'free' : 'premium';
                  await onUpdatePlan(targetPlan);
                  showToast(targetPlan === 'premium' ? 'Upgraded to Kova Premium!' : 'Switched to Free plan.');
                } catch (err) {
                  showToast('Failed to update plan.');
                } finally {
                  setIsUpdatingPlan(false);
                }
              }}
              isUpgrading={isUpdatingPlan}
            />
          </div>
        )}
      </section>

      {/* 6. Developer / Test Mode Section: only for PLAN_ADMIN_UIDS (server decides via /api/me/entitlement) */}
      {canManagePlans && (
      <section className="rounded-[24px] p-5 border border-dashed border-amber-500/40 bg-amber-500/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <Code2 className="w-4 h-4 text-amber-400" />
            <span>Developer / Test Mode</span>
          </div>
          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono font-medium">
            Test Only
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white tracking-tight">
            Test Mode — Free / Premium Toggle
          </h4>
          <p className="text-[11px] text-amber-200/70 leading-relaxed font-sans">
            Admin only. Sets the server-owned plan without payment, for testing and judge demo accounts.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={async () => {
              if (currentPlan === 'free') return;
              await runAdminPlanChange('free');
            }}
            disabled={isUpdatingPlan}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              currentPlan === 'free'
                ? 'bg-white text-black border-white shadow-md'
                : 'bg-black/40 text-[#8A8A8E] border-white/10 hover:border-white/20 hover:text-white'
            }`}
          >
            <span>Free Plan</span>
            {currentPlan === 'free' && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
          </button>

          <button
            type="button"
            onClick={async () => {
              if (currentPlan === 'premium') return;
              await runAdminPlanChange('premium');
            }}
            disabled={isUpdatingPlan}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              currentPlan === 'premium'
                ? 'bg-amber-400 text-black border-amber-400 shadow-md font-bold'
                : 'bg-black/40 text-amber-400/80 border-amber-500/20 hover:border-amber-500/40 hover:text-amber-300'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Premium Plan</span>
            {currentPlan === 'premium' && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
          </button>
        </div>

        {/* Set the plan for another account (e.g. judge demo accounts) */}
        <div className="pt-2 border-t border-amber-500/20 space-y-2">
          <label htmlFor="admin-plan-email" className="block text-[11px] font-semibold text-amber-200/80">
            Set plan for another account
          </label>
          <input
            id="admin-plan-email"
            type="email"
            value={adminTargetEmail}
            onChange={(e) => setAdminTargetEmail(e.target.value)}
            placeholder="account email"
            autoComplete="off"
            className="w-full py-2 px-3 rounded-xl text-xs bg-black/40 text-white border border-white/10 focus:border-amber-500/40 outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUpdatingPlan || !adminTargetEmail.trim()}
              onClick={() => runAdminPlanChange('free', adminTargetEmail.trim())}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold border bg-black/40 text-[#8A8A8E] border-white/10 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              Set Free
            </button>
            <button
              type="button"
              disabled={isUpdatingPlan || !adminTargetEmail.trim()}
              onClick={() => runAdminPlanChange('premium', adminTargetEmail.trim())}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold border bg-black/40 text-amber-400/80 border-amber-500/20 hover:text-amber-300 transition-all cursor-pointer disabled:opacity-50"
            >
              Set Premium
            </button>
          </div>
        </div>

        {/* Manual Letter Generation Trigger (Test Only) */}
        <div className="pt-2 border-t border-amber-500/20">
          <button
            type="button"
            onClick={async () => {
              if (onRegenerateLetter) {
                await onRegenerateLetter();
                showToast('Test Mode: Generated current month letter!');
              }
            }}
            disabled={isRegeneratingLetter}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-dashed border-amber-500/40 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${isRegeneratingLetter ? 'animate-spin' : ''}`} />
            <span>{isRegeneratingLetter ? 'Generating Letter with AI...' : 'Generate Letter Now (Test)'}</span>
          </button>
        </div>
      </section>
      )}

      {/* 7. How to Use Kova & About Kova Navigable Rows */}
      <section className="space-y-3">
        {/* How to use Kova */}
        <button
          type="button"
          onClick={onNavigateToGuide}
          className="w-full glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] hover:bg-[#1C1C1F] hover:border-white/20 transition-all active:scale-[0.99] flex items-center justify-between text-left cursor-pointer group shadow-sm"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:scale-105 transition-transform shrink-0">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white group-hover:text-amber-200 transition-colors">
                  How to use Kova
                </span>
                <span className="text-[10px] font-mono text-[#8A8A8E] bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                  Guide
                </span>
              </div>
              <p className="text-xs text-[#8A8A8E] mt-0.5">
                Quick-reference tour of all features & tips
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#8A8A8E] group-hover:text-white group-hover:translate-x-0.5 transition-all">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>

        {/* About Kova */}
        <button
          type="button"
          onClick={onNavigateToAbout}
          className="w-full glass-card rounded-[24px] p-5 border border-white/10 bg-[#161618] hover:bg-[#1C1C1F] hover:border-white/20 transition-all active:scale-[0.99] flex items-center justify-between text-left cursor-pointer group shadow-sm"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 group-hover:scale-105 transition-transform shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white group-hover:text-amber-200 transition-colors">
                  About Kova
                </span>
                <span className="text-[10px] font-mono text-[#8A8A8E] bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                  v1.2.0
                </span>
              </div>
              <p className="text-xs text-[#8A8A8E] mt-0.5">
                Why Kova exists and how it works
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#8A8A8E] group-hover:text-white group-hover:translate-x-0.5 transition-all">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </section>

      {/* Compliance & Educational Disclaimer Card */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1 my-4">
        <p className="text-[11px] font-semibold text-white/90">
          Educational Financial Companion
        </p>
        <p className="text-[10px] text-[#8A8A8E] leading-relaxed">
          Kova provides automated conversational guidance and literacy frameworks. Kova is not a licensed financial advisory service or broker. Always verify critical decisions with certified professionals.
        </p>
      </div>

      {/* 8. Log Out Button */}
      <div className="pt-2">
        <button
          onClick={onLogout}
          className="w-full py-3.5 rounded-full bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF6B6B] border border-[#FF3B30]/30 font-semibold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </div>

      {/* Delete Account Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="kova-modal kova-sheet fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-[28px] p-6 border border-white/20 bg-[#18181A] max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-[#FF6B6B]">
              <div className="w-10 h-10 rounded-full bg-[#FF3B30]/10 border border-[#FF3B30]/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Permanently Delete Account?</h3>
            </div>

            <p className="text-xs text-[#8A8A8E] leading-relaxed">
              This is permanent. Your expenses, goals, chats, letters and settings are erased from Kova's servers, and your sign-in is removed.
            </p>
            {currentPlan === 'premium' && (
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Deleting your account doesn't stop a Premium subscription. Cancel it first in Google Play, under Payments &amp; subscriptions.
              </p>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-full bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
