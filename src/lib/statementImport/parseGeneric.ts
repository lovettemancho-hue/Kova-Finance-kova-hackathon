import { parseCsv } from '../paypalImport/csv';
import { parseAmount, decideOrder, toIso, ImportedTransaction, ParseResult } from '../paypalImport/parsePayPal';

// Reads a bank or mobile-wallet statement CSV on the phone (KOVA-081). No AI, no network.
// Finds the header row, works out which column is the date, description and amount (or
// debit/credit), and reads amounts and dates in the common local formats:
//   1,234.56  1.234,56  1 234,56  (12.99)  12.99-  12.99 DR   $ € £ ₦ FCFA XAF
//   2026-10-21  21/10/2026  10/21/2026  21.10.2026  21 Oct 2026  Oct 21, 2026

export const MAX_STATEMENT_ROWS = 2000;

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

const DATE_HEADERS = ['date', 'transactiondate', 'txndate', 'postingdate', 'posteddate', 'posted', 'bookingdate', 'valuedate', 'transdate', 'datetime', 'completeddate', 'startdate'];
const DESC_HEADERS = ['description', 'details', 'narration', 'narrative', 'payee', 'merchant', 'merchantname', 'name', 'memo', 'particulars', 'transactiondetails', 'transactiondescription', 'reference', 'counterparty', 'beneficiary', 'remarks', 'transaction', 'item'];
const AMOUNT_HEADERS = ['amount', 'amt', 'transactionamount', 'value', 'sum', 'netamount', 'total'];
const DEBIT_HEADERS = ['debit', 'debits', 'debitamount', 'withdrawal', 'withdrawals', 'moneyout', 'paidout', 'out', 'dr', 'spent', 'outflow'];
const CREDIT_HEADERS = ['credit', 'credits', 'creditamount', 'deposit', 'deposits', 'moneyin', 'paidin', 'in', 'cr', 'received', 'inflow'];
const CURRENCY_HEADERS = ['currency', 'ccy', 'currencycode'];
const DRCR_HEADERS = ['drcr', 'type', 'transactiontype', 'debitcredit', 'cddebitcredit'];

const INCOME_WORDS = /\b(salary|payroll|wage|deposit|refund|reversal|interest earned|transfer in|received|cashback|dividend)\b/i;

function findHeader(headers: string[], names: string[]): number {
  for (const n of names) {
    const i = headers.indexOf(n);
    if (i !== -1) return i;
  }
  for (const n of names) {
    if (n.length < 4) continue; // short names only match exactly ("in", "out", "dr")
    const i = headers.findIndex((h) => h.includes(n));
    if (i !== -1) return i;
  }
  return -1;
}

/** Currency named in an amount like "€12,50", "FCFA 12 500" or "12.00 NGN". */
export function currencyFromText(raw: string): string | null {
  const s = raw.toUpperCase();
  if (/FCFA|XAF|\bCFA\b/.test(s)) return 'XAF';
  if (/XOF/.test(s)) return 'XOF';
  if (/₦|NGN/.test(s)) return 'NGN';
  if (/€|EUR/.test(s)) return 'EUR';
  if (/£|GBP/.test(s)) return 'GBP';
  if (/KES|KSH/.test(s)) return 'KES';
  if (/GHS|GH₵|₵/.test(s)) return 'GHS';
  if (/ZAR|\bR\s?\d/.test(s)) return 'ZAR';
  if (/USD|US\$/.test(s)) return 'USD';
  return null;
}

/** Amount with sign: negative = money out. Handles "12.99 DR", "12.99-", "(12.99)". */
export function signedAmount(raw: string): number | null {
  const s = (raw || '').trim();
  if (!s) return null;
  const n = parseAmount(s.replace(/\b(DR|CR)\b/gi, ''));
  if (n === null) return null;
  if (/\bDR\b/i.test(s) || /\d\s*-$/.test(s)) return -Math.abs(n);
  if (/\bCR\b/i.test(s)) return Math.abs(n);
  return n;
}

function cleanMerchant(raw: string): string {
  return (raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^(pos|card|debit card|visa|mastercard)\s+(purchase|payment|transaction)\s*(to|at|-)?\s*/i, '')
    .replace(/^(payment to|purchase at|transfer to)\s+/i, '')
    .trim()
    .slice(0, 80);
}

export interface GenericParseResult extends ParseResult {
  /** Which columns were used, so the review screen can say how the file was read. */
  mapping?: { date: string; description: string; amount?: string; debit?: string; credit?: string };
}

