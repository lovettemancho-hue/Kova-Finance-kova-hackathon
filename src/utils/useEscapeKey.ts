import { useEffect, useRef } from 'react';

/** Closes a modal when Escape is pressed (keyboard users on PC and tablets). */
export function useEscapeKey(onEscape: () => void, active: boolean) {
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) handler.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}
