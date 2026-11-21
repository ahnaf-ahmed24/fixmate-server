import { getDb } from '../config/db.js';
import env from '../config/env.js';

let _auth = null;

async function getAuth() {
  if (_auth) return _auth;

  const betterAuthModule = await import('better-auth');
  const adaptersModule = await import('better-auth/adapters/mongodb');
  const pluginsModule = await import('better-auth/plugins');
  const apiModule = await import('better-auth/api');

  const betterAuth = betterAuthModule.betterAuth;
  const mongodbAdapter = adaptersModule.mongodbAdapter;
  const jwt = pluginsModule.jwt;
  const { createAuthMiddleware, APIError } = apiModule;

  _auth = betterAuth({
    appName: 'FixMate',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    trustedOrigins: [env.CLIENT_URL, ...env.CORS_ORIGINS],

    database: mongodbAdapter(getDb()),

    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      autoSignIn: true,
    },

    user: {
      modelName: 'users',
      additionalFields: {
        role: { type: 'string', defaultValue: 'customer', required: false, input: true },
        phone: { type: 'string', required: false, input: true },
        area: { type: 'string', required: false, input: true },
        bio: { type: 'string', required: false, input: true },
      },
    },

    session: {
      modelName: 'sessions',
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    account: { modelName: 'accounts' },
    verification: { modelName: 'verifications' },

    advanced: {
      useSecureCookies: env.isProd,
      defaultCookieAttributes: env.isProd
        ? { sameSite: 'none', secure: true } 
        : { sameSite: 'lax' },
    },

    plugins: [
      jwt({
        jwt: {
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
          expirationTime: env.JWT_EXPIRES_IN,
          definePayload: ({ user }) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image ?? null,
          }),
        },
      }),
    ],

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          const body = ctx.body || {};
          // Only 'customer' or 'technician' may self-register — nobody can sign up as admin.
          if (body.role !== 'customer' && body.role !== 'technician') {
            body.role = 'customer';
          }
          if (typeof body.name === 'string') body.name = body.name.trim();

         
          const pw = typeof body.password === 'string' ? body.password : '';
          if (pw.length > 0 && !/[A-Z]/.test(pw)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Password must contain at least one uppercase letter',
            });
          }
          if (pw.length > 0 && !/[a-z]/.test(pw)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Password must contain at least one lowercase letter',
            });
          }
        }
      }),
    },
  });

  return _auth;
}

export { getAuth };
