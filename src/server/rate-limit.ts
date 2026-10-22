// Fixed-window, in-memory limiter. Good enough for a single app instance;
// move to Redis or the database if the app is ever run on several instances.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hitRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count++;
  return bucket.count > limit;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
