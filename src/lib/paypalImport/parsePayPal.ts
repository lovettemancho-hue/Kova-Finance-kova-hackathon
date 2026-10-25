import { parseCsv } from './csv';

// Reads a PayPal "activity" CSV download entirely on the device. No AI, no network.
//
// IMPORTANT: column names below follow what PayPal's activity export is documented/known
// to use, but they have NOT been checked against a real export yet. Aliases are included
// so small naming differences don't break the import. Verify with a real file.

export interface ImportedTransaction {
  id: string;
  date: string; // ISO string
  amount: number; // always positive; see `direction`
  currency: string;
  direction: 'out' | 'in';
  merchant: string;
  type: 'purchase' | 'subscription_payment' | 'refund' | 'other';
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  transactions: ImportedTransaction[];
  primaryCurrency: string;
  warnings: string[];
  skipped: Record<string, number>;
  rowCount: number;
}

const MAX_CHARS = 8_000_000;
const MAX_ROWS = 20_000;

const NOT_PAYPAL_MESSAGE =
  "This doesn't look like a PayPal activity file. Download your activity as a CSV from PayPal and try again.";

function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findCol(headers: string[], aliases: string[]): number {
  for (const a of aliases) {
    const i = headers.indexOf(a);
    if (i !== -1) return i;
  }
  return -1;
}

// ---------- amounts ----------

export function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.trim();
  if (!s) return null;

  // accounting style (12.99) means negative
  const negative = /^\(.*\)$/.test(s) || /-/.test(s);

  // keep digits and separators only
  s = s.replace(/[^\d.,]/g, '');
  if (!s || !/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    // the separator that appears last is the decimal separator
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // only commas: a single comma followed by 1-2 digits is a decimal comma, otherwise thousands
    const after = s.length - lastComma - 1;
    const count = (s.match(/,/g) || []).length;
    if (count === 1 && (after === 1 || after === 2)) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastDot !== -1) {
    // several dots can only be thousands separators ("1.234.567")
    if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// ---------- dates ----------

export type DateOrder = 'MDY' | 'DMY';

interface DateParts {
  a: number;
  b: number;
  y: number;
}

function splitNumericDate(raw: string): DateParts | null {
  const m = raw.trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
  if (!m) return null;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  return { a: Number(m[1]), b: Number(m[2]), y };
}

export function decideOrder(
  rawDates: string[],
  fallback: DateOrder = 'MDY'
): { order: DateOrder; ambiguous: boolean } {
  let aOver12 = false; // first number > 12 -> must be a day -> DMY
  let bOver12 = false; // second number > 12 -> must be a day -> MDY
  let anyNumeric = false;
  for (const r of rawDates) {
    const p = splitNumericDate(r);
    if (!p) continue;
    anyNumeric = true;
    if (p.a > 12) aOver12 = true;
    if (p.b > 12) bOver12 = true;
  }
  if (aOver12 && !bOver12) return { order: 'DMY', ambiguous: false };
  if (bOver12 && !aOver12) return { order: 'MDY', ambiguous: false };
  if (!anyNumeric) return { order: fallback, ambiguous: false };
  return { order: fallback, ambiguous: !(aOver12 && bOver12) };
}

function parseTime(raw: string | undefined): { h: number; m: number; s: number } {
  const m = (raw || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return { h: 12, m: 0, s: 0 };
  let h = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] ? Number(m[3]) : 0;
  const ap = m[4]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  if (h > 23 || mm > 59 || ss > 59) return { h: 12, m: 0, s: 0 };
  return { h, m: mm, s: ss };
}

export function toIso(
  rawDate: string,
  rawTime: string | undefined,
  order: DateOrder
): string | null {
  const t = parseTime(rawTime);
  const trimmed = rawDate.trim();

  // ISO-like: 2026-03-14 or 2026-03-14T10:00:00Z
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    return buildDate(y, mo, d, t);
  }

  const p = splitNumericDate(trimmed);
  if (p) {
    const month = order === 'MDY' ? p.a : p.b;
    const day = order === 'MDY' ? p.b : p.a;
    return buildDate(p.y, month, day, t);
  }

  // textual months, e.g. "14 Mar 2026" or "Mar 14, 2026"
  const parsed = Date.parse(`${trimmed} UTC`);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return buildDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), t);
  }
  return null;
}

function buildDate(
  y: number,
  mo: number,
  d: number,
  t: { h: number; m: number; s: number }
): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, t.h, t.m, t.s));
  // reject rollovers like 31 Feb
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString();
}

// ---------- classification ----------

const NOT_COMPLETED = /^(pending|denied|cancel+ed|failed|expired|declined|placed|unclaimed|returned|reversed|held)/i;
const REFUND = /refund|chargeback/i;
const INTERNAL =
  /hold|release|conversion|bank deposit|withdraw|transfer|reserve|update to|deposit|top.?up|add funds/i;
const SUBSCRIPTION =
  /subscription|recurring|pre-?approved|automatic|billing agreement|auto-?pay/i;

function cleanText(s: string | undefined): string {
  return (s || '').replace(/\s+/g, ' ').trim();
}

// ---------- main ----------

