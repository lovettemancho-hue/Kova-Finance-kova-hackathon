// Small request-safety helpers used by server.ts. Pure; unit-tested in server/httpSafety.test.ts.

/**
 * CORS (KOVA-024). The API authenticates with a Bearer token, not cookies, so this is defence in depth.
 * Allowed: no Origin (same-origin GETs, curl, Cloud Scheduler, RevenueCat), the Android app's WebView,
 * local development, any origin listed in CORS_ORIGINS, and the server's own origin under whichever
 * Cloud Run URL the browser used (both the *.a.run.app and *.run.app forms work without config).
 */
export function isAllowedOrigin(origin: string | undefined, host: string | undefined, extra: Set<string> = new Set()): boolean {
  if (!origin) return true;
  if (origin === 'https://localhost' || origin === 'capacitor://localhost') return true; // Android app
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true; // local development
  if (extra.has(origin)) return true;
  try {
    const url = new URL(origin);
    return !!host && url.protocol === 'https:' && url.host === host;
  } catch {
    return false;
  }
}

// ---- Prompt input caps (KOVA-013) ------------------------------------------------------------
// Everything the app sends lands in a Gemini prompt. Caps bound cost and limit prompt-injection room.

/** A short, single-line string, or '' for anything that isn't a string. */
export function clipText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export interface PromptProfile {
  firstName?: string;
  workingGoal?: string;
  financialFeeling?: string;
  overspendTrigger?: string;
  preferredTone?: string;
  currency?: string;
  currencySymbol?: string;
  createdAt?: string;
}

/** The profile fields prompts use, as short plain strings. Unknown fields are dropped. */
export function clipProfile(p: any): PromptProfile {
  if (!p || typeof p !== 'object') return {};
  return {
    firstName: clipText(p.firstName, 40),
    workingGoal: clipText(p.workingGoal, 100),
    financialFeeling: clipText(p.financialFeeling, 120),
    overspendTrigger: clipText(p.overspendTrigger, 120),
    preferredTone: clipText(p.preferredTone, 60),
    currency: clipText(p.currency, 3),
    currencySymbol: clipText(p.currencySymbol, 5),
    createdAt: clipText(p.createdAt, 40),
  };
}
