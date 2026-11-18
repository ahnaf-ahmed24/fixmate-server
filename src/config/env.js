require('dotenv').config();

const required = ['MONGODB_URI', 'BETTER_AUTH_SECRET'];

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  PORT: parseInt(process.env.PORT, 10) || 5000,


  // MongoDB Atlas only — no local fallback; the server fails fast at startup if unset
  MONGODB_URI: process.env.MONGODB_URI || '',
  DB_NAME: process.env.DB_NAME || 'fixmate',

 
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'change-me-better-auth-secret',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`,
  JWT_ISSUER: process.env.JWT_ISSUER || 'fixmate-server',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'fixmate-client',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

 
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

 
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

 
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
};

env.corsOrigins = [env.CLIENT_URL, ...env.CORS_ORIGINS].filter(Boolean);

env.assertSecrets = function assertSecrets() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

module.exports = env;
