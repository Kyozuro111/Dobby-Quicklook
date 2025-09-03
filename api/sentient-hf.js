// api/sentient-hf.js
module.exports = async (req, res) => {
  try {
    const { resolve } = require('./_env');
    const { token, model } = resolve(req);

    if (!token) {
      return res.status(401).json({ error: 'Missing HF token (try HF_TOKEN / HUGGINGFACEHUB_API_TOKEN / SENTIENT_API_KEY, or put assets/.secret.json)' });
    }

    const input =
      (req.method === 'POST'
        ? (req.body?.input || req.body?.prompt)
        : req.query?.input) || 'ping';

    const payload = {
      model,
      messages: [{ role: 'user', content: String(input) }],
    };

    const r = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: text.slice(0, 800) });

    const j = JSON.parse(text);
    const out =
      (j.choices?.[0]?.message?.content ||
       j.choices?.[0]?.delta?.content ||
       '').trim();

    return res.json({ model, output: out || '[empty]' });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'HF error' });
  }
};
