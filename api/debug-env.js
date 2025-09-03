// api/debug-env.js
const { resolve } = require('./_env');

module.exports = (req, res) => {
  const r = resolve(req);
  res.status(200).json({
    HF_TOKEN: !!r.token,
    HF_MODEL: r.model,
  });
};
