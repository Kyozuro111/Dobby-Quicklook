// Build indicators from /api/ohlc, call /api/sentient-hf.
// Falls back to rule-based bullets only khi HF lỗi.
module.exports = async (req, res) => {
  try {
    const symbol = String((req.query?.symbol || 'SOL')).toUpperCase();
    const days = Number(req.query?.days || 30);
    const base = `${(req.headers['x-forwarded-proto'] || 'http')}://${req.headers.host}`;

    // ----- 1) OHLC -----
    const r = await fetch(`${base}/api/ohlc?symbol=${encodeURIComponent(symbol)}&days=${days}`);
    if (!r.ok) return res.status(r.status).json({ error: 'Failed to fetch OHLC' });
    const j = await r.json();
    const candles = Array.isArray(j.candles) ? j.candles : [];
    const closes = candles.map(c => Number(c.close)).filter(Number.isFinite);
    if (closes.length < 5) {
      return res.status(200).json({ timeframe: days, indicators: {}, analysis: 'Not enough data.', source: 'rule' });
    }

    // ----- 2) indicators -----
    const avg = arr => arr.reduce((a,b)=>a+b,0) / arr.length;
    const sma = n => closes.length >= n ? avg(closes.slice(-n)) : null;
    const last = closes.at(-1);
    const sma20 = sma(20);
    const sma50 = sma(50);
    const chg7d = closes.length>7 ? ((last - closes.at(-8)) / closes.at(-8) * 100) : null;

    const rsi14 = (() => {
      const n = 14;
      if (closes.length <= n) return null;
      let gains=0, losses=0;
      for (let i = closes.length - n + 1; i < closes.length; i++) {
        const d = closes[i] - closes[i-1];
        if (d >= 0) gains += d; else losses += -d;
      }
      const rs = (gains / n) / ((losses / n) || 1e-9);
      return 100 - 100/(1 + rs);
    })();

    // ----- 3) prompt -----
    const prompt = [
      `You are Dobby, a concise crypto market analyst.`,
      `Symbol: ${symbol}. Timeframe: ${days}D.`,
      `Indicators (close-based):`,
      `- last: ${last.toFixed(4)}`,
      `- sma20: ${sma20 ? sma20.toFixed(4) : 'n/a'}`,
      `- sma50: ${sma50 ? sma50.toFixed(4) : 'n/a'}`,
      `- rsi14: ${typeof rsi14 === 'number' ? rsi14.toFixed(1) : 'n/a'}`,
      `- 7D change: ${chg7d != null ? chg7d.toFixed(2)+'%' : 'n/a'}`,
      `Write 4 short bullet points (•).`,
      `Tone: professional, clear, no hype. End with "Not financial advice."`
    ].join(' ');

    // ----- 4) call HF (preferred) -----
    let analysis = null, provider = null;
    try {
      const a = await fetch(`${base}/api/sentient-hf`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ input: prompt })
      });
      if (a.ok) {
        const j2 = await a.json();
        if ((j2.output || '').trim()) {
          analysis = j2.output.trim();
          provider = 'Sentient';
        }
      }
    } catch {}

    // ----- 5) fallback (rule) -----
    if (!analysis) {
      const bullets = [];
      if (sma20 && last > sma20) bullets.push('Price above SMA20 → short-term trend positive.');
      else if (sma20 && last < sma20) bullets.push('Price below SMA20 → short-term trend weakening.');
      if (sma20 && sma50 && sma20 > sma50) bullets.push('SMA20 > SMA50 → positive momentum.');
      if (typeof rsi14 === 'number') {
        if (rsi14 > 70) bullets.push(`RSI14 ≈ ${rsi14.toFixed(1)} → overbought.`);
        else if (rsi14 < 30) bullets.push(`RSI14 ≈ ${rsi14.toFixed(1)} → oversold.`);
        else bullets.push(`RSI14 ≈ ${rsi14.toFixed(1)} → neutral.`);
      }
      if (chg7d != null) bullets.push(`7D change: ${chg7d.toFixed(2)}%.`);
      bullets.push('Not financial advice.');
      analysis = '• ' + bullets.join('\n• ');
      provider = 'rule';
    }

    return res.status(200).json({
      timeframe: days,
      indicators: { last, chg7d, sma20, sma50, rsi14 },
      analysis,
      source: provider
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'analyze error' });
  }
};
