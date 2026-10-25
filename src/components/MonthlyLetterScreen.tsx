import React, { useState, useEffect } from 'react';
import { MonthlyLetter, ViewMode, UserProfile, BookRecommendation } from '../types';
import { KovaAvatar } from './KovaAvatar';
import { ArrowLeft, BookOpen, RefreshCw, Share2, Sparkles, CheckCircle2, Download, Lock, Archive, ChevronRight } from 'lucide-react';
import { downloadMonthlyReportPdf } from '../utils/generateReportPdf';
import { getAllMonthlyLetters } from '../lib/userService';
import { PremiumUpgradeCard } from './PremiumUpgradeCard';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';

interface MonthlyLetterScreenProps {
  letter: MonthlyLetter | null;
  onSelectView: (view: ViewMode) => void;
  onRegenerateLetter: () => Promise<void>;
  isRegenerating: boolean;
  userProfile?: UserProfile | null;
  userUid?: string;
  onUpgradePlan?: () => void;
  onOpenUpgradeModal?: () => void;
  openArchiveDirectly?: boolean;
}

export const MonthlyLetterScreen: React.FC<MonthlyLetterScreenProps> = ({
  letter,
  onSelectView,
  onRegenerateLetter,
  isRegenerating,
  userProfile: propUserProfile,
  userUid: propUserUid,
  onUpgradePlan: propOnUpgradePlan,
  onOpenUpgradeModal: propOnOpenUpgradeModal,
  openArchiveDirectly = false,
}) => {
  const { userProfile: authUserProfile, currentUser, isPremium: authIsPremium, updatePlan } = useAuth();
  const { openPremiumUpgrade } = useModal();
  const toast = useToast();

  const userProfile = propUserProfile !== undefined ? propUserProfile : authUserProfile;
  const userUid = propUserUid || currentUser?.uid;
  const isPremium = userProfile ? userProfile.plan === 'premium' : authIsPremium;
  const onUpgradePlan = propOnUpgradePlan || (() => updatePlan('premium'));
  const onOpenUpgradeModal = propOnOpenUpgradeModal || openPremiumUpgrade;

  const [copied, setCopied] = useState(false);
  const [isViewingArchive, setIsViewingArchive] = useState(openArchiveDirectly);
  const [selectedLetter, setSelectedLetter] = useState<MonthlyLetter | null>(null);
  const [archiveLetters, setArchiveLetters] = useState<MonthlyLetter[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const displayLetter = selectedLetter || letter;

  const handleHeaderArchiveClick = () => {
    if (!isPremium) {
      if (onOpenUpgradeModal) {
        onOpenUpgradeModal();
      } else if (onUpgradePlan) {
        onUpgradePlan();
      }
    } else {
      setIsViewingArchive(true);
    }
  };

  // Load archive whenever Archive view is opened or component mounts with userUid
  useEffect(() => {
    let isMounted = true;
    const fetchArchive = async () => {
      setIsLoadingArchive(true);
      try {
        const letters = await getAllMonthlyLetters(userUid || 'local');
        if (isMounted) {
          setArchiveLetters(letters);
        }
      } catch (err) {
        console.warn('Failed loading archive:', err);
      } finally {
        if (isMounted) setIsLoadingArchive(false);
      }
    };

    fetchArchive();
    return () => {
      isMounted = false;
    };
  }, [userUid, isViewingArchive]);

  const handleShare = () => {
    if (!displayLetter) return;
    const textToCopy = `Kova Monthly Letter (${displayLetter.month} ${displayLetter.year}):\n\n"${displayLetter.headline}"\n\nBook Recommendation: ${displayLetter.bookRecommendation?.title} by ${displayLetter.bookRecommendation?.author}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Letter copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!displayLetter) return;
    try {
      await downloadMonthlyReportPdf(
        displayLetter,
        userProfile?.firstName || 'Friend',
        userProfile?.workingGoal || 'Financial Clarity'
      );
      toast.success('PDF report exported');
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error("Couldn't generate PDF report");
    }
  };

  // ARCHIVE SCREEN VIEW
  if (isViewingArchive) {
    return (
      <div className="flex flex-col min-h-app max-w-2xl mx-auto w-full px-4 pb-20 pt-4 animate-in fade-in duration-300 space-y-6 font-sans">
        {/* Archive Header */}
        <div className="flex items-center justify-between py-3 border-b border-[#2C2C2E]/50">
          <button
            type="button"
            onClick={() => setIsViewingArchive(false)}
            className="text-xs text-[#8A8A8E] hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Letter</span>
          </button>

          <div className="text-center">
            <div className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 justify-center">
              <Archive className="w-3.5 h-3.5 text-amber-300" />
              <span>Letter Archive</span>
            </div>
            <div className="text-[10px] text-[#8A8A8E]">
              {isPremium ? 'All Monthly Briefings Unlocked' : 'Free Plan · Latest Month Only'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectView('chat')}
            className="text-xs text-[#8A8A8E] hover:text-white transition-colors flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 cursor-pointer"
          >
            <span>Chat</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoadingArchive ? (
          <div className="text-center py-12 text-xs text-[#8A8A8E] animate-pulse">
            Loading stored letters...
          </div>
        ) : archiveLetters.length === 0 ? (
          /* Empty Archive State - Premium user with zero archived letters yet */
          <div className="glass-card rounded-[28px] p-8 sm:p-10 border border-white/10 bg-[#161618]/90 text-center space-y-4 my-6 flex flex-col items-center justify-center">
            <KovaAvatar size="lg" isPulsing={true} />
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-white tracking-tight">Your Letter Archive</h3>
              <p className="text-xs text-[#8A8A8E] leading-relaxed">
                As soon as your first letter arrives, you'll find it here.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsViewingArchive(false)}
                className="bg-white/10 text-white hover:bg-white/20 font-medium text-xs px-5 py-2.5 rounded-full transition-all border border-white/10 cursor-pointer"
              >
                Return to Current Briefing
              </button>
            </div>
          </div>
        ) : (
          /* List of Stored Letters */
          <div className="space-y-4">
            <div className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wider px-1">
              {archiveLetters.length} {archiveLetters.length === 1 ? 'Letter' : 'Letters'} Stored
            </div>

            <div className="space-y-3">
              {archiveLetters.map((item, idx) => {
                // Free users can only access index 0 (latest/current month)
                const isUnlocked = isPremium || idx === 0;

                return (
                  <div
                    key={item.id || `letter-${item.month}-${item.year || 2026}-${idx}`}
                    onClick={() => {
                      if (isUnlocked) {
                        setSelectedLetter(item);
                        setIsViewingArchive(false);
                      } else if (onUpgradePlan) {
                        onUpgradePlan();
                      }
                    }}
                    className={`glass-card rounded-[22px] p-4 border transition-all ${
                      isUnlocked
                        ? 'border-white/10 bg-[#161618]/90 hover:border-white/20 hover:bg-[#1C1C1E] cursor-pointer'
                        : 'border-white/5 bg-[#121214]/60 cursor-pointer hover:border-amber-400/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white tracking-tight">
                            {item.month} {item.year || 2026}
                          </span>

                          {isUnlocked ? (
                            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {idx === 0 ? 'Current Month' : 'Unlocked'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Locked · Premium
                            </span>
                          )}
                        </div>

                        {/* Summary preview */}
                        {isUnlocked ? (
                          <p className="text-xs text-white/80 line-clamp-2 leading-relaxed">
                            "{item.headline}"
                          </p>
                        ) : (
                          <div className="relative overflow-hidden py-0.5">
                            <p className="text-xs text-white/40 filter blur-[4px] select-none pointer-events-none line-clamp-2">
                              "{item.headline || 'Monthly observations, key trends, and book recommendation'}"
                            </p>
                            <span className="text-[10px] text-amber-300/90 font-medium block pt-1">
                              Upgrade to unlock this past month's briefing
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 pt-1">
                        {isUnlocked ? (
                          <ChevronRight className="w-4 h-4 text-white/40" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-400/60" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* If Free User, show Upgrade Card at bottom of archive */}
            {!isPremium && (
              <div className="pt-4 space-y-3">
                <div className="glass-card rounded-2xl p-3 bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-300 font-medium">
                  Free plan includes access to your current month's letter. Upgrade to Premium to unlock your complete letter archive.
                </div>
                <PremiumUpgradeCard onUpgrade={onUpgradePlan} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // NO LETTER GENERATED AT ALL STATE
  if (!displayLetter) {
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
    return (
      <div className="flex flex-col min-h-app max-w-2xl mx-auto w-full px-4 pb-20 pt-4 animate-in fade-in duration-300 space-y-6 font-sans">
        <div className="flex items-center justify-between py-3 border-b border-[#2C2C2E]/50">
          <button
            type="button"
            onClick={() => onSelectView('chat')}
            className="text-xs text-[#8A8A8E] hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <div className="text-xs font-bold text-white">Monthly Letter</div>

          <button
            type="button"
            onClick={handleHeaderArchiveClick}
            className="text-xs text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5 bg-amber-400/10 hover:bg-amber-400/20 px-3 py-1.5 rounded-full border border-amber-400/20 cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archive</span>
          </button>
        </div>

        <div className="glass-card rounded-[28px] p-8 border border-white/10 bg-[#161618]/90 text-center space-y-4">
          <BookOpen className="w-8 h-8 text-white/60 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-xl font-serif-headline text-white font-normal">
              No letter generated yet for {currentMonth}
            </h3>
            <p className="text-xs text-[#8A8A8E] max-w-sm mx-auto leading-relaxed">
              Kova compiles your personal briefing on the last day of each month based on your real activity — no static templates or sample content.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onSelectView('chat')}
              className="bg-white text-black font-semibold text-xs px-6 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Return to Chat
            </button>
            <button
              type="button"
              onClick={handleHeaderArchiveClick}
              className="bg-white/10 text-white font-medium text-xs px-5 py-2.5 rounded-full hover:bg-white/20 transition-all border border-white/10 cursor-pointer"
            >
              View Letter Archive
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE LETTER VIEW (Selected or Latest)
  return (
    <div className="flex flex-col min-h-app max-w-2xl mx-auto w-full px-4 pb-20 pt-2 animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 py-3 mb-4 border-b border-[#2C2C2E]/50">
        <button
          type="button"
          onClick={() => onSelectView('chat')}
          aria-label="Back to chat"
          className="shrink-0 text-xs text-[#8A8A8E] hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 w-9 h-9 sm:w-auto sm:h-auto justify-center sm:px-3 sm:py-1.5 rounded-full border border-white/10 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Chat</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <KovaAvatar size="sm" isPulsing={isRegenerating} />
          <div className="min-w-0">
            <div className="text-xs font-bold text-white tracking-tight truncate">
              Your {displayLetter.month} letter
            </div>
            <div className="text-[10px] text-[#8A8A8E] truncate">
              from Kova · month-end
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* View Archive Link */}
          <button
            type="button"
            onClick={handleHeaderArchiveClick}
            className="text-xs text-amber-300 hover:text-amber-200 transition-colors flex items-center gap-1.5 bg-amber-400/10 hover:bg-amber-400/20 w-9 h-9 sm:w-auto sm:h-auto justify-center sm:px-3 sm:py-1.5 rounded-full border border-amber-400/20 cursor-pointer"
            title="View Letter Archive"
            aria-label="View letter archive"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Archive</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="text-xs text-[#8A8A8E] hover:text-white transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 w-9 h-9 sm:w-auto sm:h-auto justify-center sm:px-3 sm:py-1.5 rounded-full border border-white/10 cursor-pointer"
            title="Download Report PDF"
            aria-label="Download report PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="text-xs text-[#8A8A8E] hover:text-white transition-colors flex items-center gap-1 bg-white/5 hover:bg-white/10 w-9 h-9 sm:w-auto sm:h-auto justify-center sm:px-3 sm:py-1.5 rounded-full border border-white/10 cursor-pointer"
            title="Share Letter"
            aria-label={copied ? 'Copied' : 'Share letter'}
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#30D158]" /> : <Share2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-6">
        {/* Section 1: One-Line Headline Summary */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-semibold text-[#8A8A8E] tracking-widest block">
            Monthly Summary
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif-headline font-normal leading-snug text-white tracking-tight">
            "{displayLetter.headline}"
          </h2>
        </div>

        {/* Section 2: "Three things I noticed" Glass Card */}
        <div className="glass-card rounded-[24px] p-6 border border-white/10 bg-[#161618]/90 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-white/80" />
            <span>Three things I noticed</span>
          </div>

          <ul className="space-y-3">
            {displayLetter.observations.map((obs, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-white/90 leading-relaxed">
                <span className="text-xs font-semibold text-white/40 mt-0.5 shrink-0">
                  0{idx + 1}
                </span>
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Section 3: One Small Suggested Shift (Plain Text Block) */}
        <div className="py-2 px-1 space-y-1.5 border-l-2 border-white/20 pl-4">
          <span className="text-[10px] uppercase font-semibold text-[#8A8A8E] tracking-widest block">
            A small shift for next month
          </span>
          <p className="text-sm text-white/90 leading-relaxed font-normal">
            {displayLetter.suggestedShift}
          </p>
        </div>

        {/* Section 4: Book Recommendations Section */}
        {(() => {
          const defaultPicks: BookRecommendation[] = [
            {
              title: 'The Psychology of Money',
              author: 'Morgan Housel',
              coverGradient: 'from-[#1c1917] via-[#292524] to-[#0c0a09]',
              whyThisPick: 'Grounded in building calm, long-term awareness without complex spreadsheets.',
              whatYouWillGet: 'Understand how behavior and peace of mind shape wealth far more than market timing.',
              rationale: 'Grounded in building calm, long-term awareness — learn how behavior shapes wealth far more than spreadsheets.'
            },
            {
              title: 'Atomic Habits',
              author: 'James Clear',
              coverGradient: 'from-[#1e1b4b] via-[#312e81] to-[#0f172a]',
              whyThisPick: 'Grounded in the power of small, continuous choices like tracking entries frictionlessly.',
              whatYouWillGet: 'Practical systems to automate financial discipline naturally without relying on willpower.',
              rationale: 'Grounded in small continuous choices — practical systems to automate financial discipline naturally.'
            },
            {
              title: 'Die With Zero',
              author: 'Bill Perkins',
              coverGradient: 'from-[#203a43] via-[#2c5364] to-[#0f2027]',
              whyThisPick: 'Grounded in balancing intentional savings with meaningful current experiences.',
              whatYouWillGet: 'A fresh framework for optimizing lifetime fulfillment rather than simply hoarding numbers.',
              rationale: 'Grounded in balancing savings with experiences — a fresh framework for lifetime fulfillment.'
            }
          ];

          const rawPicks = displayLetter.bookRecommendations || (displayLetter.bookRecommendation ? [displayLetter.bookRecommendation] : []);
          const bookPicks: BookRecommendation[] = [
            rawPicks[0] || defaultPicks[0],
            rawPicks[1] || defaultPicks[1],
            rawPicks[2] || defaultPicks[2],
          ];

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#8A8A8E] uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{isPremium ? 'Recommended Reading · 3 Picks' : 'Recommended Reading'}</span>
                </div>
                {isPremium ? (
                  <span className="text-[10px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Premium · 3 Book Picks
                  </span>
                ) : (
                  <span className="text-[10px] text-[#8A8A8E]">
                    1 of 3 Picks Unlocked
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {bookPicks.map((pick, idx) => {
                  const isPickUnlocked = isPremium || idx === 0;

                  return (
                    <div
                      key={`book-pick-${idx}`}
                      className={`glass-card rounded-[24px] p-5 border transition-all ${
                        isPickUnlocked
                          ? 'border-white/10 bg-[#1A1A1C]/90'
                          : 'border-white/5 bg-[#141416]/60 relative overflow-hidden'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Book Cover Swatch */}
                        <div className={`w-16 h-22 rounded-xl bg-gradient-to-br ${pick.coverGradient || 'from-[#1c1917] to-[#0c0a09]'} border border-white/20 flex flex-col justify-between p-2.5 shrink-0 shadow-xl relative overflow-hidden`}>
                          <div className="w-4 h-0.5 bg-white/40 rounded-full" />
                          <div className="text-[9px] font-bold text-white leading-tight font-serif-headline line-clamp-2">
                            {pick.title}
                          </div>
                          <div className="text-[7px] text-white/60 truncate">
                            {pick.author}
                          </div>
                        </div>

                        {/* Book Content */}
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                                <span>{pick.title}</span>
                                {isPremium && (
                                  <span className="text-[10px] text-[#8A8A8E] font-normal">
                                    Pick 0{idx + 1}
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-[#8A8A8E]">
                                by {pick.author}
                              </p>
                            </div>

                            {!isPickUnlocked && (
                              <span className="text-[10px] font-medium text-amber-300/90 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-amber-300" />
                                Locked Preview
                              </span>
                            )}
                          </div>

                          {isPickUnlocked ? (
                            /* Unlocked Content */
                            <div className="space-y-1.5 pt-1 text-xs">
                              {(pick.whyThisPick || pick.rationale) && (
                                <div>
                                  <span className="font-semibold text-white/90">Why this pick: </span>
                                  <span className="text-white/80 leading-relaxed">
                                    {pick.whyThisPick || pick.rationale}
                                  </span>
                                </div>
                              )}
                              {pick.whatYouWillGet && (
                                <div>
                                  <span className="font-semibold text-amber-300/90">What you'll get: </span>
                                  <span className="text-white/80 leading-relaxed">
                                    {pick.whatYouWillGet}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Locked / Blurred Content Preview */
                            <div className="relative pt-1">
                              <div className="space-y-1.5 text-xs text-white/40 filter blur-[4px] select-none pointer-events-none">
                                <p>
                                  <span className="font-semibold">Why this pick: </span>
                                  {pick.whyThisPick || pick.rationale || 'Grounded directly in specific observations from your monthly activity.'}
                                </p>
                                <p>
                                  <span className="font-semibold">What you'll get: </span>
                                  {pick.whatYouWillGet || 'Key takeaways and mindset shifts personalized to your financial goals.'}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (onOpenUpgradeModal) onOpenUpgradeModal();
                                  else if (onUpgradePlan) onUpgradePlan();
                                }}
                                className="mt-2 text-xs text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1.5 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/20 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                              >
                                <Lock className="w-3 h-3 text-amber-300" />
                                <span>Upgrade to Premium to unlock Book Pick 0{idx + 1}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Upgrade prompt card for free users below the picks */}
                {!isPremium && (
                  <div className="pt-2">
                    <PremiumUpgradeCard onUpgrade={onUpgradePlan} />
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={onRegenerateLetter}
            disabled={isRegenerating}
            className="glass-pill px-4 py-2 rounded-full text-xs font-medium text-white hover:bg-white hover:text-black transition-all flex items-center gap-2 border border-white/10 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span>{isRegenerating ? 'Writing letter...' : 'Regenerate Briefing with AI'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('chat')}
            className="bg-white text-black font-semibold text-xs px-5 py-2 rounded-full hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            Return to Chat
          </button>
        </div>
      </div>
    </div>
  );
};
