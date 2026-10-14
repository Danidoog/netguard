interface CacheEntry<T> {
  expiresAt: number;
  value?: T;
  pending?: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 30_000,
): Promise<T> {
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing?.pending) return existing.pending;
  if (existing && existing.expiresAt > Date.now() && 'value' in existing) {
    return Promise.resolve(existing.value as T);
  }

  const entry: CacheEntry<T> = { expiresAt: Date.now() + ttl };
  entry.pending = fetcher().then(
    (value) => {
      entry.value = value;
      entry.pending = undefined;
      entry.expiresAt = Date.now() + ttl;
      return value;
    },
    (error: unknown) => {
      cache.delete(key);
      throw error;
    },
  );
  cache.set(key, entry);
  return entry.pending;
}

export function invalidateCache(keyPrefix?: string): void {
  if (keyPrefix === undefined) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) cache.delete(key);
  }
}
