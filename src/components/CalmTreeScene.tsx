import React from 'react';
import { motion } from 'motion/react';

export const CalmTreeScene: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`kova-keep-dark relative w-full overflow-hidden rounded-[24px] border border-white/15 bg-[#0C0914] shadow-2xl h-52 sm:h-56 select-none flex items-center justify-center ${className}`}
    >
      {/* 1. Ambient Background Nocturnal Gradient & Star Dust */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#140F22] via-[#100C1B] to-[#0A0712] pointer-events-none">
        {/* Soft Ambient Corner Vignettes */}
        <div className="absolute top-0 left-1/4 w-80 h-40 bg-[#FF9500]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-72 h-32 bg-[#5856D6]/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. SVG Calm Tree Scene with Seated Figure & 7 Floating Coins */}
      <svg
        id="kova-tree-scene-with-character"
        className="w-full h-full max-w-xl mx-auto relative z-10"
        viewBox="0 0 400 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Moon / Celestial Halo Glow */}
          <radialGradient id="moonGlowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF4D0" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#FFB326" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#FF9500" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FF9500" stopOpacity="0" />
          </radialGradient>

          {/* Core Moon Disc */}
          <linearGradient id="moonDiscGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFBE8" />
            <stop offset="70%" stopColor="#FFE182" />
            <stop offset="100%" stopColor="#FFC13B" />
          </linearGradient>

          {/* Gold Coin Metallic Gradient */}
          <linearGradient id="tcoinGoldMain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE78A" />
            <stop offset="45%" stopColor="#FFB703" />
            <stop offset="100%" stopColor="#D47A00" />
          </linearGradient>

          <linearGradient id="tcoinGoldRim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF6D1" />
            <stop offset="100%" stopColor="#A86000" />
          </linearGradient>

          {/* Coin Amber Glow Filter */}
          <filter id="tcoinGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
            <feOffset dx="0" dy="1.5" result="offsetblur" />
            <feFlood floodColor="#FFB020" floodOpacity="0.6" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Hill & Ground Gradients */}
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#221A33" />
            <stop offset="40%" stopColor="#1A1326" />
            <stop offset="100%" stopColor="#0E0A16" />
          </linearGradient>

          {/* Tree Trunk & Bark Silhouette Gradient */}
          <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1F172E" />
            <stop offset="40%" stopColor="#2E2244" />
            <stop offset="75%" stopColor="#251B38" />
            <stop offset="100%" stopColor="#171124" />
          </linearGradient>
        </defs>

        {/* --- 1. CELESTIAL MOON & SUBTLE PULSING HALO --- */}
        <g id="moonAndHalo">
          {/* Outer Ambient Moon Halo - Slow, barely perceptible pulse echoing Kova avatar */}
          <motion.circle
            cx="200"
            cy="78"
            r="54"
            fill="url(#moonGlowGrad)"
            animate={{
              scale: [0.96, 1.05, 0.96],
              opacity: [0.6, 0.9, 0.6],
            }}
            transition={{
              duration: 5.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '200px 78px' }}
          />

          {/* Inner Luminous Moon Disc */}
          <circle
            cx="200"
            cy="78"
            r="16"
            fill="url(#moonDiscGrad)"
            opacity="0.9"
            className="drop-shadow-[0_0_12px_rgba(255,180,40,0.85)]"
          />
        </g>

        {/* --- 2. GROUND KNOLL & DEEP ROOT BED (STILL & ROOTED) --- */}
        <g id="groundKnoll">
          {/* Distant background hill silhouette */}
          <path
            d="M 0 185 Q 90 162 200 168 Q 310 174 400 164 L 400 220 L 0 220 Z"
            fill="#140E20"
            opacity="0.8"
          />

          {/* Main Foreground Earthy Ridge */}
          <path
            d="M 0 190 Q 100 172 200 176 Q 300 180 400 170 L 400 220 L 0 220 Z"
            fill="url(#groundGrad)"
          />

          {/* Grass & Root Textural Edge Highlights */}
          <path
            d="M 20 189 Q 100 173 200 177 Q 300 181 380 171"
            stroke="#473766"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.5"
          />
        </g>

        {/* --- 3. THE TREE (STAYS COMPLETELY STILL — ANCHORED & ROOTED) --- */}
        <g id="treeRootedStill">
          {/* Deep Spreading Anchor Roots */}
          {/* Root Left 1 */}
          <path
            d="M 194 176 Q 180 180 162 188 Q 150 193 138 196"
            stroke="#2A1E3E"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M 194 176 Q 180 180 162 188 Q 150 193 138 196"
            stroke="#3D2C5A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Root Left 2 (Subtle) */}
          <path
            d="M 188 180 Q 175 186 156 195"
            stroke="#231933"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Root Right 1 (Under/Behind seated figure) */}
          <path
            d="M 206 176 Q 225 182 248 189 Q 262 193 275 195"
            stroke="#2A1E3E"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M 206 176 Q 225 182 248 189 Q 262 193 275 195"
            stroke="#3D2C5A"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Central Mighty Trunk with Organic Taper */}
          <path
            d="M 186 182 Q 192 145 188 115 Q 182 85 168 62 L 180 62 Q 194 88 198 115 Q 200 145 214 182 Z"
            fill="url(#trunkGrad)"
          />

          {/* Main Branches */}
          {/* Left Branch Tier 1 */}
          <path
            d="M 190 120 Q 165 110 135 116 Q 115 120 95 126"
            stroke="#2B1F40"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Left Branch Tier 2 (Upper) */}
          <path
            d="M 186 90 Q 155 78 120 84 Q 98 88 80 96"
            stroke="#32244B"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Right Branch Tier 1 */}
          <path
            d="M 200 118 Q 230 108 262 114 Q 288 120 310 126"
            stroke="#2B1F40"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Right Branch Tier 2 (Upper) */}
          <path
            d="M 196 88 Q 232 76 270 82 Q 295 86 320 94"
            stroke="#32244B"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Top Canopy Branch Forks */}
          <path
            d="M 194 72 Q 185 48 168 36"
            stroke="#2E2045"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 198 70 Q 212 46 230 36"
            stroke="#2E2045"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Canopy Foliage Clusters (Multi-layered deep twilight leaves & boughs) */}
          {/* Back Canopy Shading */}
          <ellipse cx="140" cy="85" rx="38" ry="24" fill="#1B1329" opacity="0.9" />
          <ellipse cx="260" cy="82" rx="38" ry="24" fill="#1B1329" opacity="0.9" />
          <ellipse cx="200" cy="52" rx="46" ry="28" fill="#1B1329" opacity="0.9" />

          {/* Midground Foliage Clouds */}
          <path
            d="M 90 92 Q 80 75 100 65 Q 125 55 145 68 Q 165 58 185 70 Q 180 90 160 98 Q 130 106 105 100 Q 88 102 90 92 Z"
            fill="#281C3D"
          />
          <path
            d="M 310 90 Q 320 72 300 62 Q 275 52 255 66 Q 235 56 215 68 Q 220 88 240 96 Q 270 104 295 98 Q 312 100 310 90 Z"
            fill="#281C3D"
          />

          {/* Top Crown Foliage Cloud */}
          <path
            d="M 155 50 Q 160 30 180 25 Q 200 18 220 25 Q 240 30 245 50 Q 235 65 215 68 Q 185 68 165 65 Q 150 60 155 50 Z"
            fill="#34254E"
          />

          {/* Lower Outer Foliage Clusters */}
          <circle cx="92" cy="120" r="22" fill="#241938" />
          <circle cx="308" cy="118" r="22" fill="#241938" />
          <circle cx="120" cy="128" r="18" fill="#2E2046" />
          <circle cx="280" cy="126" r="18" fill="#2E2046" />

          {/* Organic Leaf Edge Details & Subtle Stippling */}
          <circle cx="150" cy="58" r="12" fill="#3D2D5A" opacity="0.75" />
          <circle cx="250" cy="56" r="12" fill="#3D2D5A" opacity="0.75" />
          <circle cx="188" cy="40" r="14" fill="#463466" opacity="0.65" />
          <circle cx="212" cy="40" r="14" fill="#463466" opacity="0.65" />
        </g>

        {/* --- 4. SEATED FIGURE RESTING PEACEFULLY AGAINST TRUNK (#seatedFigure) --- */}
        {/* The figure breathes: slow, gentle rise and fall on the upper torso/chest */}
        <g id="seatedFigure">
          {/* Ground Contact Shadow */}
          <ellipse cx="225" cy="183" rx="16" ry="3.5" fill="#09060E" opacity="0.95" />

          {/* Lower Body (Legs seated peacefully on earth - anchored) */}
          <g id="figureLegs">
            {/* Bent knee / Outstretched relaxed leg silhouette */}
            <path
              d="M 218 178 Q 224 175 233 177 Q 240 180 243 182 L 222 183 Z"
              fill="#181224"
            />
            {/* Front folded knee curve */}
            <path
              d="M 216 177 Q 222 170 229 171 Q 235 174 238 181 L 216 182 Z"
              fill="#221832"
            />
            {/* Soft leg highlight */}
            <path
              d="M 218 176 Q 225 172 232 175"
              stroke="#433260"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>

          {/* Torso & Head (Breathing Animation: slow 4.5s cycle, subtle gentle rise & fall) */}
          <motion.g
            id="figureTorsoChest"
            animate={{
              y: [0, -1.8, 0],
              scaleY: [1, 1.025, 1],
            }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '216px 177px' }}
          >
            {/* Torso leaning comfortably back against the tree bark */}
            <path
              d="M 210 178 Q 212 165 215 156 Q 219 152 225 156 Q 226 166 222 176 Z"
              fill="#2A1E3D"
              stroke="#3D2D58"
              strokeWidth="0.8"
            />

            {/* Relaxed Arm resting gently across lap / knee */}
            <path
              d="M 217 160 Q 223 166 228 173"
              stroke="#463564"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Peaceful Head tilted softly back in quiet repose */}
            <circle
              cx="217"
              cy="148"
              r="4.8"
              fill="#372850"
              stroke="#4F3C70"
              strokeWidth="0.8"
            />

            {/* Gentle Warm Ambient Edge Glow on Head/Shoulder from the Moon */}
            <path
              d="M 214 145 Q 216 143 219 144"
              stroke="#FFB326"
              strokeWidth="0.8"
              strokeLinecap="round"
              opacity="0.6"
            />
          </motion.g>
        </g>

        {/* --- 5. SEVEN INDEPENDENTLY FLOATING GOLD COINS (#tcoin1 to #tcoin7) --- */}
        {/* Each drifts gently on an independent 4-6s cycle, offset from each other */}

        {/* COIN 1 (Upper Left Canopy) - $ Symbol */}
        <motion.g
          id="tcoin1"
          filter="url(#tcoinGlow)"
          animate={{
            y: [-4, 4, -4],
            rotate: [-2, 2, -2],
          }}
          transition={{
            duration: 4.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0,
          }}
          style={{ transformOrigin: '100px 72px' }}
        >
          <g transform="translate(100, 72) rotate(-6)">
            <circle cx="0" cy="0" r="10" fill="url(#tcoinGoldRim)" stroke="#FFE899" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="8" fill="url(#tcoinGoldMain)" />
            <circle cx="0" cy="0" r="6.8" fill="none" stroke="#FFF7D6" strokeWidth="0.6" strokeDasharray="1.5 1" opacity="0.85" />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              fill="#7A4800"
              fontSize="8"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              $
            </text>
            <text
              x="0"
              y="2.3"
              textAnchor="middle"
              fill="#FFFBE8"
              fontSize="8"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              $
            </text>
          </g>
        </motion.g>

        {/* COIN 2 (Mid Left Canopy Branch) - ✦ Star Symbol */}
        <motion.g
          id="tcoin2"
          filter="url(#tcoinGlow)"
          animate={{
            y: [4.5, -4.5, 4.5],
            rotate: [3, -3, 3],
          }}
          transition={{
            duration: 5.4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1.2,
          }}
          style={{ transformOrigin: '136px 112px' }}
        >
          <g transform="translate(136, 112) rotate(8)">
            <circle cx="0" cy="0" r="11" fill="url(#tcoinGoldRim)" stroke="#FFE899" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="8.8" fill="url(#tcoinGoldMain)" />
            <circle cx="0" cy="0" r="7.5" fill="none" stroke="#FFF7D6" strokeWidth="0.6" strokeDasharray="2 1" opacity="0.9" />
            <path
              d="M 0 -4 L 1 -1 L 4 0 L 1 1 L 0 4 L -1 1 L -4 0 L -1 -1 Z"
              fill="#FFFDF0"
            />
          </g>
        </motion.g>

        {/* COIN 3 (Top Center Above Moon) - ◈ Crystal Symbol */}
        <motion.g
          id="tcoin3"
          filter="url(#tcoinGlow)"
          animate={{
            y: [-3.5, 4.5, -3.5],
            rotate: [-2.5, 2.5, -2.5],
          }}
          transition={{
            duration: 4.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2.3,
          }}
          style={{ transformOrigin: '200px 38px' }}
        >
          <g transform="translate(200, 38) rotate(4)">
            <circle cx="0" cy="0" r="9" fill="url(#tcoinGoldRim)" stroke="#FFE899" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="7.2" fill="url(#tcoinGoldMain)" />
            <circle cx="0" cy="0" r="6" fill="none" stroke="#FFF7D6" strokeWidth="0.5" opacity="0.85" />
            <polygon points="0,-3 3,0 0,3 -3,0" fill="#FFFDF0" />
          </g>
        </motion.g>

        {/* COIN 4 (Upper Right Canopy) - ¢ Symbol */}
        <motion.g
          id="tcoin4"
          filter="url(#tcoinGlow)"
          animate={{
            y: [4, -4, 4],
            rotate: [-3, 3, -3],
          }}
          transition={{
            duration: 5.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.7,
          }}
          style={{ transformOrigin: '272px 64px' }}
        >
          <g transform="translate(272, 64) rotate(10)">
            <circle cx="0" cy="0" r="10.5" fill="url(#tcoinGoldRim)" stroke="#FFE899" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="8.4" fill="url(#tcoinGoldMain)" />
            <circle cx="0" cy="0" r="7.2" fill="none" stroke="#FFF7D6" strokeWidth="0.6" opacity="0.85" />
            <text
              x="0"
              y="3"
              textAnchor="middle"
              fill="#7A4800"
              fontSize="8"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              ¢
            </text>
            <text
              x="0"
              y="2.3"
              textAnchor="middle"
              fill="#FFFBE8"
              fontSize="8"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              ¢
            </text>
          </g>
        </motion.g>

        {/* COIN 5 (Mid Right Canopy Branch) - ◆ Diamond Symbol */}
        <motion.g
          id="tcoin5"
          filter="url(#tcoinGlow)"
          animate={{
            y: [-5, 3.5, -5],
            rotate: [2.5, -2.5, 2.5],
          }}
          transition={{
            duration: 4.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 3.1,
          }}
          style={{ transformOrigin: '304px 104px' }}
        >
          <g transform="translate(304, 104) rotate(-8)">
            <circle cx="0" cy="0" r="9.5" fill="url(#tcoinGoldRim)" stroke="#FFE899" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="7.6" fill="url(#tcoinGoldMain)" />
            <circle cx="0" cy="0" r="6.4" fill="none" stroke="#FFF7D6" strokeWidth="0.5" opacity="0.85" />
            <polygon points="0,-3 3,0 0,3 -3,0" fill="#FFFBE8" />
          </g>
        </motion.g>

        {/* COIN 6 (Lower Left Ambient Foliage) - % Compounding Symbol */}
        <motion.g
          id="tcoin6"
          filter="url(#tcoinGlow)"
          animate={{
            y: [3.5, -4.5, 3.5],
            rotate: [-2, 2, -2],
          }}
          transition={{
            duration: 5.1,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1.8,
          }}
          style={{ transformOrigin: '72px 132px' }}
        >
          <g transform="translate(72, 132) rotate(-4)">
            <circle cx="0" cy="0" r="8.5" fill="url(#tcoinGoldRim)" stroke="#FFE899" strokeWidth="0.7" />
            <circle cx="0" cy="0" r="6.8" fill="url(#tcoinGoldMain)" />
            <circle cx="0" cy="0" r="5.6" fill="none" stroke="#FFF7D6" strokeWidth="0.5" opacity="0.8" />
            <text
              x="0"
              y="2.8"
              textAnchor="middle"
              fill="#7A4800"
              fontSize="7"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              %
            </text>
            <text
              x="0"
              y="2.1"
              textAnchor="middle"
              fill="#FFFBE8"
              fontSize="7"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              %
            </text>
          </g>
        </motion.g>

        {/* COIN 7 (Lower Right Ambient Foliage) - Sprout Seed Symbol */}
        <motion.g
          id="tcoin7"
          filter="url(#tcoinGlow)"
          animate={{
            y: [-4, 4, -4],
            rotate: [3, -3, 3],
          }}
          transition={{
            duration: 4.7,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2.7,
          }}
          style={{ transformOrigin: '334px 140px' }}
        >
          <g transform="translate(334, 140) rotate(6)">
            <circle cx="0" cy="0" r="8.5" fill="url(#tcoinGoldRim)" stroke="#FFE899" strokeWidth="0.7" />
            <circle cx="0" cy="0" r="6.8" fill="url(#tcoinGoldMain)" />
            <circle cx="0" cy="0" r="5.6" fill="none" stroke="#FFF7D6" strokeWidth="0.5" opacity="0.8" />
            <path
              d="M -2 2 Q -2 -1 0 -2 Q 2 -1 2 2 Z"
              fill="#FFFBE8"
            />
            <path
              d="M 0 -2 L 0 3"
              stroke="#7A4800"
              strokeWidth="0.7"
            />
          </g>
        </motion.g>
      </svg>

      {/* 3. Overlay Caption Pill: "Rooted · Growing steadily" */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none">
        <div className="glass-pill px-3.5 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#FF9500] animate-pulse shadow-[0_0_8px_#FF9500]" />
          <span className="text-[11px] font-medium text-white/90 tracking-wide">
            Rooted · Growing steadily
          </span>
        </div>
      </div>
    </div>
  );
};
