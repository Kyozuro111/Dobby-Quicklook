// api/ohlc.js
const { get, set, singleFlight } = require('./_cache');

const CG_IDS = { SOL:'solana', ETH:'ethereum', BTC:'bitcoin', XRP:'ripple', TIA:'celestia' };
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function fetchJSON(url, { retries = 2 } = {}) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'token-quicklook/1.0 (github.com/Kyozuro111)'
  };
  let lastErr;
  for (let i=0;i<=retries;i++){
    try{
      const r = await fetch(url, { headers });
      if (r.status === 429) { lastErr = new Error('429'); await sleep(400*(i+1)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      return await r.json();
    }catch(e){ lastErr=e; await sleep(250*(i+1)); }
  }
  throw lastErr || new Error('fetch fail');
}

async function resolveId(sym){
  const S=sym.toUpperCase().trim();
  if (CG_IDS[S]) return CG_IDS[S];
  const cacheK = `cg:search:${S}`;
  const hit = get(cacheK);
  if (hit) return hit;
  const q = await fetchJSON(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(S)}`);
  const coin = (q.coins||[]).find(c => (c.symbol||'').toUpperCase()===S) || q.coins?.[0];
  const id = coin?.id || null;
  if (id) set(cacheK, id, 6*60*60*1000);
  return id;
}

module.exports = async (req, res) => {
  try {
    const symbol = String(req.query?.symbol || 'SOL');
    const days = Math.max(1, Math.min(365, Number(req.query?.days || 30)));
    const id = await resolveId(symbol);
    if (!id) return res.status(404).json({ error: `Unknown symbol ${symbol}` });

    const key = `ohlc:${id}:${days}`;
    const cached = get(key);
    if (cached) return res.status(200).json(cached);

    const out = await singleFlight(key, async () => {
      const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`;
      try{
        const arr = await fetchJSON(url, { retries: 2 }); // [[ts, o,h,l,c], ...]
        const candles = (arr||[]).map(a => ({
          time: Math.floor(a[0] / 1000),
          open: Number(a[1]),
          high: Number(a[2]),
          low:  Number(a[3]),
          close:Number(a[4]),
        })).filter(x => isFinite(x.time) && isFinite(x.close));
        const payload = { symbol: symbol.toUpperCase(), days, candles };
        set(key, payload, 60_000);              // TTL 60s
        return payload;
      }catch(e){
        const stale = get(key);
        if (stale) return stale;
        throw e;
      }
    });

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'ohlc error' });
  }
};
