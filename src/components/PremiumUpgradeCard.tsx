import React, { useEffect, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  BillingPeriod,
  PremiumPlans,
  billingAvailable,
  getPremiumPlans,
  restorePremium,
  selectBillingPeriod,
  MANAGE_SUBSCRIPTIONS_URL,
  unavailableMessage,
} from '../lib/billingService';

interface PremiumUpgradeCardProps {
  onUpgrade?: () => void;
  isUpgrading?: boolean;
}

// Shown only where Google Play prices aren't available (web, or before billing is set up). In the
// Android app every price and the trial come from Google Play, localized per country (KOVA-077).
const REFERENCE = { annual: '$79.99', monthly: '$11.99', annualPerMonth: '$6.67', saving: 44 };

// Every line here is something Premium really does and the server really enforces (KOVA-073).
// Numbers come from server/plans.ts via /api/me/entitlement. Don't add a line until the feature exists.
export const PremiumUpgradeCard: React.FC<PremiumUpgradeCardProps> = ({ onUpgrade, isUpgrading = false }) => {
  const { planLimits, plan, refreshEntitlement } = useAuth();
  const toast = useToast();
  const free = planLimits.free.quotas;
  const premium = planLimits.premium.quotas;
  const isPremium = plan === 'premium';
  const native = billingAvailable();

  const [plans, setPlans] = useState<PremiumPlans | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>('annual');
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!isPremium) {
      getPremiumPlans().then((p) => {
        if (!alive || !p) return;
        setPlans(p);
        if (!p.annual && p.monthly) setPeriod('monthly');
      });
    }
    return () => {
      alive = false;
    };
  }, [isPremium]);

  useEffect(() => {
    selectBillingPeriod(period);
  }, [period]);

  const annualPrice = plans?.annual?.priceString || REFERENCE.annual;
  const monthlyPrice = plans?.monthly?.priceString || REFERENCE.monthly;
  const annualPerMonth = plans ? plans.annual?.pricePerMonthString : REFERENCE.annualPerMonth;
  const saving = plans ? plans.annualSavingPercent : REFERENCE.saving;
  const selected = period === 'annual' ? plans?.annual : plans?.monthly;
  const trialDays = selected?.trialDays || 0;
  const selectedPrice = period === 'annual' ? `${annualPrice}/year` : `${monthlyPrice}/month`;

  const features = [
    `Talk with Kova as much as you need: up to ${premium.chat} replies a day (Free: ${free.chat})`,
    'Track as many savings and debt goals as you like, each with its own coach',
    'See every month of your history, not just this one',
    `Import statements from your bank or wallet: ${premium.csvImport} a month (Free: ${free.csvImport})`,
    'Your full monthly letter, 3 book picks and the whole archive',
    "All 200+ money topics, plus Kova's Analytic tone",
    'Five extra themes: Solarized Light, Solarized Dark, Solarized Gold, Forest and Nord Night',
  ];

  const handleRestore = async () => {
    setRestoring(true);
    const result = await restorePremium();
    setRestoring(false);
    if (result.ok) {
      await refreshEntitlement();
      toast.success('Premium restored.');
    } else if (result.message) {
      toast.info(result.message);
    }
  };

  const planTile = (p: BillingPeriod) => {
    const active = period === p;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => setPeriod(p)}
        className={`w-full text-left rounded-2xl border px-4 py-3 transition-all cursor-pointer ${
          active ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">{p === 'annual' ? 'Yearly' : 'Monthly'}</span>
          {p === 'annual' && saving ? (
            <span className="text-[10px] font-semibold text-black bg-amber-400 px-2 py-0.5 rounded-full">Save {saving}%</span>
          ) : null}
        </div>
        <div className="text-xs text-white/80 mt-0.5">
          {p === 'annual' ? (
            <>
              {annualPrice}/year{annualPerMonth ? <span className="text-kova-muted"> · about {annualPerMonth}/mo</span> : null}
            </>
          ) : (
            <>{monthlyPrice}/month</>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="glass-card rounded-[28px] p-6 sm:p-8 border border-amber-500/20 bg-kova-surface shadow-2xl space-y-6 relative overflow-hidden text-left font-sans">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-kova-muted uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>PREMIUM</span>
        </span>
        <span className="text-[10px] bg-amber-400/10 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/20 font-medium">
          Kova Pro
        </span>
      </div>

      <div className="space-y-3">
        <h3 className="text-2xl sm:text-3xl font-serif-headline text-white font-normal tracking-tight">Go deeper with Kova</h3>
        <p className="text-xs sm:text-sm text-white/80 italic font-serif-headline leading-relaxed border-l-2 border-amber-400/40 pl-3">
          "The free version helps you notice. Premium helps you build."
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t border-white/10">
        <ul className="space-y-2.5">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-white/90 leading-relaxed">
              <div className="w-4 h-4 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 mt-0.5 text-amber-400">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {isPremium ? (
        <div className="space-y-2.5 pt-2">
          <p className="text-sm text-white text-center">You have Kova Premium. Thank you.</p>
          {native && (
            <a
              href={MANAGE_SUBSCRIPTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center py-3 px-6 rounded-full border border-white/15 text-white text-xs sm:text-sm hover:bg-white/5"
            >
              Manage subscription in Google Play
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          <div role="radiogroup" aria-label="Choose a plan" className="grid gap-2">
            {(plans ? plans.annual : true) && planTile('annual')}
            {(plans ? plans.monthly : true) && planTile('monthly')}
          </div>

          {trialDays > 0 && (
            <p className="text-[11px] text-white/80 text-center">
              {trialDays} days free, then {selectedPrice}. Cancel anytime in Google Play.
            </p>
          )}

          <button
            type="button"
            onClick={onUpgrade}
            disabled={isUpgrading}
            className="w-full py-3.5 px-6 rounded-full bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs sm:text-sm transition-all shadow-lg hover:shadow-amber-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>
              {isUpgrading ? 'Opening Google Play...' : trialDays > 0 ? `Start ${trialDays}-day free trial` : 'Upgrade to Premium →'}
            </span>
          </button>

          {native ? (
            <p className="text-[10px] text-kova-muted text-center leading-relaxed">
              Billed through Google Play. {selectedPrice} renews automatically until you cancel.{' '}
              <button type="button" onClick={handleRestore} disabled={restoring} className="underline underline-offset-2 hover:text-white cursor-pointer">
                {restoring ? 'Restoring...' : 'Restore purchase'}
              </button>
            </p>
          ) : (
            <p className="text-[10px] text-kova-muted text-center">{unavailableMessage()} Prices shown in USD; your local price may differ.</p>
          )}

          <p className="text-[11px] text-kova-muted text-center font-normal">Logging and your daily lesson stay free, always.</p>
        </div>
      )}
    </div>
  );
};
