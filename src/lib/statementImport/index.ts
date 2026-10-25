import { parsePayPalCsv, ImportedTransaction } from '../paypalImport/parsePayPal';
import { analyze, Analysis, merchantKey, prettyName } from '../paypalImport/analyze';
import { parseGenericCsv } from './parseGeneric';
import { localCategory, ImportCategory } from './categorize';

export * from './categorize';
export { parseGenericCsv, MAX_STATEMENT_ROWS, signedAmount, currencyFromText } from './parseGeneric';

// One call for the import window (KOVA-081): read a PayPal, bank or wallet statement on the phone,
// find recurring charges and unfamiliar names, and mark rows that are already in the log.

export interface StatementRow {
  id: string;
  date: string; // ISO
  label: string;
  amount: number;
  currency: string;
  type: 'outcome' | 'income';
  category: ImportCategory;
  duplicate: boolean; // already in the user's log (same day, amount and a similar name)
}

export interface StatementResult {
  ok: boolean;
  error?: string;
  source: 'paypal' | 'bank';
  rows: StatementRow[];
  analysis: Analysis | null;
  /** Unfamiliar-looking names, minus ones Kova could categorise (e.g. "SHELL OIL 5520" is fuel). */
  unfamiliar: string[];
  currency: string;
  warnings: string[];
  mapping?: { date: string; description: string; amount?: string; debit?: string; credit?: string };
}

export interface ExistingEntry {
  label: string;
  amount: number;
  timestamp: string;
  nativeCurrency?: string;
}

function looksLikePayPal(text: string): boolean {
  const head = text.slice(0, 2000).toLowerCase();
  return /\bgross\b/.test(head) && /\b(balance impact|transaction id|from email address)\b/.test(head);
}

const day = (iso: string) => iso.slice(0, 10);

function isDuplicate(t: ImportedTransaction, existing: ExistingEntry[]): boolean {
  const key = merchantKey(t.merchant);
  return existing.some((e) => {
    const d = new Date(e.timestamp || '');
    if (Number.isNaN(d.getTime()) || day(d.toISOString()) !== day(t.date)) return false;
    if (Math.abs(Number(e.amount) - t.amount) > 0.009) return false;
    if (e.nativeCurrency && e.nativeCurrency !== t.currency) return false;
    const ek = merchantKey(e.label || '');
    return !ek || !key || ek.includes(key) || key.includes(ek);
  });
}

export function readStatement(
  text: string,
  opts: { defaultCurrency?: string; existing?: ExistingEntry[]; asOf?: Date } = {}
): StatementResult {
  const paypal = looksLikePayPal(text);
  const parse = paypal ? parsePayPalCsv(text) : parseGenericCsv(text, { defaultCurrency: opts.defaultCurrency });
  if (!parse.ok) {
    return { ok: false, error: parse.error, source: paypal ? 'paypal' : 'bank', rows: [], analysis: null, unfamiliar: [], currency: parse.primaryCurrency, warnings: parse.warnings };
  }
  const analysis = analyze(parse.transactions, { asOf: opts.asOf });
  const recurringKeys = new Set(analysis.recurring.map((r) => r.key));
  const existing = opts.existing || [];

  const rows: StatementRow[] = parse.transactions
    .filter((t) => t.type !== 'other' || t.direction === 'in')
    .map((t) => {
      const recurring = t.type === 'subscription_payment' || recurringKeys.has(merchantKey(t.merchant));
      return {
        id: `${paypal ? 'pp' : 'st'}-${t.id}-${t.date.slice(0, 10)}`,
        date: t.date,
        label: t.merchant,
        amount: t.amount,
        currency: t.currency,
        type: t.direction === 'in' ? 'income' : 'outcome',
        category: localCategory(t.merchant, t.direction, recurring),
        duplicate: isDuplicate(t, existing),
      };
    });

  return {
    ok: true,
    source: paypal ? 'paypal' : 'bank',
    rows,
    analysis,
    unfamiliar: Array.from(new Set(analysis.unfamiliar.map((u) => u.merchant).filter((m) => localCategory(m, 'out') === 'Other'))),
    currency: parse.primaryCurrency,
    warnings: parse.warnings,
    mapping: (parse as any).mapping,
  };
}

/** The short "what Kova noticed" line after an import. Facts only, from analyze(). */
export function insightLine(a: Analysis | null, money: (n: number, c: string) => string, unfamiliar?: string[]): string {
  if (!a) return '';
  const odd = unfamiliar ?? a.unfamiliar.map((u) => u.merchant);
  const parts: string[] = [];
  // Rent repeats too, but it isn't what people forget about, so the line is about the rest.
  const active = a.recurring.filter((r) => r.stillActive && localCategory(r.merchant, 'out') !== 'Housing');
  if (active.length) {
    const list = active
      .slice(0, 3)
      .map((r) => `${prettyName(r.merchant)} (${money(r.latestAmount, r.currency)}/${r.interval === 'yearly' ? 'yr' : r.interval === 'weekly' ? 'wk' : 'mo'})`);
    const more = active.length > 3 ? ` and ${active.length - 3} more` : '';
    const joined = list.length > 1 && !more ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list.join(', ');
    parts.push(`${active.length} recurring charge${active.length === 1 ? '' : 's'}: ${joined}${more}`);
  }
  if (odd.length) {
    parts.push(`${odd.length === 1 ? '1 name looks' : `${odd.length} names look`} unfamiliar: ${odd.slice(0, 2).join(', ')}`);
  }
  return parts.join('. ');
}
