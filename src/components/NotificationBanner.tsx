import React from 'react';
import { KovaAvatar } from './KovaAvatar';
import { X, ArrowRight, Download } from 'lucide-react';
import { NotificationBanner as NotificationType } from '../types';

interface NotificationBannerProps {
  notification: NotificationType;
  onOpenLetter: () => void;
  onDismiss: () => void;
  onDownloadReport?: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onOpenLetter,
  onDismiss,
  onDownloadReport,
}) => {
  if (!notification.active) return null;

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-2 sticky top-14 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div 
        onClick={onOpenLetter}
        className="glass-card rounded-[22px] p-3.5 border border-white/15 shadow-2xl backdrop-blur-2xl bg-[#1C1C1E]/95 flex items-center justify-between gap-3 cursor-pointer hover:border-white/30 transition-all group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <KovaAvatar size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white tracking-tight">
                {notification.sender}
              </span>
              <span className="text-[10px] text-[#8A8A8E]">
                {notification.timeAgo}
              </span>
            </div>
            <p className="text-xs text-white/90 line-clamp-1 font-normal tracking-tight mt-0.5">
              {notification.previewText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onDownloadReport && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadReport();
              }}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-transform hover:scale-105"
              title="Download report PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenLetter();
            }}
            className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center group-hover:scale-105 transition-transform"
            title="Read letter"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-white flex items-center justify-center transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
