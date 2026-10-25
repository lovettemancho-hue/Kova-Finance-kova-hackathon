import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ChatMessage, Expense, ViewMode, SavingsGoal, GoalCardData, SendMessageOptions } from '../types';
import { KovaAvatar } from './KovaAvatar';
import { GoalCard } from './GoalCard';
import { CategoryBreakdownCard } from './CategoryBreakdownCard';
import { AffordCard } from './AffordCard';
import { SubscriptionRadarCard } from './SubscriptionRadarCard';
import { PayPalProposalCard } from './PayPalProposalCard';
import { ArrowUp, Mic, FileSpreadsheet, ArrowRight, Sparkles, Plus, Wallet } from 'lucide-react';
import { useGoals } from '../context/GoalContext';
import { useModal } from '../context/ModalContext';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/currency';
import { PayPalCheckinCard } from './PayPalCheckinCard';
import { ChatDayDivider } from './ChatDayDivider';
import { LongPressBubble, ReplyActionsSheet, ReplyMoreButton } from './ReplyActions';
import { usePayPalStatus } from '../utils/paypalClient';

interface ChatScreenProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, options?: SendMessageOptions) => Promise<void>;
  onSelectView: (view: ViewMode) => void;
  onOpenCsvImport?: () => void;
  onOpenVoiceNote?: () => void;
  isSending: boolean;
  savingsGoal?: SavingsGoal | null;
  savingsGoals?: SavingsGoal[];
  onEditGoal?: (goal?: SavingsGoal) => void;
  onAddNewGoal?: () => void;
  onOpenCoach?: (goal: SavingsGoal) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  messages,
  onSendMessage,
  onSelectView,
  onOpenCsvImport: propOnOpenCsvImport,
  onOpenVoiceNote: propOnOpenVoiceNote,
  isSending,
  savingsGoal: propSavingsGoal,
  savingsGoals: propSavingsGoals,
  onEditGoal: propOnEditGoal,
  onAddNewGoal: propOnAddNewGoal,
  onOpenCoach: propOnOpenCoach,
}) => {
  const { userProfile, currency: authCurrency, plan, usage } = useAuth();
  const currency = userProfile?.currency || authCurrency || 'USD';
  const goalCtx = useGoals();
  const { openCsvImport, openVoiceNote, openPremiumUpgrade } = useModal();

  const onOpenCsvImport = propOnOpenCsvImport || openCsvImport;
  const onOpenVoiceNote = propOnOpenVoiceNote || openVoiceNote;
  const savingsGoal = propSavingsGoal !== undefined ? propSavingsGoal : goalCtx.savingsGoal;
  const savingsGoals = propSavingsGoals !== undefined ? propSavingsGoals : goalCtx.savingsGoals;
  const onEditGoal = propOnEditGoal || goalCtx.handleOpenEditGoal;
  const onAddNewGoal = propOnAddNewGoal || goalCtx.handleOpenAddNewGoal;
  const onOpenCoach = propOnOpenCoach || ((g: SavingsGoal) => goalCtx.handleOpenCoach(g, onSelectView));

  const [inputText, setInputText] = useState('');

  // "Replies left today" (KOVA-076): shown when 2 or fewer are left, from the server's count.
  const chatUsage = usage?.chat;
  const resetsAtMs = chatUsage?.resetsAt ? Date.parse(chatUsage.resetsAt) : NaN;
  const repliesLeft =
    chatUsage && chatUsage.limit > 0 && !(Date.now() >= resetsAtMs)
      ? Math.max(0, chatUsage.limit - chatUsage.used)
      : null;
  const resetTime = Number.isFinite(resetsAtMs)
    ? new Date(resetsAtMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const paypal = usePayPalStatus();
  const [showPayPalCheckin, setShowPayPalCheckin] = useState(false);
  // Copy / Report reply sheet (KOVA-093) and the replies reported this session.
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    const text = inputText;
    setInputText('');
    onSendMessage(text);
  };

  const handleQuickReply = (reply: string) => {
    if (isSending) return;
    onSendMessage(reply, {
      type: 'suggested_action',
      context: 'User selected from suggested option pills',
    });
  };

  const activeGoals = savingsGoals && savingsGoals.length > 0
    ? savingsGoals.filter((g) => !g.isArchived)
    : savingsGoal && !savingsGoal.isArchived
    ? [savingsGoal]
    : [];

  return (
    <div className="flex flex-col h-app max-w-2xl mx-auto w-full px-4 relative">
      {/* Top Bar Quick Log Switcher */}
      <div className="hidden sm:flex pt-3 pb-2 items-center justify-between border-b border-[#2C2C2E]/40 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-white/70" />
          <span className="text-xs font-medium text-[#8A8A8E]">Conversational Money Companion</span>
        </div>
        <button
          onClick={() => onSelectView('log')}
          className="text-xs font-semibold text-white hover:text-white/80 transition-colors flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full border border-white/10"
        >
          <span>Log</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Conversation Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-5">
        {/* Pinned Top Goal Cards */}
        {activeGoals.length > 0 && (
          <div className="w-full mb-4 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wider">
                {activeGoals.length > 1 ? `Savings Goals (${activeGoals.length})` : 'Savings Goal'}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onAddNewGoal) onAddNewGoal();
                  else if (onEditGoal) onEditGoal();
                }}
                className="text-xs text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-1 rounded-full border border-amber-400/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Goal</span>
              </button>
            </div>

            <div className="space-y-3">
              {activeGoals.map((g, idx) => {
                const cardData: GoalCardData = {
                  id: g.id,
                  title: g.title,
                  savedAmount: g.currentAmount,
                  targetAmount: g.targetAmount || 0,
                  percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
                  timeframe: 'Month',
                  contributions: g.contributions || [],
                  nativeCurrency: g.nativeCurrency,
                  kind: g.kind,
                };
                return (
                  <GoalCard
                    key={g.id ? `goal-${g.id}-${idx}` : `goal-${g.title || 'untitled'}-${idx}`}
                    data={cardData}
                    currency={currency}
                    onEditGoal={() => onEditGoal?.(g)}
                    onOpenCoach={() => onOpenCoach?.(g)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {messages.filter((msg) => msg.text && msg.text.trim().length > 0).map((msg, index, visible) => (
          <div
            key={msg.id ? `msg-${msg.id}-${index}` : `msg-${index}`}
            className={`group/reply flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-2`}
          >
            <ChatDayDivider previous={visible[index - 1]} current={msg} />

            {/* Sender Label & Timestamp */}
            <div className={`flex items-center gap-2 text-[10px] text-[#8A8A8E] px-1 w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender === 'kova' ? (
                      <>
                        <KovaAvatar size="sm" />
                        <span className="font-semibold text-white">Kova</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                        {/* Copy / Report reply (KOVA-093). Long-press the bubble on phones. */}
                        <ReplyMoreButton onClick={() => setActionMessage(msg)} />
                      </>
                    ) : (
                      <>
                        <span>You</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </>
                    )}
                  </div>

                  {/* Bubble Content */}
                  {msg.sender === 'kova' ? (
                    <LongPressBubble
                      onLongPress={() => setActionMessage(msg)}
                      className="max-w-[85%] text-sm leading-relaxed glass-card text-white/95 p-4 rounded-[22px] rounded-tl-sm border border-white/10"
                    >
                      {msg.text}
                    </LongPressBubble>
                  ) : (
                    <div className="max-w-[85%] text-sm leading-relaxed bg-white text-black font-medium p-4 rounded-[22px] rounded-tr-sm shadow-lg">
                      {msg.text}
                    </div>
                  )}

                  {/* Extracted Expense Tag if present */}
                  {msg.extractedExpense && msg.extractedExpense.amount && (
                    <div className="glass-card rounded-2xl p-3 border border-white/15 bg-[#18181B]/90 flex items-center justify-between gap-4 max-w-[85%]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">
                            {msg.extractedExpense.label || 'New Entry'}
                          </div>
                          <div className="text-[10px] text-[#8A8A8E]">
                            {msg.extractedExpense.category || 'Logged'} • Added to Log
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-white">
                        -{formatCurrency(msg.extractedExpense.amount, currency, (msg.extractedExpense as any).nativeCurrency || currency)}
                      </div>
                    </div>
                  )}

                  {/* "Where October went" card (KOVA-080) */}
                  {msg.categoryBreakdown && msg.categoryBreakdown.rows.length > 0 && (
                    <CategoryBreakdownCard data={msg.categoryBreakdown} />
                  )}

                  {msg.affordCard && <AffordCard data={msg.affordCard} />}

                  {msg.radarCard && msg.radarCard.rows.length > 0 && <SubscriptionRadarCard data={msg.radarCard} />}

                  {/* "Ask Kova about your PayPal" (KOVA-087): what the answer is based on, and actions to confirm */}
                  {msg.paypalBasis && <p className="text-[11px] text-[#8A8A8E] px-1">{msg.paypalBasis}</p>}
                  {msg.paypalProposals && msg.paypalProposals.length > 0 && <PayPalProposalCard proposals={msg.paypalProposals} />}

                  {/* Inline Goal Card if attached to message */}
                  {msg.inlineGoalCard && (
                    <div className="w-full max-w-md my-1">
                      <GoalCard
                        data={msg.inlineGoalCard}
                        currency={currency}
                        onEditGoal={onEditGoal}
                        onOpenCoach={() => {
                          const matched = activeGoals.find((g) => g.title.toLowerCase() === msg.inlineGoalCard?.title?.toLowerCase()) || activeGoals[0];
                          if (matched) onOpenCoach?.(matched);
                        }}
                      />
                    </div>
                  )}

                  {/* Quick Reply Pills under Kova's messages */}
                  {msg.sender === 'kova' && msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 pl-1 max-w-[90%]">
                      {msg.quickReplies.map((reply, idx) => (
                        <button
                          key={`qr-${msg.id || index}-${idx}-${reply}`}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQuickReply(reply);
                          }}
                          className="glass-pill px-3.5 py-1.5 rounded-full text-xs font-medium text-white hover:bg-white hover:text-black transition-all duration-200 border border-white/15 active:scale-95 text-left cursor-pointer select-none"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

        {/* Loading / Thinking Indicator (shows immediately when isSending is true) */}
        {isSending && (messages.length === 0 || messages[messages.length - 1].sender === 'user' || !messages[messages.length - 1].text || messages[messages.length - 1].isThinking) && (
          <div className="flex items-start gap-2 text-xs text-[#8A8A8E] animate-in fade-in duration-200">
            <KovaAvatar size="sm" isPulsing={true} />
            <div className="glass-card px-4 py-3 rounded-[22px] rounded-tl-sm text-white/80 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <span>Kova is reflecting...</span>
            </div>
          </div>
        )}

        {paypal.available && showPayPalCheckin && (
          <PayPalCheckinCard
            userProfile={userProfile}
            onClose={() => setShowPayPalCheckin(false)}
          />
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Bottom Action Bar & Input */}
      <div className="py-3 pb-safe bg-gradient-to-t from-black via-black/95 to-transparent sticky bottom-0 z-30 space-y-2">
        {/* Secondary Action Buttons above input bar */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <button
            onClick={onOpenCsvImport}
            className="glass-pill px-3 py-1.5 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 border border-white/10"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white/70" />
            <span>Import CSV</span>
          </button>

          {/* Voice notes use the Web Speech API, which Android System WebView doesn't support (KOVA-051). */}
          {!Capacitor.isNativePlatform() && (
          <button
            onClick={onOpenVoiceNote}
            className="glass-pill px-3 py-1.5 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 border border-white/10"
          >
            <Mic className="w-3.5 h-3.5 text-white/70" />
            <span>Voice note</span>
          </button>
          )}

          {paypal.available && paypal.connected && (
            <button
              type="button"
              onClick={() => setShowPayPalCheckin(true)}
              className="glass-pill px-3 py-1.5 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 border border-white/10"
            >
              <Wallet className="w-3.5 h-3.5 text-white/70" />
              <span>PayPal check-in</span>
            </button>
          )}

          {/* "Ask Kova about your PayPal" (KOVA-087): starts with an example question */}
          {paypal.available && paypal.connected && (
            <button
              type="button"
              onClick={() => onSendMessage('What did I pay for on PayPal this month?')}
              disabled={isSending}
              className="glass-pill px-3 py-1.5 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 border border-white/10 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-white/70" />
              <span>Ask about PayPal</span>
            </button>
          )}
        </div>

        {repliesLeft !== null && repliesLeft <= 2 && (
          <div className="px-2 text-[11px] text-[#8A8A8E] flex flex-wrap items-center gap-x-1.5 gap-y-0.5" aria-live="polite">
            {repliesLeft > 0 ? (
              <span>
                {repliesLeft} {repliesLeft === 1 ? 'reply' : 'replies'} with Kova left today · logging is always free
              </span>
            ) : (
              <span>
                Kova's replies come back{resetTime ? ` at ${resetTime}` : ' tomorrow'} · logging still works
              </span>
            )}
            {plan !== 'premium' && (
              <button
                type="button"
                onClick={() => openPremiumUpgrade()}
                className="text-amber-300/90 hover:text-amber-200 underline underline-offset-2 cursor-pointer"
              >
                See Premium
              </button>
            )}
          </div>
        )}

        {/* Input Form Bar */}
        <form
          onSubmit={handleSubmit}
          className="glass-card rounded-full p-1.5 pl-4 border border-white/15 bg-[#161618]/90 flex items-center gap-2 shadow-2xl focus-within:border-white/30 transition-all"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Talk to Kova or log an expense..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#8A8A8E] focus:outline-none"
            disabled={isSending}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shrink-0 transition-all ${
              inputText.trim() && !isSending
                ? 'opacity-100 hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>
      </div>

      {actionMessage && (
        <ReplyActionsSheet
          messageId={actionMessage.id}
          text={actionMessage.text}
          reported={reportedIds.has(actionMessage.id)}
          onReported={(id) => setReportedIds((prev) => new Set(prev).add(id))}
          onClose={() => setActionMessage(null)}
        />
      )}
    </div>
  );
};
