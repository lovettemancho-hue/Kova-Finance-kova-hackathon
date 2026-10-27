import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

// Product photo from Channel3 on a white tile, like a store listing (KOVA-103). Falls back to an icon
// when there is no photo or it fails to load. No referrer is sent to the image host.
export const ProductThumb: React.FC<{ url?: string; alt: string; size?: 'md' | 'sm' }> = ({ url, alt, size = 'md' }) => {
  const [failed, setFailed] = useState(false);
  const box = size === 'md' ? 'w-16 h-16 rounded-2xl' : 'w-11 h-11 rounded-xl';
  if (!url || failed) {
    return (
      <div className={`${box} shrink-0 bg-white/5 border border-white/10 flex items-center justify-center text-kova-muted`} aria-hidden="true">
        <ShoppingBag className={size === 'md' ? 'w-6 h-6' : 'w-5 h-5'} />
      </div>
    );
  }
  return (
    <div className={`${box} shrink-0 bg-white overflow-hidden flex items-center justify-center`}>
      <img
        src={url}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain p-1.5"
      />
    </div>
  );
};
