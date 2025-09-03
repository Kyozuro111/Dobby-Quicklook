const store = new Map();
const inflight = new Map();

function get(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) { store.delete(key); return null; }
  return hit.val;
}
function set(key, val, ttlMs = 60000) {
  store.set(key, { val, exp: Date.now() + ttlMs });
}
async function singleFlight(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => { try { return await fn(); } finally { inflight.delete(key); } })();
  inflight.set(key, p);
  return p;
}

module.exports = { get, set, singleFlight };
