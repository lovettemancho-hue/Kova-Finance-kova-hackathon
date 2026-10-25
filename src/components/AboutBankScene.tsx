import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface FloatingParticle {
  id: number;
  x: number;
  y: number;
  text: string;
}

export const AboutBankScene: React.FC<{ className?: string; interactive?: boolean }> = ({ 
  className = '',
  interactive = true 
}) => {
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [vaultSparks, setVaultSparks] = useState(0);

  const handleCoinClick = (e: React.MouseEvent, label: string) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const newP: FloatingParticle = {
      id: Date.now() + Math.random(),
      x: rect.left + rect.width / 2,
      y: rect.top,
      text: label,
    };
    setParticles((prev) => [...prev.slice(-4), newP]);
    setVaultSparks((c) => c + 1);

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== newP.id));
    }, 1200);
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[28px] border border-white/12 bg-gradient-to-b from-[#140F22] via-[#100C1B] to-[#0A0712] shadow-2xl h-64 sm:h-72 select-none flex items-center justify-center ${className}`}
    >
      {/* 1. Ambient Background Glows & Vignette */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Soft Amber Halo behind Bank Roof */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-72 h-36 bg-[#FF9500]/15 rounded-full blur-3xl pointer-events-none" />
        {/* Subtle Violet ambient vignette */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-28 bg-[#5856D6]/15 rounded-full blur-2xl pointer-events-none" />
        {/* Corner soft accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl" />
      </div>

      {/* Floating particles from interactive coin taps */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -40, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="fixed z-50 pointer-events-none text-amber-300 font-bold text-xs flex items-center gap-1 drop-shadow-[0_0_8px_rgba(255,180,32,0.8)]"
            style={{ left: p.x, top: p.y }}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>{p.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 2. SVG Architectural Bank & Floating Coins Scene */}
      <svg
        className="w-full h-full max-w-lg mx-auto relative z-10 p-2"
        viewBox="0 0 400 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gold Coin Gradient 1 */}
          <linearGradient id="coinGradMain" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE27D" />
            <stop offset="45%" stopColor="#FFB300" />
            <stop offset="100%" stopColor="#D98200" />
          </linearGradient>

          {/* Gold Coin Rim Gradient */}
          <linearGradient id="coinGradRim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF4C2" />
            <stop offset="100%" stopColor="#B36B00" />
          </linearGradient>

          {/* Doorway Amber Aura */}
          <radialGradient id="doorAuraGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFB020" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FF9500" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FF9500" stopOpacity="0" />
          </radialGradient>

          {/* Bank Stone Gradient */}
          <linearGradient id="bankStoneGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#302842" />
            <stop offset="50%" stopColor="#241E33" />
            <stop offset="100%" stopColor="#1A1526" />
          </linearGradient>

          {/* Bank Pediment Highlight */}
          <linearGradient id="roofPedimentGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#413759" />
            <stop offset="100%" stopColor="#231D31" />
          </linearGradient>

          {/* Column Highlight */}
          <linearGradient id="columnGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3E3454" />
            <stop offset="30%" stopColor="#4E4268" />
            <stop offset="70%" stopColor="#352B49" />
            <stop offset="100%" stopColor="#221C30" />
          </linearGradient>

          {/* Coin Drop Shadow Filter */}
          <filter id="coinGlowFilter" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feFlood floodColor="#FFB020" floodOpacity="0.55" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* --- BANK FOUNDATION & GROUND PLATFORM --- */}
        <g id="bank-ground">
          {/* Ground shadow */}
          <ellipse cx="200" cy="216" rx="145" ry="10" fill="#06040A" opacity="0.95" />

          {/* Step 3 (Bottom Step) */}
          <rect x="75" y="200" width="250" height="8" rx="2" fill="#1C1629" stroke="#3E3355" strokeWidth="1" />
          {/* Step 2 (Middle Step) */}
          <rect x="90" y="192" width="220" height="8" rx="2" fill="#241E34" stroke="#463A60" strokeWidth="1" />
          {/* Step 1 (Top Step / Stylobate) */}
          <rect x="105" y="184" width="190" height="8" rx="2" fill="#2B243E" stroke="#52446F" strokeWidth="1" />
        </g>

        {/* --- BANK ENTRANCE DOORWAY & AMBER GLOW --- */}
        <g id="bank-entrance">
          {/* Recessed Doorway Wall */}
          <rect x="120" y="106" width="160" height="78" fill="#120E1C" />

          {/* Arched Entrance Portal Silhouette */}
          <path
            d="M 172 184 L 172 136 Q 172 118 200 118 Q 228 118 228 136 L 228 184 Z"
            fill="#0A0811"
            stroke="#261E37"
            strokeWidth="1.5"
          />

          {/* Doorway Warm Amber Glowing Core (Echoing Kova Avatar Core) */}
          <motion.ellipse
            cx="200"
            cy="148"
            rx="24"
            ry="30"
            fill="url(#doorAuraGrad)"
            animate={{
              opacity: [0.45, 0.9, 0.45],
              scale: [0.96, 1.05, 0.96],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: '200px 148px' }}
            className="pointer-events-none"
          />

          {/* Internal Portal Door Leaf Accents */}
          <line x1="200" y1="122" x2="200" y2="184" stroke="#FF9500" strokeWidth="1" opacity="0.35" />
          <circle cx="200" cy="148" r="3" fill="#FFD066" opacity="0.85" />
        </g>

        {/* --- BANK COLUMNS (4 FLUTED CLASSICAL PILLARS) --- */}
        <g id="bank-columns">
          {/* Column 1 (Far Left) */}
          <rect x="114" y="106" width="16" height="78" rx="2" fill="url(#columnGrad)" stroke="#52446F" strokeWidth="0.8" />
          <rect x="111" y="103" width="22" height="4" rx="1" fill="#4B3E65" />
          <rect x="111" y="182" width="22" height="3" rx="1" fill="#4B3E65" />

          {/* Column 2 (Inner Left) */}
          <rect x="150" y="106" width="16" height="78" rx="2" fill="url(#columnGrad)" stroke="#52446F" strokeWidth="0.8" />
          <rect x="147" y="103" width="22" height="4" rx="1" fill="#4B3E65" />
          <rect x="147" y="182" width="22" height="3" rx="1" fill="#4B3E65" />

          {/* Column 3 (Inner Right) */}
          <rect x="234" y="106" width="16" height="78" rx="2" fill="url(#columnGrad)" stroke="#52446F" strokeWidth="0.8" />
          <rect x="231" y="103" width="22" height="4" rx="1" fill="#4B3E65" />
          <rect x="231" y="182" width="22" height="3" rx="1" fill="#4B3E65" />

          {/* Column 4 (Far Right) */}
          <rect x="270" y="106" width="16" height="78" rx="2" fill="url(#columnGrad)" stroke="#52446F" strokeWidth="0.8" />
          <rect x="267" y="103" width="22" height="4" rx="1" fill="#4B3E65" />
          <rect x="267" y="182" width="22" height="3" rx="1" fill="#4B3E65" />
        </g>

        {/* --- BANK ENTABLATURE & PEDIMENT ROOF --- */}
        <g id="bank-roof">
          {/* Architrave & Frieze */}
          <rect x="100" y="93" width="200" height="10" rx="1" fill="#322947" stroke="#52446F" strokeWidth="1" />
          <rect x="94" y="87" width="212" height="6" rx="1" fill="#3D3255" stroke="#5E4E7E" strokeWidth="1" />

          {/* Triangular Pediment (Tympanum) */}
          <polygon
            points="200,42 90,87 310,87"
            fill="url(#roofPedimentGrad)"
            stroke="#655487"
            strokeWidth="1.5"
          />

          {/* Inner Pediment Medallion / Kova Motif */}
          <circle cx="200" cy="70" r="10" fill="#1C1628" stroke="#FFB020" strokeWidth="1" opacity="0.85" />
          <polygon
            points="200,64 204,72 196,72"
            fill="#FFD066"
            opacity="0.95"
          />
        </g>

        {/* ========================================================= */}
        {/* FOUR FLOATING GOLD COINS (Framer Motion 60fps Smooth Loops) */}
        {/* ========================================================= */}

        {/* COIN 1 (Top Left) - $ Coin */}
        <motion.g
          id="coin1"
          filter="url(#coinGlowFilter)"
          animate={{
            y: [-7, 7, -7],
            rotate: [-4, 4, -4],
          }}
          transition={{
            duration: 3.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e: any) => handleCoinClick(e, '+$1 Saved')}
          className="cursor-pointer"
          style={{ transformOrigin: '68px 62px' }}
        >
          <g transform="translate(68, 62) rotate(-8)">
            <circle cx="0" cy="0" r="15" fill="url(#coinGradRim)" stroke="#FFE899" strokeWidth="1" />
            <circle cx="0" cy="0" r="12" fill="url(#coinGradMain)" />
            <circle cx="0" cy="0" r="10.5" fill="none" stroke="#FFF7D6" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.85" />
            <text
              x="0"
              y="4.5"
              textAnchor="middle"
              fill="#7A4800"
              fontSize="12"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              $
            </text>
            <text
              x="0"
              y="3.5"
              textAnchor="middle"
              fill="#FFF8E0"
              fontSize="12"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              $
            </text>
          </g>
        </motion.g>

        {/* COIN 2 (Lower Left) - Sparkle Star Coin */}
        <motion.g
          id="coin2"
          filter="url(#coinGlowFilter)"
          animate={{
            y: [8, -8, 8],
            rotate: [5, -5, 5],
          }}
          transition={{
            duration: 4.4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e: any) => handleCoinClick(e, '✦ Wealth')}
          className="cursor-pointer"
          style={{ transformOrigin: '52px 160px' }}
        >
          <g transform="translate(52, 160) rotate(12)">
            <circle cx="0" cy="0" r="17" fill="url(#coinGradRim)" stroke="#FFE899" strokeWidth="1" />
            <circle cx="0" cy="0" r="13.5" fill="url(#coinGradMain)" />
            <circle cx="0" cy="0" r="11.5" fill="none" stroke="#FFF7D6" strokeWidth="0.8" strokeDasharray="2.5 1.5" opacity="0.9" />
            <path
              d="M 0 -6 L 1.5 -1.5 L 6 0 L 1.5 1.5 L 0 6 L -1.5 1.5 L -6 0 L -1.5 -1.5 Z"
              fill="#FFFBE8"
            />
          </g>
        </motion.g>

        {/* COIN 3 (Top Right) - ¢ Coin */}
        <motion.g
          id="coin3"
          filter="url(#coinGlowFilter)"
          animate={{
            y: [-9, 7, -9],
            rotate: [4, -4, 4],
          }}
          transition={{
            duration: 4.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1.2,
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e: any) => handleCoinClick(e, '+1% Clarity')}
          className="cursor-pointer"
          style={{ transformOrigin: '332px 70px' }}
        >
          <g transform="translate(332, 70) rotate(10)">
            <circle cx="0" cy="0" r="16" fill="url(#coinGradRim)" stroke="#FFE899" strokeWidth="1" />
            <circle cx="0" cy="0" r="12.8" fill="url(#coinGradMain)" />
            <circle cx="0" cy="0" r="11" fill="none" stroke="#FFF7D6" strokeWidth="0.8" opacity="0.85" />
            <text
              x="0"
              y="4.5"
              textAnchor="middle"
              fill="#7A4800"
              fontSize="12"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              ¢
            </text>
            <text
              x="0"
              y="3.5"
              textAnchor="middle"
              fill="#FFF8E0"
              fontSize="12"
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
            >
              ¢
            </text>
          </g>
        </motion.g>

        {/* COIN 4 (Lower Right) - Diamond Coin */}
        <motion.g
          id="coin4"
          filter="url(#coinGlowFilter)"
          animate={{
            y: [7, -7, 7],
            rotate: [-6, 6, -6],
          }}
          transition={{
            duration: 3.9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.8,
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e: any) => handleCoinClick(e, '◆ Peace')}
          className="cursor-pointer"
          style={{ transformOrigin: '340px 168px' }}
        >
          <g transform="translate(340, 168) rotate(-14)">
            <circle cx="0" cy="0" r="14" fill="url(#coinGradRim)" stroke="#FFE899" strokeWidth="1" />
            <circle cx="0" cy="0" r="11" fill="url(#coinGradMain)" />
            <circle cx="0" cy="0" r="9.5" fill="none" stroke="#FFF7D6" strokeWidth="0.7" opacity="0.85" />
            <polygon points="0,-4.5 4,0 0,4.5 -4,0" fill="#FFF9DE" />
          </g>
        </motion.g>
      </svg>

      {/* Interactive Helper Cue */}
      {interactive && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md text-[10px] text-white/60 flex items-center gap-1.5 pointer-events-none">
          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
          <span>Tap the floating coins</span>
        </div>
      )}
    </div>
  );
};
