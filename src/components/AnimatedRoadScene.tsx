import React from 'react';

export const AnimatedRoadScene: React.FC = () => {
  return (
    <div className="kova-keep-dark relative w-full overflow-hidden rounded-[24px] border border-white/15 bg-[#0C0912] shadow-2xl h-52 sm:h-56 select-none">
      {/* 1. SKY & SUN BACKGROUND (STATIC / ULTRA-SLOW DRIFT) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#140F20] via-[#100B1A] to-[#0A0711]">
        {/* Amber Sun with Soft Glow Aura */}
        <div className="absolute right-12 top-8 sm:right-24 sm:top-10 flex items-center justify-center pointer-events-none">
          <div className="w-28 h-28 rounded-full bg-[#FF9500]/15 blur-xl absolute" />
          <div className="w-16 h-16 rounded-full bg-[#FF9500]/30 blur-md absolute" />
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF9500] to-[#FFC043] shadow-[0_0_25px_rgba(255,149,0,0.8)] relative" />
        </div>

        {/* Ultra-slow Clouds */}
        <div className="absolute top-4 left-0 w-[200%] h-20 flex animate-scroll-clouds pointer-events-none opacity-40">
          <svg className="w-1/2 h-full" viewBox="0 0 800 100" fill="none" preserveAspectRatio="none">
            <path d="M 50 40 Q 70 20 100 30 Q 130 15 170 30 Q 190 25 210 40 Z" fill="#2E243B" opacity="0.5" />
            <path d="M 350 50 Q 370 28 400 38 Q 440 20 480 38 Q 500 30 520 50 Z" fill="#2E243B" opacity="0.4" />
            <path d="M 620 35 Q 640 18 670 25 Q 700 10 740 28 Q 760 20 780 35 Z" fill="#2E243B" opacity="0.5" />
          </svg>
          <svg className="w-1/2 h-full" viewBox="0 0 800 100" fill="none" preserveAspectRatio="none">
            <path d="M 50 40 Q 70 20 100 30 Q 130 15 170 30 Q 190 25 210 40 Z" fill="#2E243B" opacity="0.5" />
            <path d="M 350 50 Q 370 28 400 38 Q 440 20 480 38 Q 500 30 520 50 Z" fill="#2E243B" opacity="0.4" />
            <path d="M 620 35 Q 640 18 670 25 Q 700 10 740 28 Q 760 20 780 35 Z" fill="#2E243B" opacity="0.5" />
          </svg>
        </div>
      </div>

      {/* 2. MIDGROUND TREELINE (PARALLAX LAYER - SCROLLS RIGHT TO LEFT) */}
      <div className="absolute bottom-16 left-0 w-[200%] h-36 flex animate-scroll-treeline pointer-events-none">
        {/* Segment 1 */}
        <div className="w-1/2 h-full relative">
          <svg className="w-full h-full" viewBox="0 0 800 140" fill="none" preserveAspectRatio="none">
            {/* Organic Muted Plum Treeline Silhouette - Irregular spacing & heights */}
            <path d="M 0 140 L 0 100 L 15 80 L 30 100 L 45 65 L 60 100 L 80 110 L 100 70 L 120 110 L 140 85 L 160 110 L 190 55 L 210 110 L 240 75 L 270 110 L 300 90 L 320 60 L 340 110 L 380 50 L 410 110 L 440 80 L 470 110 L 500 65 L 530 110 L 570 45 L 600 110 L 630 85 L 660 110 L 700 55 L 730 110 L 760 70 L 780 100 L 800 140 Z" fill="#21182C" />
            <path d="M 0 140 L 0 110 L 25 85 L 50 110 L 85 70 L 110 110 L 150 60 L 180 110 L 225 80 L 260 110 L 310 50 L 350 110 L 395 75 L 430 110 L 485 55 L 520 110 L 580 70 L 620 110 L 675 60 L 710 110 L 765 80 L 800 140 Z" fill="#2E233D" />
            <path d="M 0 140 L 0 120 Q 20 95 40 120 Q 70 85 100 120 Q 140 90 180 120 Q 220 80 260 120 Q 310 95 360 120 Q 410 85 460 120 Q 520 90 580 120 Q 640 80 700 120 Q 750 100 800 140 Z" fill="#3B2E4D" opacity="0.8" />
          </svg>
        </div>

        {/* Segment 2 (Identical for Seamless Loop) */}
        <div className="w-1/2 h-full relative">
          <svg className="w-full h-full" viewBox="0 0 800 140" fill="none" preserveAspectRatio="none">
            <path d="M 0 140 L 0 100 L 15 80 L 30 100 L 45 65 L 60 100 L 80 110 L 100 70 L 120 110 L 140 85 L 160 110 L 190 55 L 210 110 L 240 75 L 270 110 L 300 90 L 320 60 L 340 110 L 380 50 L 410 110 L 440 80 L 470 110 L 500 65 L 530 110 L 570 45 L 600 110 L 630 85 L 660 110 L 700 55 L 730 110 L 760 70 L 780 100 L 800 140 Z" fill="#21182C" />
            <path d="M 0 140 L 0 110 L 25 85 L 50 110 L 85 70 L 110 110 L 150 60 L 180 110 L 225 80 L 260 110 L 310 50 L 350 110 L 395 75 L 430 110 L 485 55 L 520 110 L 580 70 L 620 110 L 675 60 L 710 110 L 765 80 L 800 140 Z" fill="#2E233D" />
            <path d="M 0 140 L 0 120 Q 20 95 40 120 Q 70 85 100 120 Q 140 90 180 120 Q 220 80 260 120 Q 310 95 360 120 Q 410 85 460 120 Q 520 90 580 120 Q 640 80 700 120 Q 750 100 800 140 Z" fill="#3B2E4D" opacity="0.8" />
          </svg>
        </div>
      </div>

      {/* 3. FOREGROUND ROAD & LANE DASHES (SCROLLS 3X FASTER) */}
      <div className="absolute bottom-0 left-0 w-full h-20 bg-[#141417] border-t-2 border-[#2C2C32] overflow-hidden">
        {/* Animated Road Surface + Scrolling Dashed Lines */}
        <div className="w-[200%] h-full flex animate-scroll-road">
          {/* Road Segment 1 */}
          <div className="w-1/2 h-full relative">
            {/* Top Curb Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/20" />

            {/* Center Dashed Lane Marks */}
            <div className="absolute top-[48%] left-0 right-0 h-[3px] flex justify-between px-2">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="w-10 h-full bg-gradient-to-r from-white/70 to-[#FFB020]/90 rounded-sm shadow-[0_0_8px_rgba(255,176,32,0.6)]" />
              ))}
            </div>

            {/* Bottom Edge Line */}
            <div className="absolute bottom-[2px] left-0 right-0 h-[1.5px] bg-white/10" />
          </div>

          {/* Road Segment 2 (Identical for Seamless Loop) */}
          <div className="w-1/2 h-full relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/20" />
            <div className="absolute top-[48%] left-0 right-0 h-[3px] flex justify-between px-2">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="w-10 h-full bg-gradient-to-r from-white/70 to-[#FFB020]/90 rounded-sm shadow-[0_0_8px_rgba(255,176,32,0.6)]" />
              ))}
            </div>
            <div className="absolute bottom-[2px] left-0 right-0 h-[1.5px] bg-white/10" />
          </div>
        </div>
      </div>

      {/* 4. CAR LAYER (FIXED HORIZONTALLY, FACING RIGHT WITH HEADLIGHT BEAM & GENTLE VERTICAL BOB) */}
      <div className="absolute bottom-[18px] left-[28%] sm:left-[35%] z-20 pointer-events-none animate-car-bob">
        <div className="relative">
          {/* Headlight Beam extending forward (RIGHT) onto the road */}
          <div className="absolute left-[88px] top-[14px] w-48 sm:w-64 h-12 bg-gradient-to-r from-[#FFD066]/70 via-[#FF9500]/25 to-transparent clip-triangle pointer-events-none blur-[1px]"
               style={{ clipPath: 'polygon(0 30%, 100% 0, 100% 100%, 0 70%)' }} />

          {/* Car SVG Art (Facing RIGHT) */}
          <svg className="w-28 sm:w-32 h-14" viewBox="0 0 120 50" fill="none">
            {/* Car Shadow on Road */}
            <ellipse cx="60" cy="46" rx="52" ry="4" fill="#000000" opacity="0.85" />

            {/* Main Car Body - Sleek Matte Charcoal Silhouette */}
            <path
              d="M 12 36 Q 10 32 15 28 L 30 22 Q 42 10 65 10 L 88 16 Q 105 20 112 30 L 116 36 Q 118 40 110 42 L 15 42 Q 10 42 12 36 Z"
              fill="#26262B"
              stroke="#404048"
              strokeWidth="1"
            />

            {/* Car Roof / Cabin Top Highlight */}
            <path
              d="M 33 22 Q 44 12 65 12 L 86 17 L 98 25 L 33 22 Z"
              fill="#36363E"
            />

            {/* Side Windows with Warm Reflection */}
            <path
              d="M 36 21 Q 45 14 62 14 L 62 23 L 36 21 Z"
              fill="#0D0D10"
              stroke="#555560"
              strokeWidth="0.8"
            />
            <path
              d="M 66 14 L 83 18 L 88 24 L 66 23 Z"
              fill="#0D0D10"
              stroke="#555560"
              strokeWidth="0.8"
            />
            {/* Window Glass Reflection Line */}
            <line x1="42" y1="20" x2="58" y2="16" stroke="#FFFFFF" strokeWidth="1" opacity="0.3" />

            {/* Front Headlight (RIGHT) - Glowing Amber */}
            <path d="M 112 32 L 117 32 L 115 36 L 110 36 Z" fill="#FFD066" className="drop-shadow-[0_0_8px_#FF9500]" />
            <circle cx="114" cy="34" r="2.5" fill="#FFFFFF" />

            {/* Rear Taillight (LEFT) - Glowing Red/Amber */}
            <rect x="10" y="32" width="4" height="5" rx="1" fill="#FF3B30" className="drop-shadow-[0_0_6px_#FF3B30]" />

            {/* Door Handle Line */}
            <line x1="60" y1="27" x2="68" y2="27" stroke="#555560" strokeWidth="1" strokeLinecap="round" />

            {/* Wheels (Charcoal Rims + Amber Accent) */}
            {/* Rear Wheel (Left) */}
            <g transform="translate(28, 38)">
              <circle cx="0" cy="0" r="8.5" fill="#121214" stroke="#44444C" strokeWidth="2" />
              <circle cx="0" cy="0" r="4.5" fill="#28282E" />
              <circle cx="0" cy="0" r="2" fill="#888890" />
            </g>

            {/* Front Wheel (Right) */}
            <g transform="translate(90, 38)">
              <circle cx="0" cy="0" r="8.5" fill="#121214" stroke="#44444C" strokeWidth="2" />
              <circle cx="0" cy="0" r="4.5" fill="#28282E" />
              <circle cx="0" cy="0" r="2" fill="#888890" />
            </g>
          </svg>
        </div>
      </div>

      {/* 5. QUIET OVERLAY BADGE (KOVA PHILOSOPHY) */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none">
        <div className="glass-pill px-3.5 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#FF9500] animate-pulse shadow-[0_0_8px_#FF9500]" />
          <span className="text-[11px] font-medium text-white/90 tracking-wide">
            Driving steady · Long-term horizon
          </span>
        </div>
      </div>
    </div>
  );
};
