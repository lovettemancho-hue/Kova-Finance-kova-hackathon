// PayPal sandbox helper for the Money Check-in demo (KOVA-020).
//
//   npm run paypal:check            token works? what the sandbox returns today
//   npm run paypal:seed             create the demo merchants, plans, subscriptions and one-off orders
//   npm run paypal:capture -- <id>  capture one-off orders after approving them as the sandbox buyer
//
// Reads PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET from your local .env (gitignored). Never paste them
// in chat or commit them. Sandbox only: refuses to run against the live PayPal API.
//
// Demo model: Kova's sandbox business account plays the stores (StreamPlus, CloudBox, a cryptic
// "XK*DGTL" charge, FreshMart...). The sandbox PERSONAL account is "the user": it approves the
// subscriptions and orders, and the check-in shows its spending. That is what lets Kova cancel a
// subscription through the API in the demo.

const BASE = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
if (!BASE.includes('sandbox')) {
  console.error('Refusing to run: PAYPAL_BASE_URL is not the sandbox.');
  process.exit(1);
}

async function token(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Token failed (${res.status}): ${body.error || ''} ${body.error_description || ''}`);
  return body.access_token;
}

async function pp(t: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const detail = body?.details?.map((d: any) => `${d.issue}: ${d.description || ''}`).join('; ') || body?.message || body?.raw || '';
    throw new Error(`${init.method || 'GET'} ${path.split('?')[0]} failed (${res.status}) ${body?.name || ''} ${detail}`);
  }
  return body;
}

const ppDate = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '-0000');

const MERCHANTS = [
  { product: 'StreamPlus', plan: 'StreamPlus Premium (monthly)', price: '12.99' },
  { product: 'CloudBox', plan: 'CloudBox 200 GB (monthly)', price: '4.99' },
  { product: 'XK*DGTL SVCS 4471', plan: 'XK Digital Services (monthly)', price: '14.99' }, // the "do you recognise this?" one
];
const ORDERS = [
  { name: 'FreshMart Groceries', amount: '38.40' },
  { name: 'GreenLeaf Cafe', amount: '9.75' },
  { name: 'Book Corner', amount: '18.50' },
];

async function check() {
  const t = await token();
  console.log('Token: OK (sandbox)');
  const end = new Date();
  const start = new Date(end.getTime() - 31 * 864e5);
  try {
    const q = new URLSearchParams({ start_date: ppDate(start), end_date: ppDate(end), fields: 'transaction_info,cart_info', page_size: '100' });
    const tx = await pp(t, `/v1/reporting/transactions?${q}`);
    const rows = tx.transaction_details || [];
    console.log(`Transaction Search: OK, ${rows.length} transaction(s) in the last 31 days`);
    for (const r of rows.slice(0, 10)) {
      const i = r.transaction_info || {};
      const item = r.cart_info?.item_details?.[0]?.item_name || i.transaction_subject || '';
      console.log(`  ${String(i.transaction_initiation_date).slice(0, 10)}  ${i.transaction_event_code}  ${i.transaction_amount?.value} ${i.transaction_amount?.currency_code}  ${item}${i.paypal_reference_id_type === 'SUB' ? `  (sub ${i.paypal_reference_id})` : ''}`);
    }
    if (rows.length === 0) console.log('  (none yet: new sandbox payments can take up to ~3 hours to appear here)');
  } catch (e: any) {
    console.log(`Transaction Search: FAILED - ${e.message}`);
    console.log('  Fix: in the developer dashboard, open the app > Features > tick "Transaction search", save, wait a few minutes.');
  }
  const ids = (process.env.PAYPAL_SUBSCRIPTION_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) console.log('Subscriptions: none listed in PAYPAL_SUBSCRIPTION_IDS yet (run paypal:seed)');
  for (const id of ids) {
    try {
      const s = await pp(t, `/v1/billing/subscriptions/${encodeURIComponent(id)}?fields=plan`);
      console.log(`Subscription ${id}: ${s.status}  ${s.plan?.name || s.plan_id}`);
    } catch (e: any) {
      console.log(`Subscription ${id}: ${e.message}`);
    }
  }
}

async function seed() {
  const t = await token();
  const subIds: string[] = [];
  console.log('Creating demo merchants and subscriptions...\n');
  for (const m of MERCHANTS) {
    const product = await pp(t, '/v1/catalogs/products', {
      method: 'POST',
      body: JSON.stringify({ name: m.product, type: 'SERVICE', category: 'SOFTWARE' }),
    });
    const plan = await pp(t, '/v1/billing/plans', {
      method: 'POST',
      body: JSON.stringify({
        product_id: product.id,
        name: m.plan,
        status: 'ACTIVE',
        billing_cycles: [
          { frequency: { interval_unit: 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: m.price, currency_code: 'USD' } } },
        ],
        payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 1 },
      }),
    });
    const sub = await pp(t, '/v1/billing/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: plan.id,
        application_context: { brand_name: m.product.slice(0, 127), user_action: 'SUBSCRIBE_NOW', return_url: 'https://example.com/approved', cancel_url: 'https://example.com/cancelled' },
      }),
    });
    subIds.push(sub.id);
    const approve = (sub.links || []).find((l: any) => l.rel === 'approve')?.href;
    console.log(`${m.product}  $${m.price}/month  subscription ${sub.id}\n  approve: ${approve}\n`);
  }

  console.log('Creating one-off purchases...\n');
  const orderIds: string[] = [];
  for (const o of ORDERS) {
    const order = await pp(t, '/v2/checkout/orders', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ description: o.name, amount: { currency_code: 'USD', value: o.amount, breakdown: { item_total: { currency_code: 'USD', value: o.amount } } }, items: [{ name: o.name, quantity: '1', unit_amount: { currency_code: 'USD', value: o.amount } }] }],
        application_context: { brand_name: o.name, return_url: 'https://example.com/approved', cancel_url: 'https://example.com/cancelled' },
      }),
    });
    orderIds.push(order.id);
    const approve = (order.links || []).find((l: any) => l.rel === 'approve')?.href;
    console.log(`${o.name}  $${o.amount}  order ${order.id}\n  approve: ${approve}\n`);
  }

  console.log('Next:');
  console.log('1. Open each approve link above and log in as your sandbox PERSONAL account (not the business one). Approve.');
  console.log(`2. Add to .env:  PAYPAL_SUBSCRIPTION_IDS=${subIds.join(',')}`);
  console.log(`3. Capture the purchases:  npm run paypal:capture -- ${orderIds.join(' ')}`);
  console.log('4. Wait up to ~3 hours, then: npm run paypal:check');
}

async function capture(ids: string[]) {
  if (!ids.length) throw new Error('Give the order ids: npm run paypal:capture -- <id> <id>');
  const t = await token();
  for (const id of ids) {
    try {
      const r = await pp(t, `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: 'POST', body: '{}' });
      console.log(`${id}: ${r.status}`);
    } catch (e: any) {
      console.log(`${id}: ${e.message}  (approve it as the sandbox buyer first)`);
    }
  }
}

const [cmd, ...args] = process.argv.slice(2);
const run = cmd === 'seed' ? seed() : cmd === 'capture' ? capture(args) : check();
run.catch((e) => {
  // Node's fetch hides the network reason in e.cause (DNS, timeout, TLS, reset): show it.
  const c = e?.cause;
  const why = c ? ` (${c.code || c.name || ''}${c.message ? `: ${c.message}` : ''})` : '';
  console.error(`${e?.message || e}${why}`);
  if (c?.code === 'ENOTFOUND' || c?.code === 'EAI_AGAIN') console.error('-> Your network could not look up the PayPal sandbox address (DNS). Try again, or another network.');
  if (c?.code === 'UND_ERR_CONNECT_TIMEOUT' || c?.code === 'ETIMEDOUT') console.error('-> The connection to PayPal timed out. Check your internet, VPN or firewall and try again.');
  if (c?.code === 'ECONNRESET') console.error('-> The connection was cut. Usually a network or VPN issue; try again.');
  if (/certificate|CERT/i.test(String(c?.code || c?.message || ''))) console.error('-> A TLS certificate problem, often from antivirus or a company proxy inspecting HTTPS.');
  process.exit(1);
});
