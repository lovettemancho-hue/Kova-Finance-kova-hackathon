// Model, thinking and output caps for every Gemini call (PR 2 of the Free vs Premium plan, KOVA-074).
//
// One table so cost decisions live in one place. Callers pass `aiRoute` (and `plan`) to
// safeGenerateContent / safeGenerateContentStream in server.ts, which apply this budget.
// Pure data + helpers only, so it can be unit-tested (server/aiBudget.test.ts).

import type { Plan } from './plans';

export const LITE = 'gemini-3.1-flash-lite';
export const FLASH = 'gemini-3.6-flash';

export type AiRoute = 'chat' | 'coach' | 'topic' | 'grow' | 'letter' | 'csv' | 'paypal' | 'paypalAsk' | 'categorize';

interface Budget {
  model: string;
  /** Includes thinking tokens, which bill at the output rate. Generous enough for the JSON each route returns. */
  maxOutputTokens: number;
}

/** Thinking level for every route: LOW keeps quality for these short, structured tasks at a fraction of the cost. */
export const THINKING_LEVEL = 'LOW';

export const AI_BUDGET: Record<AiRoute, Record<Plan, Budget>> = {
  chat: { free: { model: LITE, maxOutputTokens: 2048 }, premium: { model: LITE, maxOutputTokens: 2048 } },
  coach: { free: { model: LITE, maxOutputTokens: 1024 }, premium: { model: LITE, maxOutputTokens: 1024 } },
  topic: { free: { model: LITE, maxOutputTokens: 1024 }, premium: { model: LITE, maxOutputTokens: 1024 } },
  paypal: { free: { model: LITE, maxOutputTokens: 2048 }, premium: { model: LITE, maxOutputTokens: 2048 } },
  // "Ask Kova about your PayPal" (KOVA-087): tool calling, so Premium gets 3.6 Flash; up to 4 calls per question.
  paypalAsk: { free: { model: LITE, maxOutputTokens: 2048 }, premium: { model: FLASH, maxOutputTokens: 2048 } },
  // Daily Grow lesson: cached once per user per day; free on Flash-Lite.
  grow: { free: { model: LITE, maxOutputTokens: 2048 }, premium: { model: FLASH, maxOutputTokens: 3072 } },
  // Monthly letter: free gets a shorter letter with 1 book pick on Flash-Lite.
  letter: { free: { model: LITE, maxOutputTokens: 3072 }, premium: { model: FLASH, maxOutputTokens: 6144 } },
  // Statement import read on the phone (KOVA-081): only unknown merchant names are categorised.
  categorize: { free: { model: LITE, maxOutputTokens: 2048 }, premium: { model: LITE, maxOutputTokens: 2048 } },
  // Statement import: free gets 1 a month on Flash-Lite (KOVA-078), Premium 5 on 3.6 Flash.
  csv: { free: { model: LITE, maxOutputTokens: 16384 }, premium: { model: FLASH, maxOutputTokens: 16384 } },
};

export function budgetFor(route: AiRoute, plan: Plan | undefined): Budget {
  return AI_BUDGET[route][plan === 'premium' ? 'premium' : 'free'];
}

/** True when Gemini rejected the request itself (bad/unsupported parameter), not a quota or outage. */
export function isInvalidArgumentError(err: any): boolean {
  const status = Number(err?.status ?? err?.code ?? err?.error?.code);
  const text = `${err?.message || ''} ${err?.error?.status || ''}`;
  return status === 400 || /INVALID_ARGUMENT/i.test(text);
}

/** Token counts from a Gemini response, for cost logging. Counts only, never content. */
export function usageLine(route: string, model: string, meta: any): string {
  const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return `[AI usage] route=${route} model=${model} in=${n(meta?.promptTokenCount)} out=${n(meta?.candidatesTokenCount)} thinking=${n(meta?.thoughtsTokenCount)}`;
}
