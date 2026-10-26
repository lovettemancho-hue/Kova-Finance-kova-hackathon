import React, { useRef, useState } from 'react';
import { Eye, Headphones } from 'lucide-react';
import { KovaAvatar } from './KovaAvatar';

// First screen of the Android app (KOVA-096). The web keeps LandingPage, which is a marketing site
// (nav bar, long scroll); in the app a single welcome screen reads as an app, not a web page.
// Four cards, each mixing two parts of Kova (chat + logging, import + subscriptions, lessons + goals,
// a product price + a price watch), with small example figures labelled as examples.

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

// Colours follow the app: green = saved or on track, amber = worth a look. Never alarm red here.
const GREEN = 'text-[#30D158]';
const AMBER = 'text-[#FFD60A]';

const Row: React.FC<{ label: string; value: React.ReactNode; note?: string; strong?: boolean; tone?: string; noteTone?: string }> = ({
  label,
  value,
  note,
  strong,
  tone,
  noteTone,
}) => (
  <div className="flex items-baseline justify-between gap-3">
    <div className="min-w-0">
      <div className="text-[13px] text-white/85">{label}</div>
      {note && <div className={`text-[11px] ${noteTone || 'text-[#8A8A8E]'}`}>{note}</div>}
    </div>
    <div className={`text-[13px] shrink-0 ${strong ? 'font-semibold' : ''} ${tone || (strong ? 'text-white' : 'text-white/85')}`}>{value}</div>
  </div>
);

const You: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="self-end ml-auto w-fit max-w-[88%] bg-white text-black text-[13px] font-medium px-3.5 py-2 rounded-[18px] rounded-tr-sm">
    {children}
  </div>
);

const KovaSays: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-fit max-w-[92%] glass-card rounded-[18px] rounded-tl-sm border border-white/10 px-3.5 py-2.5 text-[13px] text-white/90 leading-snug">
    {children}
  </div>
);

const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 space-y-2.5">{children}</div>
);

// 1. Chat + logging: say it in plain words, Kova logs it and answers calmly.
const TalkPreview = () => (
  <div className="flex flex-col gap-2.5">
    <You>Spent 12 on lunch, feeling a bit guilty</You>
    <KovaSays>
      Logged it. You're still <span className={GREEN}>under your usual week</span>, so lunch out is fine.
    </KovaSays>
    <div className="w-fit flex items-center gap-2.5 rounded-xl border border-white/15 bg-[#18181B] px-3 py-2">
      <span className="text-[12px] text-white">Lunch</span>
      <span className="text-[11px] text-[#8A8A8E]">Dining · Added to Log</span>
      <span className={`text-[12px] font-semibold ${AMBER}`}>−$12</span>
    </div>
  </div>
);

// 2. Statement import + subscription radar: import once, Kova finds what repeats.
const ImportPreview = () => (
  <div className="flex flex-col gap-2.5">
    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#18181B] px-3 py-2.5">
      <div className="w-8 h-9 rounded-md bg-[#30D158]/10 border border-[#30D158]/30 flex items-center justify-center text-[9px] font-semibold text-[#30D158]">CSV</div>
      <div className="min-w-0">
        <div className="text-[12px] text-white truncate">bank-statement.csv</div>
        <div className="text-[11px] text-[#8A8A8E]">98 transactions · read on your phone</div>
      </div>
    </div>
    <Panel>
      <Row label="Netflix" value="$15.49 a month" note="Renews in about 2 days" noteTone={AMBER} />
      <Row label="Gym" value="$30.00 a month" note="Next around Nov 9" />
    </Panel>
    <KovaSays>
      Netflix renews in <span className={AMBER}>about 2 days</span>. Still using it?
    </KovaSays>
  </div>
);

