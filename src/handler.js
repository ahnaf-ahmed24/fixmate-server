import env from './config/env.js';
import { connectDb } from './config/db.js';

let app = null;
let initPromise = null;

/**
 * Lazily bootstrap the app: validate secrets → connect Mongo → wire Express.
 * Cached across warm invocations; cleared on failure so the next request retries
 * instead of caching the rejection forever.
 */
async function getApp() {
  if (app) return app;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    env.assertSecrets();
    await connectDb();
    const { createApp } = await import('./app.js');
    app = await createApp();
    return app;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });

  return initPromise;
}

/**
 * Vercel-compatible Node handler: `export default async (req, res) => …`.
 *
 * Vercel builds two functions out of this repo and both must expose a default
 * export that is a function:
 *   1. `api/index.js`  → every route, via the rewrite in vercel.json
 *   2. `src/app.js`    → the auto-detected entry that serves "/" and "/index"
 * Both simply re-export this handler, so behaviour is identical either way.
 */
export default async function handler(req, res) {
  try {
    const expressApp = await getApp();
    return expressApp(req, res);
  } catch (err) {
    console.error('[handler] error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}

export { getApp };
