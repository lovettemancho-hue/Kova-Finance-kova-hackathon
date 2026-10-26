import React from 'react';
import { KovaAvatar } from './KovaAvatar';
import { CalmTreeScene } from './CalmTreeScene';
import { ViewMode } from '../types';
import { MessageSquare, BarChart3, Mail, ArrowRight, Sparkles, BookOpen, ShieldCheck, ShoppingBag, Eye, Headphones } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
  onOpenAbout?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin, onOpenAbout }) => {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black overflow-x-hidden font-sans pb-20">
      {/* Top Floating Navigation Header */}
      <header className="sticky top-0 z-40 w-full bg-black/80 backdrop-blur-xl border-b border-[#2C2C2E]/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KovaAvatar size="sm" isPulsing={true} />
          <span className="text-base font-bold tracking-tight text-white">Kova</span>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenAbout && (
            <button
              onClick={onOpenAbout}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium text-[#8A8A8E] hover:text-white transition-colors cursor-pointer"
            >
              About
            </button>
          )}
          <button
            onClick={onLogin}
            className="px-4 py-1.5 rounded-full text-xs font-semibold text-white hover:text-white/80 border border-white/20 transition-all hover:bg-white/5 active:scale-95 cursor-pointer"
          >
            Log in
          </button>
          <button
            onClick={onGetStarted}
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-white/90 transition-all active:scale-95 shadow-md cursor-pointer"
          >
            Get started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-12 pb-16 max-w-2xl mx-auto text-center flex flex-col items-center">
        {/* Animated Background Glowing Radial Ring behind Avatar */}
        <div className="relative mb-6">
          <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-white/20 via-white/10 to-transparent blur-2xl animate-pulse pointer-events-none" />
          <KovaAvatar size="lg" isPulsing={true} />
        </div>

        {/* Large Headline */}
        <h1 className="text-3xl sm:text-5xl font-serif-headline font-normal tracking-tight text-white leading-tight mb-4 max-w-xl">
          A financial companion. <br />
          <span className="italic text-white/90">Not a finance app.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-sm sm:text-base text-[#8A8A8E] font-normal leading-relaxed max-w-lg mb-6">
          Kova talks with you about your money, remembers how it feels, and teaches you how wealth actually works — one conversation at a time.
        </p>

        {/* Stacked Parallax Card Preview Showcase */}
        <div className="w-full max-w-xl mx-auto relative my-2">
          <div className="relative w-full py-4 flex flex-col items-center">
            {/* Rotated Back Card: Saved Goal Preview */}
            <div className="w-full glass-card rounded-[24px] p-5 border border-white/10 shadow-2xl transform -rotate-3 translate-y-3 opacity-80 hover:rotate-0 hover:opacity-100 transition-all duration-500 cursor-pointer">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider font-semibold">
                  Saved This Month
                </span>
                <span className="text-xs font-bold text-[#30D158] bg-[#30D158]/10 px-2 py-0.5 rounded-full">
                  75% Completed
                </span>
              </div>
              <div className="text-2xl font-bold text-white">$25,999.00</div>
              {/* Mini SVG line */}
              <div className="h-10 w-full mt-2">
                <svg viewBox="0 0 300 40" className="w-full h-full">
                  <path d="M 0 35 Q 75 10, 150 25 T 300 5" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                </svg>
              </div>
            </div>

            {/* Rotated Foreground Card: Chat & Log snippet */}
            <div className="w-full glass-card rounded-[24px] p-5 border border-white/20 shadow-2xl transform rotate-2 -translate-y-4 hover:rotate-0 transition-all duration-500 bg-[#1A1A1D]/95 relative z-10">
              <div className="flex items-center gap-2.5 mb-3">
                <KovaAvatar size="sm" />
                <div>
                  <span className="text-xs font-bold text-white block leading-none">Kova</span>
                  <span className="text-[10px] text-[#8A8A8E]">here since this morning</span>
                </div>
              </div>

              <p className="text-xs text-white/90 leading-relaxed glass-card p-3 rounded-2xl border border-white/10 mb-3">
                "Good evening. You logged $45 for groceries earlier — right on pace with your gentle weekly target."
              </p>

              <div className="flex items-center justify-between text-xs text-[#8A8A8E] border-t border-white/5 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#30D158]" />
                  <span className="text-white font-medium">Winter coat ($300.00)</span>
                </div>
                <span className="text-[#FF6B6B] text-[10px] bg-[#FF3B30]/10 px-2 py-0.5 rounded-full">
                  higher than usual
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Buttons - Single Horizontal Line */}
        <div className="flex flex-row items-center justify-center gap-3 w-full mt-6">
          <button
            onClick={onGetStarted}
            className="px-6 sm:px-8 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all duration-200 active:scale-95 shadow-[0_0_24px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
          >
            <span>Get started</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>

          <button
            onClick={onLogin}
            className="px-6 sm:px-8 py-3.5 rounded-full bg-transparent text-white text-sm font-medium border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-200 active:scale-95"
          >
            Log in
          </button>
        </div>
      </section>

      {/* 2. New Section: "More than budgeting" */}
      <section className="px-6 py-12 max-w-2xl mx-auto border-t border-white/10 my-4 space-y-8">
        {/* Copy */}
        <div className="space-y-3 text-center md:text-left max-w-xl mx-auto">
          <span className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-widest block">
            More than budgeting
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif-headline font-normal text-white leading-snug">
            This isn't another budgeting app.
          </h2>
          <p className="text-sm sm:text-base text-[#8A8A8E] leading-relaxed font-normal">
            Kova teaches the mental models that financially free people actually use — how compounding works, the difference between assets and liabilities, how credit and inflation really function. Not generic tips. Real financial literacy, shaped around your life.
          </p>
        </div>

        {/* Calm Tree Scene with Seated Figure & Steady Growth */}
        <div className="max-w-xl mx-auto">
          <CalmTreeScene />
        </div>
      </section>

      {/* How It Works Pillar Section */}
      <section className="px-6 py-12 max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <span className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-widest block mb-1">
            How Kova Works
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif-headline font-normal text-white">
            Four simple rhythms
          </h2>
        </div>

        {/* Pillar 1: Conversational Log */}
        <div className="glass-card rounded-[24px] p-6 border border-white/10 bg-[#161618]/90 space-y-4 hover:border-white/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">1. Speak naturally</h3>
              <p className="text-xs text-[#8A8A8E]">
                Enter expenses conversationally, by voice note, or bank CSV import.
              </p>
            </div>
          </div>

          <div className="bg-[#101012] p-3.5 rounded-2xl border border-white/5 flex items-center justify-between text-xs">
            <span className="text-white/80">"Spent $14.50 on latte and almond milk"</span>
            <span className="text-[#30D158] font-bold shrink-0">Logged -$14.50</span>
          </div>
        </div>

        {/* Pillar 2: Grow, Daily */}
        <div className="glass-card rounded-[24px] p-6 border border-white/10 bg-[#161618]/90 space-y-4 hover:border-white/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">2. Grow, daily</h3>
              <p className="text-xs text-[#8A8A8E]">
                Kova tracks your rhythm gently — never a streak to break — and teaches you one real financial concept a day, chosen for where you are.
              </p>
            </div>
          </div>

          <div className="bg-[#101012] p-3.5 rounded-2xl border border-white/5 space-y-1 text-xs">
            <div className="flex items-center justify-between text-[10px] text-[#8A8A8E] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-white/80" />
                <span>Today's Lesson</span>
              </div>
              <span className="text-[#30D158]">60 sec read</span>
            </div>
            <p className="text-white/90 font-medium truncate">
              The Silent Buffer: Aligning short-term cash flow with long-term assets...
            </p>
          </div>
        </div>

        {/* Pillar 3: Monthly Letter */}
        <div className="glass-card rounded-[24px] p-6 border border-white/10 bg-[#161618]/90 space-y-4 hover:border-white/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">3. A letter, every month</h3>
              <p className="text-xs text-[#8A8A8E]">
                Once a month Kova writes a personal letter with observations and a tailored book pick.
              </p>
            </div>
          </div>

          <div className="bg-[#101012] p-3.5 rounded-2xl border border-white/5 space-y-1.5 text-xs">
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-white/70 shrink-0" />
              <div className="min-w-0">
                <span className="text-white font-medium block">March Letter + "Die With Zero" recommendation</span>
                <span className="text-[10px] text-[#8A8A8E]">Tailored to your current savings pace</span>
              </div>
            </div>
            <div className="text-[10px] text-[#8A8A8E] border-t border-white/5 pt-1.5 text-right italic">
              Also available as a downloadable PDF report.
            </div>
          </div>
        </div>

        {/* Pillar 4: Ask before you buy (KOVA-104) */}
        <div className="glass-card rounded-[24px] p-6 border border-white/10 bg-[#161618]/90 space-y-4 hover:border-white/20 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">4. Ask before you buy</h3>
              <p className="text-xs text-[#8A8A8E]">
                Ask about any product. Kova finds today's price across stores, shows how it fits your month and goals, and watches the price if you decide to wait.
              </p>
            </div>
          </div>

          <div className="bg-[#101012] p-3.5 rounded-2xl border border-white/5 flex items-center gap-3 text-xs">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0" aria-hidden="true">
              <Headphones className="w-5 h-5 text-black" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-white font-medium block truncate">"Can I afford the Sony WH-1000XM6?"</span>
              <span className="text-[10px] text-[#8A8A8E]">Example · prices via Channel3</span>
            </div>
            <span className="text-[#30D158] font-bold shrink-0 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" /> Watching
            </span>
          </div>
        </div>
      </section>

      {/* 4. New Section: "What you'll actually learn" */}
      <section className="px-6 py-10 max-w-2xl mx-auto text-center space-y-6">
        <span className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-widest block">
          Financial literacy pillars Kova teaches over time
        </span>

        <div className="flex flex-wrap justify-center gap-2.5 max-w-xl mx-auto">
          {[
            'Assets vs. liabilities',
            'How compounding really works',
            'Credit, tax & inflation, explained',
            'How financially free people think about risk',
            'Ownership vs. consumption',
            'Multiple income streams',
          ].map((pillar, i) => (
            <div
              key={i}
              className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/15 transition-all hover:scale-105 shadow-sm flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
              <span>{pillar}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Meet Kova Section */}
      <section className="px-6 py-12 max-w-2xl mx-auto">
        <div className="glass-card rounded-[28px] p-8 border border-white/15 bg-gradient-to-b from-[#1C1C1F] to-[#121214] text-center space-y-5 relative overflow-hidden shadow-2xl">
          <div className="flex justify-center items-center gap-3">
            <KovaAvatar size="lg" isPulsing={true} />
            {/* Subtle line-art phone/chat-bubble motif near avatar */}
            <div className="w-8 h-8 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/70">
              <MessageSquare className="w-4 h-4 stroke-[1.5]" />
            </div>
          </div>

          <h3 className="text-2xl font-serif-headline text-white font-normal">
            Meet Kova
          </h3>

          <p className="text-sm text-[#8A8A8E] leading-relaxed max-w-lg mx-auto font-normal">
            Kova is designed to sit quietly in your pocket. Not like a bank demanding attention or sending anxious alerts, but like a thoughtful friend who understands that money is deeply tied to mood, stress, and life goals.
          </p>

          {/* Animated Typing Indicator */}
          <div className="inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10 text-xs text-[#8A8A8E]">
            <span className="text-white font-medium">Kova is reflecting</span>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA Section */}
      <section className="px-6 py-12 max-w-lg mx-auto text-center space-y-4">
        <h3 className="text-2xl font-serif-headline text-white">
          Ready for a calmer relationship with money?
        </h3>

        <button
          onClick={onGetStarted}
          className="px-8 py-3.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all duration-200 active:scale-95 shadow-[0_0_24px_rgba(255,255,255,0.4)] inline-flex items-center gap-2"
        >
          <span>Get started with Kova</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>

        <p className="text-xs text-[#8A8A8E] flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-white/70" />
          <span>No shame, no spreadsheets — just a conversation.</span>
        </p>

        {onOpenAbout && (
          <div className="pt-4">
            <button
              onClick={onOpenAbout}
              className="text-xs text-[#8A8A8E] hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
            >
              Why Kova exists · Mission & Architecture →
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
