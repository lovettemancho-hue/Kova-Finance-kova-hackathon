import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStatement, parseGenericCsv, signedAmount, currencyFromText, insightLine } from './index';

const money = (n: number, c: string) => `${n.toFixed(2)} ${c}`;

test('US bank export: signed amounts, month/day dates, quoted apostrophes', () => {
  const csv = `Date,Description,Amount
10/02/2026,"McDonald's #1234",-8.45
10/05/2026,STARBUCKS STORE 99,-5.10
10/15/2026,PAYROLL ACME INC,2500.00
10/21/2026,"Trader Joe's",-62.30`;
  const r = parseGenericCsv(csv, { defaultCurrency: 'USD' });
  assert.equal(r.ok, true);
  assert.equal(r.transactions.length, 4);
  const mc = r.transactions.find((t) => t.merchant.startsWith('McDonald'))!;
  assert.equal(mc.merchant, "McDonald's #1234");
  assert.equal(mc.amount, 8.45);
  assert.equal(mc.direction, 'out');
  assert.equal(mc.date.slice(0, 10), '2026-10-02');
  assert.equal(r.transactions.find((t) => /PAYROLL/.test(t.merchant))!.direction, 'in');
});

test('European export: semicolons, 1.234,56 amounts, day.month dates, euro', () => {
  const csv = `Buchungstag;Verwendungszweck;Betrag
21.10.2026;REWE Markt;-1.234,56 €
22.10.2026;Gehalt Oktober;2.500,00 €`;
  // German headers aren't known, but the simple 3-column layout falls back cleanly
  const r = parseGenericCsv(`Date;Description;Amount\n${csv.split('\n').slice(1).join('\n')}`, { defaultCurrency: 'USD' });
  assert.equal(r.ok, true);
  assert.equal(r.primaryCurrency, 'EUR');
  assert.equal(r.transactions[0].amount, 1234.56);
  assert.equal(r.transactions[0].date.slice(0, 10), '2026-10-21');
});

test('Cameroon wallet export: debit/credit columns in FCFA with spaces', () => {
  const csv = `Transaction Date,Details,Debit,Credit,Balance
21/10/2026,Achat Santa Lucia,12 500,,87 500
22/10/2026,Transfert reçu,,50 000,137 500
23/10/2026,Taxi Bolt,2 000,,135 500`;
  const r = parseGenericCsv(csv, { defaultCurrency: 'XAF' });
  assert.equal(r.ok, true);
  assert.equal(r.primaryCurrency, 'XAF');
  assert.deepEqual(r.transactions.map((t) => [t.amount, t.direction]), [[12500, 'out'], [50000, 'in'], [2000, 'out']]);
  assert.equal(r.mapping?.debit, 'Debit');
});

test('amount and currency helpers', () => {
  assert.equal(signedAmount('12.99 DR'), -12.99);
  assert.equal(signedAmount('12.99-'), -12.99);
  assert.equal(signedAmount('(12.99)'), -12.99);
  assert.equal(signedAmount('1,234.56'), 1234.56);
  assert.equal(currencyFromText('FCFA 12 500'), 'XAF');
  assert.equal(currencyFromText('₦5,000'), 'NGN');
});

test('PayPal export is recognised and recurring charges and unfamiliar names are found', () => {
  const header = '"Date","Time","TimeZone","Name","Type","Status","Currency","Gross","Fee","Net","Transaction ID","Balance Impact"';
  const row = (d: string, name: string, type: string, gross: string, id: string) => `"${d}","10:00:00","UTC","${name}","${type}","Completed","USD","${gross}","0.00","${gross}","${id}","Debit"`;
  const csv = [
    header,
    row('07/21/2026', 'StreamPlus', 'Preapproved Payment Bill User Payment', '-12.99', 'A1'),
    row('08/21/2026', 'StreamPlus', 'Preapproved Payment Bill User Payment', '-12.99', 'A2'),
    row('09/21/2026', 'StreamPlus', 'Preapproved Payment Bill User Payment', '-12.99', 'A3'),
    row('10/21/2026', 'StreamPlus', 'Preapproved Payment Bill User Payment', '-12.99', 'A4'),
    row('10/12/2026', 'XK*DGTL SVCS 4471', 'Express Checkout Payment', '-14.99', 'B1'),
    row('10/14/2026', 'FreshMart Groceries', 'Express Checkout Payment', '-38.40', 'C1'),
  ].join('\n');
  const r = readStatement(csv, { defaultCurrency: 'USD', asOf: new Date('2026-10-22T00:00:00Z') });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'paypal');
  assert.equal(r.rows.find((x) => x.label === 'StreamPlus')!.category, 'Subscriptions');
  assert.equal(r.rows.find((x) => x.label === 'FreshMart Groceries')!.category, 'Grocery');
  const line = insightLine(r.analysis, money, r.unfamiliar);
  assert.match(line, /StreamPlus/);
  assert.match(line, /XK\*DGTL SVCS 4471/);
});

test('store numbers on known brands are not called unfamiliar', () => {
  const csv = `Date,Description,Amount\n10/18/2026,AMAZON MKTPL*2K4,-33.90\n10/20/2026,SHELL OIL 5520,-41.00\n10/21/2026,XK*DGTL SVCS 4471,-14.99`;
  const r = readStatement(csv, { defaultCurrency: 'USD' });
  assert.deepEqual(r.unfamiliar, ['XK*DGTL SVCS 4471']);
});

test('rows already in the log are marked as duplicates', () => {
  const csv = `Date,Description,Amount\n2026-10-21,Trader Joe's,-62.30\n2026-10-22,Uber trip,-14.00`;
  const r = readStatement(csv, {
    defaultCurrency: 'USD',
    existing: [{ label: "Trader Joe's", amount: 62.3, timestamp: '2026-10-21T15:00:00Z', nativeCurrency: 'USD' }, { label: 'Lunch', amount: 5, timestamp: 'Just Now' }],
  });
  assert.deepEqual(r.rows.map((x) => [x.label, x.duplicate, x.category]), [["Trader Joe's", true, 'Grocery'], ['Uber trip', false, 'Travel']]);
});

test('files without date or amount columns are refused with a clear message', () => {
  const r = parseGenericCsv('Name,Email\nJane,jane@example.com');
  assert.equal(r.ok, false);
  assert.match(r.error || '', /date and amount/);
});

test('rent is Housing', () => {
  const r = readStatement('Date,Description,Amount\n10/01/2026,RENT OCTOBER - OAK APARTMENTS,-1200.00', { defaultCurrency: 'USD' });
  assert.equal(r.rows[0].category, 'Housing');
});

test('rent stays Housing even when it repeats; two different-priced orders are not recurring', async () => {
  const { localCategory } = await import('./categorize');
  assert.equal(localCategory('OAK APARTMENTS RENT', 'out', true), 'Housing');
  assert.equal(localCategory('NETFLIX.COM', 'out', true), 'Subscriptions');
  const r = readStatement(
    'Date,Description,Amount\n09/18/2026,AMAZON MKTPL*2K4,-24.50\n10/18/2026,AMAZON MKTPL*2K4,-61.20\n08/02/2026,OAK APARTMENTS RENT,-1200.00\n09/02/2026,OAK APARTMENTS RENT,-1200.00\n10/02/2026,OAK APARTMENTS RENT,-1200.00',
    { defaultCurrency: 'USD' }
  );
  assert.ok(r.rows.filter((x) => /AMAZON/.test(x.label)).every((x) => x.category === 'Shopping'));
  assert.ok(r.rows.filter((x) => /RENT/.test(x.label)).every((x) => x.category === 'Housing'));
});
