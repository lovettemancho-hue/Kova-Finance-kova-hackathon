import React from 'react';
import type { ChatMessage } from '../types';
import { dayLabelBetween } from '../utils/chatDays';

interface ChatDayDividerProps {
  previous?: ChatMessage;
  current: ChatMessage;
}

// WhatsApp-style day label ("Today", "Yesterday", "Monday", "3 October") shown above the
// first message of each day. Renders nothing when the day has not changed.
export const ChatDayDivider: React.FC<ChatDayDividerProps> = ({ previous, current }) => {
  const label = dayLabelBetween(previous, current);
  if (!label) return null;

  return (
    <div role="separator" aria-label={label} className="self-stretch flex justify-center py-1">
      <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-medium text-[#8A8A8E]">
        {label}
      </span>
    </div>
  );
};
