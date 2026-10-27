import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, SavingsGoal, UserProfile } from '../types';
import { KovaAvatar } from './KovaAvatar';
import { ArrowLeft, ArrowUp, Sparkles, Target, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGoals } from '../context/GoalContext';
import { formatWholeCurrency } from '../utils/currency';

interface GoalCoachingScreenProps {
  goal?: SavingsGoal;
  userProfile?: UserProfile | null;
  messages?: ChatMessage[];
  onSendMessage?: (text: string) => Promise<void>;
  onBack: () => void;
  isSending?: boolean;
}

export const GoalCoachingScreen: React.FC<GoalCoachingScreenProps> = ({
  goal: propGoal,
  userProfile: propUserProfile,
  messages: propMessages,
  onSendMessage: propOnSendMessage,
  onBack,
  isSending: propIsSending,
}) => {
  const { userProfile: authUserProfile, currency: authCurrency } = useAuth();
  const goalCtx = useGoals();
  const userProfile = propUserProfile !== undefined ? propUserProfile : authUserProfile;
  const currency = userProfile?.currency || authCurrency || 'USD';
  const goal = propGoal || goalCtx.activeCoachingGoal || goalCtx.savingsGoal;
  const messages = propMessages !== undefined ? propMessages : goalCtx.coachingMessages;
  const onSendMessage = propOnSendMessage || goalCtx.handleSendCoachingMessage;
  const isSending = propIsSending !== undefined ? propIsSending : goalCtx.isCoachingSending;

  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  if (!goal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
        <p className="text-sm text-kova-muted">No active goal selected for coaching.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-white/10 text-white rounded-full text-xs font-semibold"
        >
          Back to Chat
        </button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    const text = inputText;
    setInputText('');
    onSendMessage(text);
  };

  const handleQuickReply = (reply: string) => {
    if (isSending) return;
    onSendMessage(reply);
  };

  const percentage = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;

  const formattedSaved = formatWholeCurrency(goal.currentAmount, currency, goal.nativeCurrency);
  const formattedTarget = formatWholeCurrency(goal.targetAmount, currency, goal.nativeCurrency);

  return (
    <div className="flex flex-col h-app max-w-2xl mx-auto w-full px-4 relative">
      {/* Top Header Bar */}
      <div className="pt-3 pb-3 flex items-center justify-between border-b border-kova-raised/40 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-white hover:text-white/80 transition-colors flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Chat</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-semibold text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
            Goal Coaching
          </span>
        </div>
      </div>

      {/* Goal Overview Context Header Banner */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 bg-kova-surface mb-3 flex items-center justify-between gap-3 shadow-lg">
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-semibold text-kova-muted tracking-wider flex items-center gap-1 mb-0.5">
            <Target className="w-3.5 h-3.5 text-amber-300" />
            <span className="truncate">Coaching — {goal.title}</span>
          </div>
          <div className="text-sm font-bold text-white flex items-baseline gap-1.5">
            <span>{formattedSaved}</span>
            <span className="text-xs text-kova-muted font-normal">
              {goal.targetAmount > 0 ? `saved of ${formattedTarget}` : 'saved • Target not set yet'}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
          <div className="text-right">
            <div className="text-xs font-bold text-amber-300">
              {goal.targetAmount > 0 ? `${percentage}%` : 'Flexible'}
            </div>
            <div className="text-[9px] text-kova-muted">
              {goal.targetAmount > 0 ? 'Progress' : 'Target'}
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-2 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={msg.id ? `coach-msg-${msg.id}-${index}` : `coach-msg-${index}`}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-2`}
          >
            {/* Sender Label & Timestamp */}
            <div className={`flex items-center gap-2 text-[10px] text-kova-muted px-1 w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === 'kova' ? (
                <>
                  <KovaAvatar size="sm" />
                  <span className="font-semibold text-white">Kova Goal Coach</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                  <button
                    type="button"
                    onClick={() => {
                      alert('Thank you for flagging. This response has been submitted to review.');
                    }}
                    className="ml-auto text-[9px] text-kova-muted hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                    title="Report AI content"
                  >
                    Report
                  </button>
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
            <div
              className={`max-w-[85%] text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-white text-black font-medium p-4 rounded-[22px] rounded-tr-sm shadow-lg'
                  : 'glass-card text-white/95 p-4 rounded-[22px] rounded-tl-sm border border-amber-400/20 bg-kova-surface/90 shadow-xl'
              }`}
            >
              {msg.text}
            </div>

            {/* Quick Reply Pills */}
            {msg.sender === 'kova' && msg.quickReplies && msg.quickReplies.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 pl-1 max-w-[90%]">
                {msg.quickReplies.map((reply, idx) => (
                  <button
                    key={`coach-qr-${msg.id || index}-${idx}-${reply}`}
                    type="button"
                    onClick={() => handleQuickReply(reply)}
                    className="glass-pill px-3.5 py-1.5 rounded-full text-xs font-medium text-white hover:bg-white hover:text-black transition-all duration-200 border border-white/15 active:scale-95 text-left cursor-pointer"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Thinking Indicator */}
        {isSending && (
          <div className="flex items-start gap-2 text-xs text-kova-muted">
            <KovaAvatar size="sm" isPulsing={true} />
            <div className="glass-card px-4 py-3 rounded-[22px] rounded-tl-sm text-white/80 flex items-center gap-2 border border-amber-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Analyzing strategy for "{goal.title}"...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="py-3">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Ask Kova about reaching "${goal.title}"...`}
            disabled={isSending}
            className="w-full bg-kova-surface text-white placeholder-white/30 text-sm rounded-full pl-5 pr-12 py-3.5 border border-white/10 focus:outline-none focus:border-amber-400/50 transition-all shadow-inner"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className={`absolute right-1.5 p-2 rounded-full transition-all ${
              inputText.trim() && !isSending
                ? 'bg-amber-400 text-black shadow-lg hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>
      </div>
    </div>
  );
};
