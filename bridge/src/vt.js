const IP_RE = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function isIp(value) {
  return typeof value === 'string' && IP_RE.test(value);
}

export function createVtEnricher({
  apiKey,
  cacheTtlMs,
  requestsPerMinute,
  fetchImpl = fetch,
  nowImpl = Date.now,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const cache = new Map();
  const intervalMs = 60000 / Math.max(requestsPerMinute, 1);
  let lastRequestAt = nowImpl() - intervalMs;

  async function throttle() {
    const wait = lastRequestAt + intervalMs - nowImpl();
    if (wait > 0) {
      await sleepImpl(wait);
    }
    lastRequestAt = nowImpl();
  }

  async function lookup(ip) {
    const now = nowImpl();
    const hit = cache.get(ip);
    if (hit && now - hit.fetchedAt < cacheTtlMs) {
      return { score: hit.score, cached: true };
    }
    await throttle();
    const res = await fetchImpl(`https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(ip)}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`vt http ${res.status}`);
    }
    const body = await res.json();
    const stats = body?.data?.attributes?.last_analysis_stats;
    const score = stats ? (stats.malicious || 0) + (stats.suspicious || 0) : 0;
    const entry = { score, fetchedAt: now };
    cache.set(ip, entry);
    return { score, cached: false };
  }

  return { lookup, cache };
}
