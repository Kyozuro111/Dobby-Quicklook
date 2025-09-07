# 🐶🔍 Dobby Quicklook

**A tiny, fast, serverless crypto dashboard with AI commentary powered by Sentient’s Dobby models.**
Price snapshot, lightweight candlestick chart, and a concise 3–5 bullet analysis. Built to be simple to host (no framework build step) and friendly to rate-limited public data.

---

## ✨ Features

* **Real-time token quicklook**

  * Price, 24h change, market cap, 24h volume
  * Data via proxied public endpoints (CoinGecko, DexScreener)
* **Clean candlestick chart**

  * 7D / 30D / 90D with `lightweight-charts`
* **AI Analysis (Sentient)**

  * Calls Sentient’s Dobby via **Hugging Face Router** or **Fireworks API**
  * Falls back to a tiny rules engine (SMA20/50, RSI14, 7D change) if AI is throttled
* **Futures sentiment (optional section)**

  * Long/Short account ratio (1h), Open Interest 24h delta, latest funding (Binance public)
* **Rate-limit aware UX**

  * Friendly banner: “If you hit an error, wait \~30s then refresh”
* **Zero build, serverless**

  * Static `index.html` + a handful of Vercel API routes
* **Polished UI**

  * Dark theme, quick chips (SOL/ETH/BTC/XRP/TIA), Dobby avatar

---

## 🧱 Tech Stack

* Vanilla **HTML/CSS/JS**
* **Vercel Serverless** API routes (`/api/*`)
* **lightweight-charts** for the candle view
* **SentientAGI Dobby** models via **HF Router** or **Fireworks**

---

## 📁 Project Structure

```
.
├─ index.html                 # Single-page UI
├─ assets/
│  └─ dobby.png               # Mascot (shown above the title)
└─ api/
   ├─ quicklook.js            # Coin snapshot (price, mcap, vol, top pair)
   ├─ ohlc.js                 # Candles for 7/30/90D
   ├─ analyze.js              # AI + fallback rule (SMA/RSI summary)
   ├─ sentient-hfr.js         # Hugging Face Router endpoint
   ├─ sentient-fw.js          # Fireworks API endpoint
   ├─ predict.js              # (optional) simple forecast hooks
   ├─ ping.js                 # sanity check
   └─ debug-env.js            # shows which env vars are present (true/false)
```

---

## ⚙️ Setup (Local)

> Requires Node + Vercel CLI (`npm i -g vercel`) or `npx vercel`.

### 1) Clone

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
```

### 2) Choose how to call Sentient’s model

#### Option A — **Hugging Face Router** (uses your HF included credits)

Set:

* `HF_TOKEN` – your HF token
* `HF_MODEL` – **exact** model slug you want, e.g.

  * `SentientAGI/Dobby-Unhinged-Llama-3.3-70B:fireworks-ai` 
  * or `SentientAGI/Dobby-Mini-Unhinged-Llama-3.1-8B:featherless-ai` 

**Windows PowerShell (dev only):**

```powershell
$env:HF_TOKEN="hf_********************************"
$env:HF_MODEL="SentientAGI/Dobby-Unhinged-Llama-3.3-70B:fireworks-ai"
vercel dev
```

#### Option B — **Fireworks API** (more stable, pay-per-use after any welcome credits)

Set:

* `FIREWORKS_API_KEY` – your Fireworks key

**Windows PowerShell (dev only):**

```powershell
$env:FIREWORKS_API_KEY="sk-fireworks-********************************"
vercel dev
```

> 🔒 **Do not commit secrets.** `.env.local` is git-ignored. Use Vercel env vars in production.

### 3) Run

```bash
vercel dev
# open http://localhost:3000
```

---

## ☁️ Deploy (Vercel)

1. Create a new Vercel project from your GitHub repo
2. **Settings → Environment Variables**

   * If using HF Router: `HF_TOKEN`, `HF_MODEL`
   * If using Fireworks: `FIREWORKS_API_KEY`
3. Deploy.
4. Visit the generated `.vercel.app` URL.

---


## 🤝 Contributing

PRs and issues welcome!
Focus areas: data sources, chart overlays, prompts, and provider adapters.

---
