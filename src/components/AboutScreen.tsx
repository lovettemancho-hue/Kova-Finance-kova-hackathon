import React from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  MessageSquare, 
  BookOpen, 
  Compass, 
  Heart,
  ShoppingBag
} from 'lucide-react';
import { ViewMode } from '../types';
import { AboutBankScene } from './AboutBankScene';

interface AboutScreenProps {
  onBack: () => void;
  onSelectView?: (view: ViewMode) => void;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-black text-white pb-24 selection:bg-white selection:text-black">
      {/* 1. Top Header */}
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
            About Kova
          </h1>

          <div className="w-12 flex justify-end">
            <span className="text-[11px] font-mono font-medium text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              v1.2.0
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-10">
        {/* 2. Hero Animation: Bank & Floating Coins (Visual Centerpiece) */}
        <section className="space-y-4">
          <div className="relative">
            <AboutBankScene className="h-64 sm:h-80 w-full" interactive={true} />
          </div>
        </section>

        {/* 3. Why Kova exists */}
        <section className="glass-card rounded-[28px] p-6 sm:p-8 border border-white/10 bg-[#141416] space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <Compass className="w-4 h-4" />
            <span>Mission</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-fraunces font-normal text-white tracking-tight leading-tight">
            Why Kova exists
          </h2>

          <div className="text-sm sm:text-base text-[#D1D1D6] font-sans font-normal leading-relaxed space-y-4">
            <p>
              Money is one of the most stressful parts of life, and most budgeting apps make it heavier. They feel like a test you're failing: red numbers, guilt, and rules that don't fit your real week.
            </p>
            <p>
              Kova is a companion instead. It talks with you about money the way a calm, financially literate friend would: it keeps track of the numbers, never shames a rough week, and explains how money actually works, so each decision gets a little easier.
            </p>
          </div>
        </section>

        {/* 4. How Kova works — recap cards */}
        <section className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-white/60" />
              <span>How Kova Works</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif-headline font-semibold text-white">
              Four ways Kova helps.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3.5 pt-1">
            {/* Card 1: Speak naturally */}
            <div className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0 mt-0.5">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">Speak naturally</h3>
                <p className="text-xs sm:text-sm text-[#8A8A8E] leading-relaxed">
                  Log spending in plain sentences or audio voice notes. No rigid forms, no endless drop-downs, no manual spreadsheet overhead.
                </p>
              </div>
            </div>

            {/* Card 2: Grow, daily */}
            <div className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">Grow, daily</h3>
                <p className="text-xs sm:text-sm text-[#8A8A8E] leading-relaxed">
                  60-second micro-lessons that turn financial psychology into lasting instinct. Learn the mental models used by truly autonomous builders.
                </p>
              </div>
            </div>

            {/* Card 3: A letter, every month */}
            <div className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-400/10 border border-indigo-400/20 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">A letter, every month</h3>
                <p className="text-xs sm:text-sm text-[#8A8A8E] leading-relaxed">
                  A personalized, written debrief analyzing your real patterns and pairing your month with curated book recommendations.
                </p>
              </div>
            </div>

            {/* Card 4: Ask before you buy (KOVA-101) */}
            <div className="glass-card rounded-[24px] p-5 sm:p-6 border border-white/10 bg-[#161618] flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">Ask before you buy</h3>
                <p className="text-xs sm:text-sm text-[#8A8A8E] leading-relaxed">
                  Ask "Can I afford the Sony WH-1000XM5?" and Kova finds today's price across stores, then shows how it fits your month and your goals. Tap "I'll wait" and Kova watches the price, telling you only if it drops. Product prices come from Channel3. The choice stays yours.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Who Kova is for */}
        <section className="glass-card rounded-[28px] p-6 sm:p-8 border border-white/10 bg-[#161618] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8A8A8E] uppercase tracking-wider">
            <Heart className="w-4 h-4 text-rose-400/80" />
            <span>Who Kova is for</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-serif-headline font-semibold text-white">
            Built for clarity, not judgment.
          </h2>

          <p className="text-sm sm:text-base text-[#D1D1D6] font-normal leading-relaxed pt-1">
            Kova is for anyone who's tried a budgeting app and quit — not because they didn't care, but because the tools made money feel like a test. It's for people who want to actually understand how wealth works, not just track where it went. If you've ever avoided checking your balance because it felt like a judgment, Kova was built for you.
          </p>
        </section>

        {/* 6. Regulatory & Financial Disclaimer */}
        <section className="rounded-2xl p-4 sm:p-5 border border-white/5 bg-[#121214] text-center space-y-1.5">
          <p className="text-[11px] font-medium text-[#8A8A8E] uppercase tracking-wider">
            Educational Disclaimer
          </p>
          <p className="text-xs text-[#8A8A8E] leading-relaxed max-w-xl mx-auto">
            Kova is an educational companion and reflective awareness tool, not a registered investment advisor, broker-dealer, or certified financial planner. All insights, coaching prompts, and monthly briefings are provided for informational and educational purposes only and should not be construed as individualized legal, tax, or investment advice.
          </p>
        </section>

        {/* 7. Version & footer */}
        <section className="pt-2 pb-2 text-center">
          <p className="text-[11px] text-white/40 font-mono">
            Kova Financial Companion · v1.2.0
          </p>
        </section>
      </div>
    </div>
  );
};
