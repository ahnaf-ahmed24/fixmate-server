const { connectDb } = require('../src/config/db');
const env = require('../src/config/env');

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      env.assertSecrets();
      await connectDb();
      const { createApp } = require('../src/app');
      return createApp();
    })().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

module.exports = async (req, res) => {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('[api] error:', err.message);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
