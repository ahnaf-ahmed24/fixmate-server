const { connectDb } = require('../src/config/db');
const env = require('../src/config/env');

let app = null;
let initPromise = null;

async function getApp() {
  if (app) return app;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[api] initializing app…');
    env.assertSecrets();
    console.log('[api] secrets OK');
    await connectDb();
    console.log('[api] DB connected');
    const { createApp } = require('../src/app');
    console.log('[api] creating app');
    app = await createApp();
    console.log('[api] app created');
    return app;
  })().catch((err) => {
    console.error('[api] init failed:', err.message);
    initPromise = null;
    throw err;
  });

  return initPromise;
}

module.exports = async (req, res) => {
  console.log('[api] request:', req.method, req.url);
  try {
    const a = await getApp();
    console.log('[api] dispatching to express app');
    return a(req, res);
  } catch (err) {
    console.error('[api] handler error:', err.message);
    console.error('[api] stack:', err.stack);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
