import type { ChatMessage } from '../types';

// Anything below this is a fake "date" (older messages get their list position as createdAt
// so they keep their order). Treat those as undated and show no day label for them.
const MIN_REAL_DATE = Date.UTC(2000, 0, 1);

export function hasRealDate(m: { createdAt?: number } | null | undefined): m is { createdAt: number } {
  return !!m && typeof m.createdAt === 'number' && m.createdAt > MIN_REAL_DATE;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Calendar day in the device's own time zone, e.g. "2026-10-12". */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * WhatsApp-style label: "Today", "Yesterday", a weekday for the last week, otherwise a date.
 * Uses calendar days in the device's time zone (so 11:50 PM and 12:10 AM are different days).
 */
export function formatDayLabel(ms: number, now: number = Date.now(), locale?: string): string {
  // Round so a 23- or 25-hour day (daylight saving) still counts as exactly one day.
  const diffDays = Math.round((startOfLocalDay(now) - startOfLocalDay(ms)) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays <= 6) {
    return new Date(ms).toLocaleDateString(locale, { weekday: 'long' });
  }

  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return new Date(ms).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** A label appears before a message when its day differs from the previous message's day. */
export function dayLabelBetween(
  previous: ChatMessage | undefined,
  current: ChatMessage,
  now: number = Date.now(),
  locale?: string
): string | null {
  if (!hasRealDate(current)) return null;
  if (hasRealDate(previous) && dayKey(previous.createdAt) === dayKey(current.createdAt)) return null;
  return formatDayLabel(current.createdAt, now, locale);
}

/**
 * Gives every message that enters the chat a real creation time. A reply that replaces a
 * placeholder with the same id keeps the placeholder's time. Messages that were already
 * there without a date are left alone (they stay undated).
 */
export function stampNewMessages(
  next: ChatMessage[],
  prev: ChatMessage[],
  now: number = Date.now()
): ChatMessage[] {
  const before = new Map<string, ChatMessage>();
  (prev || []).forEach((m) => {
    if (m && m.id) before.set(m.id, m);
  });

  let changed = false;
  let offset = 0;
  const out = (next || []).map((m, idx) => {
    if (!m) return m;
    let item = m;
    if (!item.id) {
      changed = true;
      item = { ...item, id: `msg-${now}-${idx}-${offset++}` };
    }
    if (typeof item.createdAt === 'number') return item;
    const old = before.get(item.id);
    if (old && typeof old.createdAt === 'number') {
      changed = true;
      return { ...item, createdAt: old.createdAt };
    }
    if (old) return item; // already shown without a date; leave it undated
    changed = true;
    return { ...item, createdAt: now + offset++ };
  });

  return changed ? out : next;
}
