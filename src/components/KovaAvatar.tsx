import React from 'react';

interface KovaAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  isPulsing?: boolean;
}

export const KovaAvatar: React.FC<KovaAvatarProps> = ({ size = 'md', isPulsing = false }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-sm',
  };

  return (
    <div className={`relative flex items-center justify-center shrink-0`}>
      {/* Outer subtle glow ring */}
      <div 
        className={`absolute inset-0 rounded-full bg-gradient-to-tr from-white/30 via-white/10 to-transparent p-[1.5px] ${
          isPulsing ? 'kova-pulse' : 'kova-glow-ring'
        }`}
      />
      
      {/* Avatar surface */}
      <div 
        className={`${sizeClasses[size]} kova-keep-dark rounded-full bg-gradient-to-b from-[#2A2A2D] to-[#121214] flex items-center justify-center border border-white/20 text-white font-medium tracking-wider shadow-inner select-none`}
      >
        <span className="bg-gradient-to-tr from-white via-white to-white/60 bg-clip-text text-transparent font-semibold">
          K
        </span>
      </div>

      {/* Center glowing core dot */}
      <div className="absolute w-1.5 h-1.5 rounded-full bg-white/90 blur-[0.5px] shadow-[0_0_8px_#ffffff]" />
    </div>
  );
};