export function parseGenericCsv(text: string, opts: { defaultCurrency?: string } = {}): GenericParseResult {
  const fail = (error: string): GenericParseResult => ({ ok: false, error, transactions: [], primaryCurrency: opts.defaultCurrency || 'USD', warnings: [], skipped: {}, rowCount: 0 });
  if (!text || !text.trim()) return fail('That file is empty.');

  const rows = parseCsv(text);
  if (rows.length < 2) return fail("That file doesn't have enough rows to read.");

  // Header row: the first of the top 15 rows with a date column and an amount (or debit/credit) column.
  let headerIdx = -1;
  let headers: string[] = [];
  let col = { date: -1, desc: -1, amount: -1, debit: -1, credit: -1, currency: -1, drcr: -1 };
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const h = rows[i].map(norm);
    const c = {
      date: findHeader(h, DATE_HEADERS),
      desc: findHeader(h, DESC_HEADERS),
      amount: findHeader(h, AMOUNT_HEADERS),
      debit: findHeader(h, DEBIT_HEADERS),
      credit: findHeader(h, CREDIT_HEADERS),
      currency: findHeader(h, CURRENCY_HEADERS),
      drcr: findHeader(h, DRCR_HEADERS),
    };
    if (c.date !== -1 && (c.amount !== -1 || c.debit !== -1 || c.credit !== -1)) {
      headerIdx = i;
      headers = rows[i];
      col = c;
      break;
    }
  }

  // No header: accept the simple "date, description, amount" layout.
  if (headerIdx === -1) {
    const first = rows[0];
    if (first.length >= 3 && toIso(first[0], undefined, 'DMY') && signedAmount(first[2]) !== null) {
      headerIdx = -1;
      col = { date: 0, desc: 1, amount: 2, debit: -1, credit: -1, currency: -1, drcr: -1 };
    } else {
      return fail("Kova couldn't find the date and amount columns in that file.");
    }
  }
  if (col.desc === -1) {
    // Use the first text column that isn't date/amount as the description.
    const used = new Set([col.date, col.amount, col.debit, col.credit, col.currency, col.drcr]);
    const sample = rows[headerIdx + 1] || [];
    col.desc = sample.findIndex((v, i) => !used.has(i) && /[a-z]/i.test(v || ''));
  }

  let body = rows.slice(headerIdx + 1);
  const warnings: string[] = [];
  if (body.length > MAX_STATEMENT_ROWS) {
    warnings.push(`Only the first ${MAX_STATEMENT_ROWS} rows were read. Import a shorter date range for the rest.`);
    body = body.slice(0, MAX_STATEMENT_ROWS);
  }
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

  // Currency: a currency column, else a symbol in the amounts, else the user's currency.
  const amountSamples = body.slice(0, 50).map((r) => `${get(r, col.amount)} ${get(r, col.debit)} ${get(r, col.credit)}`).join(' ');
  const headerText = headers.join(' ');
  const fileCurrency = currencyFromText(amountSamples) || currencyFromText(headerText) || (opts.defaultCurrency || 'USD').toUpperCase();

  // Dates: decide day/month order from the whole column; ambiguous files follow the currency's habit.
  const fallbackOrder = fileCurrency === 'USD' ? 'MDY' : 'DMY';
  const { order, ambiguous } = decideOrder(body.map((r) => get(r, col.date)), fallbackOrder);
  if (ambiguous) {
    warnings.push(`Dates were read as ${order === 'DMY' ? 'day/month' : 'month/day'}. Check that they look right.`);
  }

  const singleColumn = col.amount !== -1 && col.debit === -1 && col.credit === -1;
  const signs = singleColumn ? body.map((r) => signedAmount(get(r, col.amount))).filter((n): n is number => n !== null) : [];
  const hasNegatives = signs.some((n) => n < 0);

  const skipped: Record<string, number> = {};
  const skip = (why: string) => (skipped[why] = (skipped[why] || 0) + 1);
  const transactions: ImportedTransaction[] = [];

  body.forEach((r, idx) => {
    const iso = toIso(get(r, col.date), undefined, order);
    if (!iso) return void skip('unreadable date');
    const merchant = cleanMerchant(get(r, col.desc)) || 'Unknown';

    let amount: number | null = null;
    let direction: 'out' | 'in' = 'out';
    if (singleColumn) {
      amount = signedAmount(get(r, col.amount));
      if (amount === null) return void skip('unreadable amount');
      const drcr = get(r, col.drcr).toUpperCase();
      if (/^(D|DR|DEBIT)/.test(drcr)) direction = 'out';
      else if (/^(C|CR|CREDIT)/.test(drcr)) direction = 'in';
      else if (hasNegatives) direction = amount < 0 ? 'out' : 'in';
      else direction = INCOME_WORDS.test(merchant) ? 'in' : 'out'; // all positive: a card statement
    } else {
      const debit = signedAmount(get(r, col.debit));
      const credit = signedAmount(get(r, col.credit));
      if (debit !== null && debit !== 0) {
        amount = debit;
        direction = 'out';
      } else if (credit !== null && credit !== 0) {
        amount = credit;
        direction = 'in';
      } else return void skip('no amount');
    }
    if (!amount) return void skip('zero amount');

    const rowCurrency = (get(r, col.currency) || '').toUpperCase().slice(0, 3);
    transactions.push({
      id: `row-${idx + 1}`,
      date: iso,
      amount: Math.round(Math.abs(amount) * 100) / 100,
      currency: /^[A-Z]{3}$/.test(rowCurrency) ? rowCurrency : fileCurrency,
      direction,
      merchant,
      type: direction === 'in' ? (/refund|reversal/i.test(merchant) ? 'refund' : 'other') : 'purchase',
    });
  });

  if (transactions.length === 0) {
    return { ...fail('No usable transactions were found in that file.'), skipped, rowCount: body.length, warnings };
  }
  const name = (i: number) => (i >= 0 && headers[i] ? headers[i].trim() : undefined);
  return {
    ok: true,
    transactions: transactions.sort((a, b) => a.date.localeCompare(b.date)),
    primaryCurrency: fileCurrency,
    warnings,
    skipped,
    rowCount: body.length,
    mapping: {
      date: name(col.date) || 'column 1',
      description: name(col.desc) || 'column 2',
      ...(singleColumn ? { amount: name(col.amount) || 'column 3' } : { debit: name(col.debit), credit: name(col.credit) }),
    },
  };
}
