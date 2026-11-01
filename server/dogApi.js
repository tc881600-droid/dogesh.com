'use strict';
/**
 * Server-side proxy for dog.ceo with a tiny in-memory TTL cache.
 * Keeps the browser off third-party endpoints and shields the app from rate limits.
 */
const BASE = process.env.DOG_API || 'https://dog.ceo/api';
const TTL = Number(process.env.DOG_CACHE_TTL_MS || 15 * 60 * 1000);
const cache = new Map();

async function cachedJson(pathname) {
  const key = pathname;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const res = await fetch(`${BASE}${pathname}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`dog.ceo responded ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error('dog.ceo returned an unexpected payload');
  cache.set(key, { value: json, expires: Date.now() + TTL });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return json;
}

/** Random image URL for a path like `/breeds/image/random` or `/breed/pug/images/random`. */
async function randomImage(pathname) {
  const json = await cachedJson(pathname);
  return Array.isArray(json.message) ? json.message : json.message;
}

module.exports = { cachedJson, randomImage, BASE };