// 3. Learning + goals: short lessons that use your own goal as the example.
const LearnPreview = () => (
  <div className="flex flex-col gap-2.5">
    <Panel>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[#8A8A8E] font-semibold">Grow · 2 min</span>
        <span className="text-[10px] text-[#8A8A8E]">Lesson</span>
      </div>
      <div className="text-[14px] font-semibold text-white">Why small amounts add up</div>
      <p className="text-[12px] text-white/75 leading-snug">
        $5 a day is about <span className={`font-semibold ${GREEN}`}>$1,800 a year</span>. Kept, not spent, it compounds.
      </p>
    </Panel>
    <Panel>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-white/85">Emergency fund</span>
        <span className="text-[13px] font-semibold text-white">
          <span className={GREEN}>$1,150</span> of $3,000
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-[38%] rounded-full bg-[#30D158]" />
      </div>
    </Panel>
  </div>
);

// 4. Ask before you buy (KOVA-104): a real price for a product, how it fits, and a price watch while you wait.
const AffordPreview = () => (
  <div className="flex flex-col gap-2.5">
    <You>Can I afford the Sony WH-1000XM6?</You>
    <Panel>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0" aria-hidden="true">
          <Headphones className="w-6 h-6 text-black" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-white truncate">Sony WH-1000XM6</div>
          <div className="text-[11px] text-[#8A8A8E]">
            <span className="text-white font-semibold">$449</span> at a store · lowest of 3
          </div>
        </div>
      </div>
      <Row
        label="This month"
        value={
          <>
            $1,968 → <span className={AMBER}>$2,417</span>
          </>
        }
        note="You usually spend about $2,050"
        strong
      />
      <Row label="Emergency fund" value="about 12 days later" strong tone={AMBER} />
    </Panel>
    <div className="w-fit flex items-center gap-2 rounded-full border border-[#30D158]/30 bg-[#30D158]/10 px-3 py-1.5">
      <Eye className={`w-3.5 h-3.5 ${GREEN}`} />
      <span className={`text-[11px] font-semibold ${GREEN}`}>I'll wait · Kova watches the price</span>
    </div>
  </div>
);

const SLIDES = [
  { title: 'Just talk to it', body: 'Log spending in plain words. Kova keeps the numbers, and the calm.', preview: <TalkPreview /> },
  { title: 'Import, then relax', body: 'Add a bank statement. Kova sorts it and flags subscriptions before they renew.', preview: <ImportPreview /> },
  { title: 'Learn as you go', body: 'Short lessons that use your own goals as the example.', preview: <LearnPreview /> },
  { title: 'Ask before you buy', body: "Kova finds today's price, shows how it fits your goals, and watches it while you wait.", preview: <AffordPreview /> },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted, onLogin }) => {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(Math.max(0, Math.min(SLIDES.length - 1, i)));
  };

  const goTo = (i: number) => {
    track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col select-none">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-6 pt-8 [@media(max-height:720px)]:pt-5">
        {/* Brand and promise */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-5 [@media(max-height:720px)]:mb-3">
            <div className="absolute -inset-8 rounded-full bg-gradient-to-tr from-white/15 via-white/5 to-transparent blur-2xl pointer-events-none" />
            <KovaAvatar size="lg" isPulsing={true} />
          </div>
          <h1 className="text-[28px] leading-tight font-serif-headline text-white [@media(max-height:720px)]:text-2xl">
            A calm companion
            <br />
            <span className="italic text-white/90">for your money.</span>
          </h1>
          <p className="mt-3 text-sm text-[#8A8A8E] leading-relaxed max-w-xs [@media(max-height:720px)]:hidden">
            Tell Kova what you spend, or import a statement. It explains, without judging.
          </p>
        </div>

        {/* Feature cards: swipe sideways */}
        <div className="flex-1 flex flex-col justify-center py-5 [@media(max-height:720px)]:py-3">
          <div
            ref={track}
            onScroll={onScroll}
            className="-mx-6 flex items-stretch overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="What Kova does"
          >
            {SLIDES.map((s, i) => (
              <section
                key={s.title}
                className="w-full shrink-0 snap-center px-6 flex"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${SLIDES.length}: ${s.title}`}
              >
                <div className="glass-card rounded-[24px] border border-white/10 bg-[#121214] p-4 flex-1 flex flex-col justify-between gap-4">
                  <div className="flex flex-col">{s.preview}</div>
                  <div className="pt-1">
                    <h2 className="text-base font-semibold text-white">{s.title}</h2>
                    <p className="text-[13px] text-[#8A8A8E] leading-relaxed mt-0.5 [@media(max-height:720px)]:hidden">{s.body}</p>
                    <p className="text-[10px] text-white/30 mt-2 [@media(max-height:720px)]:mt-1">Example</p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 pt-4">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show ${s.title}`}
                aria-current={i === active}
                className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/25'}`}
              />
            ))}
          </div>
        </div>

        {/* Actions, within thumb reach; they stay pinned to the bottom on short phones */}
        <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-5 space-y-3 [@media(max-height:720px)]:space-y-2 [@media(max-height:720px)]:pb-4 bg-gradient-to-t from-black via-black to-black/0">
          <button
            type="button"
            onClick={onGetStarted}
            className="w-full py-3.5 [@media(max-height:720px)]:py-3 rounded-full bg-white text-black text-sm font-semibold active:scale-[0.98] transition-transform shadow-[0_0_24px_rgba(255,255,255,0.15)]"
          >
            Get started
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="w-full py-3.5 [@media(max-height:720px)]:py-3 rounded-full border border-white/20 text-white text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            I already have an account
          </button>
          <p className="text-center text-[11px] text-[#8A8A8E] pt-1 [@media(max-height:720px)]:hidden">No ads. Your data stays yours.</p>
        </div>
      </div>
    </div>
  );
};
