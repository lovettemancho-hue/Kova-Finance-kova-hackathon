/**
 * Collision-resistant unique ID generator using crypto.randomUUID()
 * with a fallback for older environments.
 */
export function generateUniqueId(prefix?: string): string {
  let uniquePart: string;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    uniquePart = crypto.randomUUID();
  } else {
    // Fallback: high-entropy pseudo-random string
    const rand = Math.random().toString(36).substring(2, 10);
    const time = Date.now().toString(36);
    const perf = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000).toString(36) : '';
    uniquePart = `${time}-${rand}-${perf}`;
  }

  return prefix ? `${prefix}-${uniquePart}` : uniquePart;
}
