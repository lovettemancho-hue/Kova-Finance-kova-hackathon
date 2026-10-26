import React from 'react';
import { 
  ArrowLeft, 
  MessageSquare, 
  Target, 
  Sparkles, 
  Mail, 
  Settings, 
  ChevronRight,
  BookOpen,
  ShoppingBag
} from 'lucide-react';
import { KovaAvatar } from './KovaAvatar';

interface HowToUseScreenProps {
  onBack: () => void;
  onSelectView?: (view: any) => void;
}

export const HowToUseScreen: React.FC<HowToUseScreenProps> = ({ onBack, onSelectView }) => {
  return (
    <div className="min-h-screen bg-black text-white pb-24 selection:bg-white selection:text-black">
      {/* 1. Sticky Header */}
      <div className="sticky top-0 z-30 bg-black/85 backdrop-blur-xl border-b border-white/10 px-4 py-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Settings</span>
          </button>

          <h1 className="text-sm font-semibold text-white tracking-tight">
            How to use Kova
          </h1>

          <div className="w-16 flex justify-end">
            <span className="text-[11px] font-mono font-medium text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              Guide
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6 sm:space-y-8">
        
        {/* Intro Tagline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Quick-Reference Tour</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-fraunces font-normal text-white tracking-tight">
            Getting the most out of Kova.
          </h2>
          <p className="text-xs sm:text-sm text-[#8A8A8E] leading-relaxed">
            A fast overview of how Kova turns your daily spending into effortless awareness and mindful growth.
          </p>
        </div>

        {/* Section 1: Talk to Kova */}
        <section className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#8A8A8E] uppercase tracking-wider">Step 01</span>
              <h3 className="text-base font-semibold text-white">Talk to Kova</h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#D1D1D6] leading-relaxed">
            Tell Kova about your spending in plain language — she logs it, categorizes it, and remembers it. Try <span className="text-white font-medium">"spent $20 on lunch"</span> or just ask a question.
          </p>

          {/* Example Chat Bubble Snippet */}
          <div className="rounded-2xl bg-black/50 border border-white/5 p-3.5 space-y-2.5">
            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-white text-black px-3.5 py-2 rounded-2xl rounded-tr-xs text-xs font-medium max-w-[80%] shadow-sm">
                spent $20 on lunch
              </div>
            </div>

            {/* Kova response */}
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 mt-0.5">
                <KovaAvatar size="sm" isPulsing={false} />
              </div>
              <div className="space-y-1.5 max-w-[85%]">
                <div className="bg-[#1C1C1E] border border-white/10 text-white px-3.5 py-2 rounded-2xl rounded-tl-xs text-xs leading-relaxed">
                  Logged $20 for <span className="text-amber-300 font-medium">Dining out</span>. I've updated your rhythm for today.
                </div>
                <div className="flex gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-[#8A8A8E] bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    How is my daily budget?
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Set and grow a goal */}
        <section className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-300 shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#8A8A8E] uppercase tracking-wider">Step 02</span>
              <h3 className="text-base font-semibold text-white">Set and grow a goal</h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#D1D1D6] leading-relaxed">
            Tap <span className="text-white font-semibold">"+ Add Goal"</span> to set a real target. Log income and Kova will ask if you want to put it toward your goal — watch the progress ring update instantly. Premium unlocks tracking multiple goals at once, plus a dedicated coaching thread for each one.
          </p>
        </section>

        {/* Section 3: Grow, daily */}
        <section className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#8A8A8E] uppercase tracking-wider">Step 03</span>
              <h3 className="text-base font-semibold text-white">Grow, daily</h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#D1D1D6] leading-relaxed">
            Visit the Grow tab for a fresh financial literacy lesson every day, your consistency rhythm, and quiet milestones as you go. Tap <span className="text-white font-semibold">"Explore a topic"</span> to start a conversation on anything from compounding to how banks make money — 50 topics free, 200+ with Premium.
          </p>
        </section>

        {/* Section 4: Your monthly letter */}
        <section className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-400/10 border border-indigo-400/20 flex items-center justify-center text-indigo-300 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#8A8A8E] uppercase tracking-wider">Step 04</span>
              <h3 className="text-base font-semibold text-white">Your monthly letter</h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#D1D1D6] leading-relaxed">
            At the end of each month, Kova writes you a real reflection — what she noticed, one small suggestion, and a book pick chosen for you. Download it as a PDF or find past letters in your archive (Premium).
          </p>
        </section>

        {/* Section 5: Ask before you buy (KOVA-104) */}
        <section className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-300 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#8A8A8E] uppercase tracking-wider">Step 05</span>
              <h3 className="text-base font-semibold text-white">Ask before you buy</h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#D1D1D6] leading-relaxed">
            Ask <span className="text-white font-medium">"Can I afford the Sony WH-1000XM6?"</span> and Kova finds today's price across stores, then shows how it fits your month and your goals. Not sure yet? Tap <span className="text-white font-semibold">"I'll wait"</span> and Kova watches the price for 30 days, telling you only if it drops. You can also type your own price with <span className="text-white font-semibold">"Use a different price"</span>.
          </p>
        </section>

        {/* Section 6: Make it yours */}
        <section className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] space-y-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-[#8A8A8E] uppercase tracking-wider">Step 06</span>
              <h3 className="text-base font-semibold text-white">Make it yours</h3>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#D1D1D6] leading-relaxed">
            In Settings, set your currency, choose how direct or gentle you want Kova to sound, and manage your data anytime.
          </p>
        </section>

        {/* Bottom CTA / Return Button */}
        <div className="pt-2">
          <button
            onClick={onBack}
            className="w-full py-3.5 rounded-full bg-white text-black font-semibold text-xs transition-all hover:bg-white/90 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <span>Back to Settings</span>
          </button>
        </div>

      </div>
    </div>
  );
};
