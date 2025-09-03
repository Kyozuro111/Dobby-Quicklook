// api/_env.js
const fs = require('fs');
const path = require('path');

function fromFile() {
  // Đọc secret từ assets/.secret.json (chỉ dùng local, nhớ gitignore)
  try {
    const p = path.join(process.cwd(), 'assets', '.secret.json');
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw);
    return {
      HF_TOKEN: j.HF_TOKEN || j.hf_token || j.token || null,
      HF_MODEL: j.HF_MODEL || j.model || null,
    };
  } catch {
    return {};
  }
}

function resolve(req) {
  const body = (req.method === 'POST' ? (req.body || {}) : {});
  const hdr  = req.headers || {};
  const file = fromFile();

  // Ưu tiên: ENV → Header → Body (nếu cho phép) → File
  const token =
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACEHUB_API_TOKEN ||   // alias phổ biến của HF
    process.env.SENTIENT_API_KEY ||           // alias mình thêm để dễ nhớ
    process.env.FIREWORKS_API_KEY ||          // giữ tương thích cũ nếu bạn trót đặt ở đây
    hdr['x-hf-key'] ||
    (process.env.ALLOW_DEBUG_KEY ? (body.key || body.token || null) : null) ||
    file.HF_TOKEN || null;

  const model =
    process.env.HF_MODEL ||
    process.env.SENTIENT_MODEL ||
    hdr['x-hf-model'] ||
    body.model ||
    file.HF_MODEL ||
    'SentientAGI/Dobby-Mini-Unhinged-Llama-3.1-8B:featherless-ai';

  return { token, model };
}

module.exports = { resolve };
