import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANNEL3_URL, createChannel3Client, isSpecificItem, mainImage, pickQuote, shortTitle, specificWords, statsFromHistory, titleMatches } from './channel3';

const offer = (price: number, domain: string, availability = 'InStock', currency = 'USD') => ({
  url: `https://${domain}/p`,
  domain,
  price: { price, currency },
  availability,
});
const sony = {
  id: 'p1',
  title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones - Black',
  offers: [offer(399.99, 'sony.com'), offer(328, 'bestbuy.com'), offer(299, 'ebay.com', 'OutOfStock'), offer(348, 'amazon.com')],
};
const bose = { id: 'p2', title: 'Bose QuietComfort Ultra Headphones', offers: [offer(429, 'bose.com')] };

test('only specific items are priced (KOVA-101)', () => {
  for (const item of ['sony headphones', 'sony wh-1000xm5', 'iphone 16 pro', 'airpods pro 2', 'nintendo switch 2']) {
    assert.equal(isSpecificItem(item), true, item);
  }
  for (const item of ['it', 'headphones', 'new phone', 'a holiday', 'dinner out', 'some shoes', '']) {
    assert.equal(isSpecificItem(item), false, item);
  }
  assert.deepEqual(specificWords('a new pair of Sony headphones'), ['sony']);
});

test('a result is used only when its title has every specific word', () => {
  assert.equal(titleMatches(sony.title, 'sony headphones'), true);
  assert.equal(titleMatches(sony.title, 'sony wh1000xm5'), true); // dashes and spaces ignored
  assert.equal(titleMatches(sony.title, 'bose headphones'), false);
  assert.equal(titleMatches('Apple iPhone 15 Pro 128GB', 'iphone 16'), false);
});

test('the quote is the lowest in-stock price of the first matching product', () => {
  const q = pickQuote([bose, sony], 'sony headphones', 'USD')!;
  assert.equal(q.productId, 'p1'); // Bose skipped: wrong brand
  assert.equal(q.price, 328);
  assert.equal(q.domain, 'bestbuy.com');
  assert.equal(q.stores, 3); // the out-of-stock eBay offer doesn't count
  assert.equal(q.maxPrice, 399.99);
  assert.equal(q.source, 'Channel3');
  assert.equal(pickQuote([bose], 'sony headphones'), null);
  assert.equal(pickQuote('nonsense', 'sony headphones'), null);
});

test('offers in the user currency win; bad data is ignored', () => {
  const mixed = { id: 'p3', title: 'Sony WH-1000XM5', offers: [offer(328, 'bestbuy.com'), offer(379, 'amazon.de', 'InStock', 'EUR')] };
  assert.equal(pickQuote([mixed], 'sony wh-1000xm5', 'EUR')!.currency, 'EUR');
  assert.equal(pickQuote([mixed], 'sony wh-1000xm5', 'XAF')!.currency, 'USD'); // falls back to USD
  const junk = { title: 'Sony WH-1000XM5', offers: [offer(-5, 'x.com'), offer(10, 'not a domain'), { price: { price: 'free' } }] };
  assert.equal(pickQuote([junk], 'sony wh-1000xm5'), null);
});

test('short product names for the card and the log', () => {
  assert.equal(shortTitle(sony.title), 'Sony WH-1000XM5 Wireless Noise Canceling…');
  assert.equal(shortTitle('Apple AirPods Pro (2nd generation)'), 'Apple AirPods Pro');
});

test('client: sends only the item name with the key in a header, caches, and reports HTTP errors', async () => {
  const calls: any[] = [];
  const fake = async (url: any, init: any) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ products: [sony] }), { status: 200 });
  };
  const c3 = createChannel3Client({ apiKey: 'test-key', fetchImpl: fake as any });
  const q = await c3.lookup('sony headphones', 'USD');
  assert.equal(q!.price, 328);
  assert.equal(calls[0].url, CHANNEL3_URL);
  assert.equal(calls[0].init.headers['x-api-key'], 'test-key');
  assert.deepEqual(Object.keys(JSON.parse(calls[0].init.body)).sort(), ['filters', 'limit', 'query']);
  await c3.lookup('Sony  headphones', 'USD'); // same item: served from cache
  assert.equal(calls.length, 1);

  const failing = createChannel3Client({ apiKey: 'k', fetchImpl: (async () => new Response('{}', { status: 429 })) as any });
  await assert.rejects(failing.lookup('sony headphones'), /channel3_http_429/);
  await assert.rejects(createChannel3Client({}).lookup('sony headphones'), /not_configured/);
});

test('price watch calls: product by id, start tracking, 30-day stats (KOVA-102)', async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fake = async (url: any, init: any) => {
    calls.push({ url, method: init.method, body: init.body });
    if (String(url).includes('/v1/products/')) return new Response(JSON.stringify(sony), { status: 200 });
    if (String(url).includes('/history/')) {
      return new Response(JSON.stringify({ history: [1, 2, 3].map((i) => ({ price: 300 + i, currency: 'USD' })), statistics: { min_price: 299, max_price: 399, current_status: 'low', currency: 'USD' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ canonical_product_id: 'p1', subscription_status: 'active' }), { status: 200 });
  };
  const c3 = createChannel3Client({ apiKey: 'k', fetchImpl: fake as any });
  const q = await c3.currentQuote('p1', 'USD');
  assert.equal(q!.price, 328);
  assert.match(calls[0].url, /\/v1\/products\/p1$/);
  await c3.startTracking('p1');
  assert.deepEqual(JSON.parse(calls[1].body!), { canonical_product_id: 'p1' });
  const stats = await c3.priceStats('p1');
  assert.deepEqual(stats, { min: 299, max: 399, currency: 'USD', status: 'low', points: 3 });
});

test('price stats need a few data points', () => {
  assert.equal(statsFromHistory({ history: [{}], statistics: { min_price: 1, max_price: 2, current_status: 'low' } }), null);
  assert.equal(statsFromHistory({ history: [{}, {}, {}], statistics: null }), null);
  assert.equal(statsFromHistory({ history: [{}, {}, {}], statistics: { min_price: 1, max_price: 2, current_status: 'odd' } }), null);
});

test('product photo: main image, https only (KOVA-103)', () => {
  assert.equal(mainImage([{ url: 'https://img.example.com/a.jpg' }, { url: 'https://img.example.com/main.jpg', is_main_image: true }]), 'https://img.example.com/main.jpg');
  assert.equal(mainImage([{ url: 'http://img.example.com/a.jpg' }]), undefined);
  assert.equal(mainImage([{ url: 'javascript:alert(1)' }]), undefined);
  assert.equal(mainImage(null), undefined);
  const q = pickQuote([{ ...sony, images: [{ url: 'https://img.example.com/sony.jpg', is_main_image: true }] }], 'sony headphones')!;
  assert.equal(q.imageUrl, 'https://img.example.com/sony.jpg');
});
