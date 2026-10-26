// Which chat messages go to the PayPal agent (KOVA-099). Pure, so it can be unit-tested
// (src/utils/paypalIntent.test.ts); src/utils/paypalClient.ts re-exports it.
//
// "PayPal" is matched with one typo allowed ("payapl", "paypall", "pyapal", "pay pal"), because a
// question with a typo used to fall through to the normal chat, which answered from the user's own logs
// and contradicted the PayPal check-in shown just above it.

const TARGET = 'paypal';

/** Edit distance with adjacent swaps counted as one edit (optimal string alignment). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** True for "paypal" and close misspellings of it. Short or unrelated words ("pay", "payday", "paper") are not matched. */
export function looksLikePayPal(word: string): boolean {
  const w = word.toLowerCase();
  if (w === TARGET || w === `${TARGET}s` || w === `${TARGET}'s`) return true;
  if (w.length < 5 || w.length > 8 || w[0] !== 'p') return false;
  return editDistance(w, TARGET) <= 1;
}

/** Messages that go to the PayPal agent instead of the normal chat (only for invited, connected accounts). */
export function isPayPalQuestion(text: string): boolean {
  if (!text || text.trim().length > 500) return false;
  const joined = text.replace(/\bpay\s+pal\b/gi, 'paypal');
  return (joined.match(/[a-z']+/gi) || []).some(looksLikePayPal);
}
