// api/quicklook.js
const { get, set, singleFlight } = require('./_cache');

const CG_IDS = {
  SOL: 'solana',
  ETH: 'ethereum',
  BTC: 'bitcoin',
  XRP: 'ripple',
  TIA: 'celestia'
};

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function fetchJSON(url, { retries = 2 } = {}) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'token-quicklook/1.0 (github.com/Kyozuro111)'
  };
  let lastErr = null;
  for (let i=0;i<=retries;i++){
    try {
      const r = await fetch(url, { headers });
      if (r.status === 429) { lastErr = new Error('429'); await sleep(400 * (i+1)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      return await r.json();
    } catch(e){ lastErr = e; await sleep(250 * (i+1)); }
  }
  throw lastErr || new Error('fetch fail');
}

async function resolveCgId(symbol) {
  const sym = symbol.toUpperCase().trim();
  if (CG_IDS[sym]) return CG_IDS[sym];

  // fallback: search trên CG (cache 6h)
  const cacheKey = `cg:search:${sym}`;
  const cached = get(cacheKey);
  if (cached) return cached;

  const q = await fetchJSON(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`);
  const coin = (q.coins || []).find(c => (c.symbol||'').toUpperCase() === sym) || q.coins?.[0];
  const id = coin?.id || null;
  if (id) set(cacheKey, id, 6*60*60*1000);
  return id;
}

module.exports = async (req, res) => {
  try {
    const symbol = String(req.query?.symbol || 'SOL').trim();

    // Hỗ trợ contract (Dexscreener) nếu người dùng dán 0x...
    const isEvmAddr = /^0x[a-fA-F0-9]{40}$/.test(symbol);
    if (isEvmAddr) {
      const key = `ql:dex:${symbol}`;
      const cached = get(key);
      if (cached) return res.status(200).json({ data: cached, source: 'dexscreener:cache' });

      const data = await singleFlight(key, async () => {
        const j = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${symbol}`);
        const pair = j.pairs?.[0];
        if (!pair) throw new Error('No pair');
        const out = {
          name: `${pair.baseToken?.name || pair.baseToken?.symbol || 'Token'}`,
          price: Number(pair.priceUsd || pair.priceNative || 0),
          pct: Number(pair.priceChange?.h24 || 0),
          mcap: Number(pair.fdv || 0),
          vol24: Number(pair.volume?.h24 || 0),
          topPair: `${pair.dexId || ''} ${pair.pairAddress || ''}`.trim()
        };
        set(key, out, 45_000);
        return out;
      });

      return res.status(200).json({ data, source: 'dexscreener' });
    }

    // CoinGecko
    const id = await resolveCgId(symbol);
    if (!id) return res.status(404).json({ error: `Unknown symbol ${symbol}` });

    const key = `ql:cg:${id}`;
    const cached = get(key);
    if (cached) return res.status(200).json({ data: cached, source: 'coingecko:cache' });

    const data = await singleFlight(key, async () => {
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}&sparkline=false&price_change_percentage=24h`;
      try {
        const arr = await fetchJSON(url, { retries: 2 });
        const x = arr?.[0];
        if (!x) throw new Error('Empty CG result');
        const out = {
          name: x.name,
          price: Number(x.current_price),
          pct: Number(x.price_change_percentage_24h_in_currency ?? x.price_change_percentage_24h),
          mcap: Number(x.market_cap),
          vol24: Number(x.total_volume),
          topPair: null
        };
        set(key, out, 45_000);               // TTL 45s
        return out;
      } catch (e) {
        // nếu bị 429 thì trả dữ liệu cũ nếu có
        const stale = get(key);
        if (stale) return stale;
        throw e;
      }
    });

    return res.status(200).json({ data, source: 'coingecko' });
  } catch (e) {
    // trả thông báo gọn để UI hiện đúng
    return res.status(500).json({ error: String(e.message || e) });
  }
};
