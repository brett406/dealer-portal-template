/**
 * Simple in-memory cache with TTL.
 * For production, consider Redis or Next.js unstable_cache.
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlSeconds: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function invalidateCache(keyPrefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

export function invalidateAll(): void {
  store.clear();
}

/**
 * Cache-through helper: returns cached value or calls factory, caches result.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = getCached<T>(key);
  if (existing !== null) return existing;

  const data = await factory();
  setCached(key, data, ttlSeconds);
  return data;
}
