import 'dotenv/config';

import env from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

/** Local / long-running entry point. On Vercel use api/index.js instead. */
async function main() {
  env.assertSecrets();
  await connectDb();

  const app = await createApp();
  app.listen(env.PORT, () => {
    console.log(`[server] FixMate API running on ${env.BETTER_AUTH_URL} (${env.NODE_ENV})`);
  });
}

// Vercel falls back to package.json's "main" when no other entry file matches,
// so this module must expose a default export too. The listener is only started
// when running locally — never when the file is imported inside a function.
export { default } from './handler.js';

if (process.env.VERCEL !== '1') {
  main().catch((err) => {
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
}
