// Simple in-memory TTL cache, scoped to the Node process.
// Good enough for an MVP to avoid hammering OpenDota on repeated page loads;
// not shared across serverless instances or persisted across restarts.

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }
  const value = await fetcher();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Drops a cached entry so the next `cached()` call for it re-fetches - for
 * when we know the underlying data just changed (e.g. a replay just got
 * parsed), not just when the TTL happens to expire. */
export function invalidate(key: string): void {
  store.delete(key);
}