export function parsePayPalCsv(text: string): ParseResult {
  const empty = (error: string): ParseResult => ({
    ok: false,
    error,
    transactions: [],
    primaryCurrency: 'USD',
    warnings: [],
    skipped: {},
    rowCount: 0,
  });

  if (!text || !text.trim()) return empty('That file is empty.');
  if (text.length > MAX_CHARS) return empty('That file is too large to read here.');

  const rows = parseCsv(text);
  if (rows.length < 2) return empty(NOT_PAYPAL_MESSAGE);

  // find the header row within the first few lines
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const h = rows[i].map(norm);
    const hasDate = h.includes('date');
    const hasAmount = h.includes('gross') || h.includes('amount') || h.includes('net');
    const hasWho = h.includes('name') || h.includes('type') || h.includes('description');
    if (hasDate && hasAmount && hasWho) {
      headerIdx = i;
      headers = h;
      break;
    }
  }
  if (headerIdx === -1) return empty(NOT_PAYPAL_MESSAGE);

  const body = rows.slice(headerIdx + 1);
  if (body.length > MAX_ROWS) return empty('That file has too many rows to read here.');

  const col = {
    date: findCol(headers, ['date']),
    time: findCol(headers, ['time']),
    name: findCol(headers, ['name', 'payee', 'merchant']),
    type: findCol(headers, ['type', 'description']),
    status: findCol(headers, ['status']),
    currency: findCol(headers, ['currency']),
    gross: findCol(headers, ['gross', 'amount', 'net']),
    txId: findCol(headers, ['transactionid', 'txnid', 'transactionreference']),
    item: findCol(headers, ['itemtitle', 'subject']),
    to: findCol(headers, ['toemailaddress']),
    from: findCol(headers, ['fromemailaddress']),
    impact: findCol(headers, ['balanceimpact']),
  };
  const get = (r: string[], i: number): string => (i >= 0 ? (r[i] ?? '') : '');

  const warnings: string[] = [];
  const skipped: Record<string, number> = {};
  const skip = (reason: string) => {
    skipped[reason] = (skipped[reason] || 0) + 1;
  };

  const { order, ambiguous } = decideOrder(body.map((r) => get(r, col.date)));
  if (ambiguous) {
    warnings.push(
      'The dates in this file could be day/month or month/day. They were read as month/day. Check that they look right.'
    );
  }

  interface Draft extends ImportedTransaction {
    _row: number;
  }
  const drafts: Draft[] = [];

  body.forEach((r, idx) => {
    const status = cleanText(get(r, col.status));
    if (status && NOT_COMPLETED.test(status)) return skip('not completed');

    const amount = parseAmount(get(r, col.gross));
    if (amount === null) return skip('unreadable amount');
    if (amount === 0) return skip('zero amount');

    const iso = toIso(get(r, col.date), get(r, col.time), order);
    if (!iso) return skip('unreadable date');

    const typeText = cleanText(get(r, col.type));
    const impact = cleanText(get(r, col.impact)).toLowerCase();

    let direction: 'out' | 'in' = amount < 0 ? 'out' : 'in';
    if (impact === 'debit') direction = 'out';
    else if (impact === 'credit') direction = 'in';
    else if (impact === 'memo') return skip('memo rows');

    let type: ImportedTransaction['type'];
    if (REFUND.test(typeText)) type = 'refund';
    else if (INTERNAL.test(typeText)) return skip('transfers and conversions');
    else if (SUBSCRIPTION.test(typeText)) type = 'subscription_payment';
    else type = direction === 'out' ? 'purchase' : 'other';

    const merchant =
      cleanText(get(r, col.name)) ||
      cleanText(get(r, col.item)) ||
      cleanText(direction === 'out' ? get(r, col.to) : get(r, col.from)) ||
      'Unknown';

    const currency = (cleanText(get(r, col.currency)) || 'USD').toUpperCase().slice(0, 3);
    const txId = cleanText(get(r, col.txId));

    drafts.push({
      _row: idx,
      id: txId || `row-${idx + 1}`,
      date: iso,
      amount: Math.abs(amount),
      currency,
      direction,
      merchant,
      type,
    });
  });

  // de-duplicate rows that share a transaction id, amount, and direction
  const seen = new Set<string>();
  const unique = drafts.filter((d) => {
    if (d.id.startsWith('row-')) return true;
    const key = `${d.id}|${d.amount}|${d.direction}`;
    if (seen.has(key)) {
      skip('duplicate rows');
      return false;
    }
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    return {
      ok: false,
      error: 'No usable transactions were found in that file.',
      transactions: [],
      primaryCurrency: 'USD',
      warnings,
      skipped,
      rowCount: body.length,
    };
  }

  // keep the main currency; report the rest instead of mixing currencies in the totals
  const counts: Record<string, number> = {};
  for (const d of unique) {
    if (d.direction === 'out') counts[d.currency] = (counts[d.currency] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const primaryCurrency = entries[0]?.[0] || unique[0].currency;

  const inPrimary = unique.filter((d) => d.currency === primaryCurrency);
  const otherCount = unique.length - inPrimary.length;
  if (otherCount > 0) {
    warnings.push(
      `${otherCount} transaction${otherCount === 1 ? ' was' : 's were'} in another currency and left out of the totals.`
    );
  }

  const transactions: ImportedTransaction[] = inPrimary
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ _row, ...t }) => t);

  return {
    ok: true,
    transactions,
    primaryCurrency,
    warnings,
    skipped,
    rowCount: body.length,
  };
}
