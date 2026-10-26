// The four reply tones users pick in onboarding and Settings (KOVA-100). One place decides what each tone
// means, so chat, letters, Grow, the goal coach and PayPal all sound the same for the same choice.
// Pure, unit-tested in server/tone.test.ts.
//
// Rules that hold for every tone (numbers only from the snapshot, no orders, no judging) stay in the
// voice blocks in server.ts. A tone changes style and length, never facts.

export type Tone = 'gentle' | 'straight' | 'analytic' | 'mentor';
export type Plan = 'free' | 'premium';

/** The labels stored in userProfile.preferredTone, as shown in the app. */
export const TONE_LABELS: Record<Tone, string> = {
  gentle: 'Gently, ease me in',
  straight: 'Straight, tell me the truth',
  analytic: 'Analytic, show me the numbers',
  mentor: 'Warm, like a wise mentor',
};

/** Reads the stored label. Analytic is Premium: on Free it falls back to Gentle, on every route. */
export function resolveTone(raw: unknown, plan: Plan | undefined): Tone {
  const t = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (t.includes('analytic') || t.includes('numbers') || t.includes('data')) return plan === 'premium' ? 'analytic' : 'gentle';
  if (t.includes('straight') || t.includes('truth') || t.includes('direct')) return 'straight';
  if (t.includes('warm') || t.includes('mentor') || t.includes('wise')) return 'mentor';
  return 'gentle';
}

/** Short replies: chat and "Ask about PayPal". */
export function chatToneStyle(tone: Tone): string {
  switch (tone) {
    case 'straight':
      return `Tone: Straight (the user chose "${TONE_LABELS.straight}").
- The first sentence is the answer. One or two short sentences in total.
- No softeners or reassurance ("just", "a little", "don't worry", "no judgment", "that's okay"). No questions back unless you truly need one.
- Say unwelcome facts plainly ("You spent more than you earned this month."), still without judging or giving orders.`;
    case 'analytic':
      return `Tone: Analytic (the user chose "${TONE_LABELS.analytic}").
- Lead with figures from the snapshot: amounts, percentages and comparisons with last month whenever the snapshot has them.
- Prefer compact "label: value" lines (up to 4) over prose.
- No adjectives, no feelings talk, no reassurance.`;
    case 'mentor':
      return `Tone: Warm mentor (the user chose "${TONE_LABELS.mentor}").
- Friendly and encouraging wording.
- After answering, you may add ONE short reflective line about perspective or a lasting money habit, offered as an idea ("Many people find…", "One habit that helps…"). Never an order, never a judgment.`;
    default:
      return `Tone: Gentle (the user chose "${TONE_LABELS.gentle}").
- Soft, reassuring words and low pressure.
- Keep numbers few and simple: at most one figure per reply unless the user asks for numbers.
- If the user shares a feeling, acknowledge it in a few kind words first.`;
  }
}

/** Longer text: monthly letters, Grow lessons, topic openers, the goal coach and the PayPal check-in. */
export function longformToneStyle(tone: Tone): string {
  switch (tone) {
    case 'straight':
      return `TONE — Straight (the user chose "${TONE_LABELS.straight}"): direct and concise. Short paragraphs, no padding or sugarcoating. State the facts plainly, including uncomfortable ones, without judging or giving orders.`;
    case 'analytic':
      return `TONE — Analytic (the user chose "${TONE_LABELS.analytic}"): figure-led and structured. Use the amounts, percentages and month-on-month comparisons from the snapshot; short labelled lines are welcome. No decorative or emotional language.`;
    case 'mentor':
      return `TONE — Warm mentor (the user chose "${TONE_LABELS.mentor}"): warm, encouraging and reflective. Connect what happened to perspective and lasting habits, offered as ideas the user can take or leave, never as orders or grades.`;
    default:
      return `TONE — Gentle (the user chose "${TONE_LABELS.gentle}"): soft, comforting and low-pressure. Keep numbers simple and few, and focus on small, steady progress.`;
  }
}

/** Words that turn a reflective line into an order or a grade. Never allowed, mentor included. */
export const ORDERS_OR_GRADES = /\b(should|must|need to|have to|make sure|ensure|stop|don'?t forget|remember to|great (job|work)|well done|proud of you|good job)\b/i;
