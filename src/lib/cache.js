// Tiny in-memory cache for the lifetime of the page session.
// - cachedQuery(key, fetcher) -> reuse if cached, otherwise fetch and store.
// - invalidate(prefix) -> wipe everything whose key starts with `prefix`,
//   call after a write that would make cached data stale.
// - A full browser refresh resets everything (because it's in JS memory).
const cache = new Map();

export async function cachedQuery(key, fetcher) {
  if (cache.has(key)) return cache.get(key);
  const data = await fetcher();
  cache.set(key, data);
  return data;
}

export function invalidate(prefix) {
  for (const k of [...cache.keys()]) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}

export function clearAll() {
  cache.clear();
}
