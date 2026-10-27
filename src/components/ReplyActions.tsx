import React, { useRef, useState } from 'react';
import { Copy, Flag, ChevronLeft, Loader2, MoreHorizontal } from 'lucide-react';
import { fetchWithAuth } from '../utils/apiClient';
import { useEscapeKey } from '../utils/useEscapeKey';
import { useToast } from '../context/ToastContext';

// Actions on a Kova reply (KOVA-093): long-press on phones, right-click or the "⋯" button on PC.
// Opens a sheet with Copy and Report reply. Reporting asks what's wrong, then sends the reply to
// POST /api/ai-report (Google Play's AI-generated content policy). Replaces the always-visible
// "Report" link from KOVA-092.

export const REPORT_REASONS = [
  { id: 'wrong_numbers', label: 'The numbers are wrong' },
  { id: 'unhelpful', label: 'Not helpful or off-topic' },
  { id: 'offensive', label: 'Offensive or harmful' },
  { id: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/** Long-press for touch and pen, plus the context menu (right-click on PC, long-press on Android). */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const cb = useRef(onLongPress);
  cb.current = onLongPress;

  const clear = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return; // PC uses right-click or the "⋯" button
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        clear();
        try {
          navigator.vibrate?.(10);
        } catch {
          // no vibration support
        }
        cb.current();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE_PX) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear, // the browser took over to scroll
    onPointerLeave: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      clear();
      cb.current();
    },
  };
}

/**
 * The "⋯" button next to a reply's timestamp. Only where there's a mouse, on hover or keyboard focus.
 * Uses the named group `group/reply` so it doesn't trigger GoalCard's own `group-hover` styles.
 */
export const ReplyMoreButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Reply options"
    title="Reply options"
    className="hidden pointer-fine:inline-flex ml-auto w-6 h-6 items-center justify-center rounded-full text-kova-muted hover:text-white hover:bg-white/10 opacity-0 group-hover/reply:opacity-100 focus-visible:opacity-100 transition-opacity"
  >
    <MoreHorizontal className="w-4 h-4" />
  </button>
);

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

type Step = 'menu' | 'reasons' | 'sending';

export const ReplyActionsSheet: React.FC<{
  messageId: string;
  text: string;
  reported: boolean;
  onReported: (messageId: string) => void;
  onClose: () => void;
}> = ({ messageId, text, reported, onReported, onClose }) => {
  const toast = useToast();
  const [step, setStep] = useState<Step>('menu');
  const [error, setError] = useState<string | null>(null);
  // Lifting the finger after a long-press sends a click to whatever is now under it: the backdrop or a
  // menu row. Only clicks whose press started inside this sheet count (keyboard clicks have detail 0).
  const armed = useRef(false);

  useEscapeKey(() => {
    if (step === 'reasons') setStep('menu');
    else if (step !== 'sending') onClose();
  }, true);

  const copy = async () => {
    const ok = await copyText(text);
    if (ok) toast.success('Copied');
    else toast.error("Couldn't copy on this device");
    onClose();
  };

  const report = async (reason: ReportReason) => {
    setStep('sending');
    setError(null);
    try {
      const res = await fetchWithAuth('/api/ai-report', {
        method: 'POST',
        body: JSON.stringify({ messageId, text, reason }),
      });
      if (!res.ok) throw new Error('report_failed');
      onReported(messageId);
      toast.success("Thanks. We'll review this reply.");
      onClose();
    } catch {
      setError("Couldn't send the report. Check your connection and try again.");
      setStep('reasons');
    }
  };

  const row =
    'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm text-left transition-colors disabled:opacity-50';

  return (
    <div
      className="kova-modal kova-sheet fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onPointerDownCapture={() => {
        armed.current = true;
      }}
      onClickCapture={(e) => {
        if (!armed.current && e.detail !== 0) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={() => step !== 'sending' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step === 'menu' ? 'Reply options' : 'Report this reply'}
        className="glass-card rounded-[28px] p-4 border border-white/15 bg-kova-surface max-w-sm w-full space-y-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

        <p className="text-xs text-kova-muted leading-relaxed line-clamp-3 px-1">{text}</p>

        {step === 'menu' && (
          <div className="space-y-1">
            <button type="button" onClick={copy} className={`${row} text-white hover:bg-white/10 active:bg-white/10`} autoFocus>
              <Copy className="w-4 h-4 text-white/70" />
              <span>Copy</span>
            </button>
            <button
              type="button"
              onClick={() => setStep('reasons')}
              disabled={reported}
              className={`${row} text-kova-red-soft hover:bg-kova-red/10 active:bg-kova-red/10`}
            >
              <Flag className="w-4 h-4" />
              <span>{reported ? 'Reported' : 'Report reply'}</span>
            </button>
          </div>
        )}

        {step !== 'menu' && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 px-1 pb-1">
              <button
                type="button"
                onClick={() => setStep('menu')}
                disabled={step === 'sending'}
                aria-label="Back"
                className="w-7 h-7 -ml-1 rounded-full flex items-center justify-center text-kova-muted hover:text-white hover:bg-white/10 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-white">What's wrong with this reply?</span>
            </div>
            {REPORT_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => report(r.id)}
                disabled={step === 'sending'}
                className={`${row} text-white hover:bg-white/10 active:bg-white/10`}
              >
                <span>{r.label}</span>
              </button>
            ))}
            {step === 'sending' && (
              <p className="flex items-center gap-2 text-xs text-kova-muted px-4 pt-1" aria-live="polite">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending...
              </p>
            )}
            {error && (
              <p className="text-xs text-kova-red-soft px-4 pt-1" role="alert">
                {error}
              </p>
            )}
            <p className="text-[10px] text-kova-muted px-4 pt-1">The reply is sent to the Kova team for review.</p>
          </div>
        )}
      </div>
    </div>
  );
};

/** A Kova reply bubble that opens the actions sheet on long-press or right-click. */
export const LongPressBubble: React.FC<{ onLongPress: () => void; className: string; children: React.ReactNode }> = ({
  onLongPress,
  className,
  children,
}) => {
  const handlers = useLongPress(onLongPress);
  // No text selection or system callout on long-press: Copy is in the sheet instead.
  return (
    <div {...handlers} className={`${className} select-none [-webkit-touch-callout:none]`}>
      {children}
    </div>
  );
};
