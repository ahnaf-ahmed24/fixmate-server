
const { createApp } = require('../src/app');
const { connectDb } = require('../src/config/db');
const env = require('../src/config/env');

console.log('[api] module loaded, NODE_ENV:', env.NODE_ENV);

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      console.log('[api] getApp: asserting secrets');
      env.assertSecrets();
      console.log('[api] getApp: secrets OK, connecting DB');
      await connectDb();
      console.log('[api] getApp: DB connected, creating app');
      return createApp();
    })().catch((err) => {
      appPromise = null;
      console.error('[api] getApp failed:', err.message);
      throw err;
    });
  }
  return appPromise;
}

async function handler(req, res) {
  console.log('[api] handler invoked:', req.method, req.url);
  try {
    const app = await getApp();
    console.log('[api] app ready, dispatching');
    return app(req, res);
  } catch (err) {
    console.error('[api] handler error:', err.message);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}

module.exports = handler;
module.exports.default = handler;
