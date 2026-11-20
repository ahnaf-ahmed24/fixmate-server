require('dotenv').config();

const env = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');

/** Local / long-running entry point. On Vercel use api/index.js instead. */
async function main() {
  env.assertSecrets();
  await connectDb();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[server] FixMate API running on ${env.BETTER_AUTH_URL} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
