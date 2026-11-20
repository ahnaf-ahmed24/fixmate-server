const { connectDb } = require('../src/config/db');
const env = require('../src/config/env');

let app = null;
let initPromise = null;

async function getApp() {
  if (app) return app;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    env.assertSecrets();
    await connectDb();
    const { createApp } = require('../src/app');
    app = await createApp();
    return app;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

module.exports = async (req, res) => {
  try {
    const a = await getApp();
    return a(req, res);
  } catch (err) {
    console.error('[api] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
