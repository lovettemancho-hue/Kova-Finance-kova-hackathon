// Categories for imported rows (KOVA-081). Clear names are categorised here on the phone; only the
// names left as "Other" are sent (names only, no amounts or dates) to Gemini for a guess.

export const IMPORT_CATEGORIES = [
  'Shopping', 'Grocery', 'Coffee', 'Dining out', 'Subscriptions', 'Travel', 'Housing', 'Car repair', 'Gym', 'Laundry', 'Income', 'Other',
] as const;
export type ImportCategory = (typeof IMPORT_CATEGORIES)[number];

const RULES: Array<[RegExp, ImportCategory]> = [
  [/\b(rent|loyer|mortgage|landlord|apartments?|property management|housing)\b/i, 'Housing'],
  [/\b(netflix|spotify|hulu|disney|youtube premium|apple\.com\/bill|icloud|google (one|storage)|prime video|patreon|chatgpt|openai|adobe|canva|dropbox|subscription|abonnement|canal\+?|dstv|showmax|streamplus|cloudbox)/i, 'Subscriptions'],
  [/\b(coffee|starbucks|cafe|café|espresso|costa|dunkin|tim hortons)\b/i, 'Coffee'],
  [/\b(grocer|groceries|supermarket|supermarch|market|march[eé]|walmart grocery|whole foods|trader joe|aldi|lidl|tesco|carrefour|shoprite|spar|santa lucia|mahima|dovv|freshmart)/i, 'Grocery'],
  [/\b(restaurant|dining|dinner|lunch|breakfast|brunch|meal|diner|bistro|grill|pizza|burger|kfc|mcdonald|subway|chicken|uber eats|doordash|glovo|jumia food|bolt food|takeaway|food)\b/i, 'Dining out'],
  [/\b(uber|bolt|lyft|taxi|moto|airline|airways|flight|vol|hotel|h[oô]tel|airbnb|booking\.com|train|bus|fuel|petrol|essence|carburant|gas station|shell|total ?energies|parking|transport)\b/i, 'Travel'],
  [/\b(gym|fitness|crossfit|yoga|planet fitness)\b/i, 'Gym'],
  [/\b(laundry|laundromat|dry clean)/i, 'Laundry'],
  [/\b(mechanic|garage|auto repair|car repair|tyre|tire|car wash|oil change)\b/i, 'Car repair'],
  [/\b(amazon|jumia|ebay|aliexpress|temu|shein|zara|h&m|nike|adidas|store|shop|mall|book corner|bookstore|books)\b/i, 'Shopping'],
];

export function localCategory(merchant: string, direction: 'out' | 'in', isRecurring = false): ImportCategory {
  if (direction === 'in') return 'Income';
  // Rent repeats every month but isn't a subscription, so Housing is checked first.
  if (RULES[0][0].test(merchant)) return 'Housing';
  if (isRecurring) return 'Subscriptions';
  for (const [re, cat] of RULES) if (re.test(merchant)) return cat;
  return 'Other';
}

export function isImportCategory(v: unknown): v is ImportCategory {
  return typeof v === 'string' && (IMPORT_CATEGORIES as readonly string[]).includes(v);
}
