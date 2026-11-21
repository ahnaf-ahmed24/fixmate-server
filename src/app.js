import express from 'express';
import cors from 'cors';

import env from './config/env.js';
import { getAuth } from './lib/auth.js';
import * as paymentsController from './controllers/payments.controller.js';
import { notFound, errorHandler, asyncHandler } from './middlewares/error.middleware.js';

import servicesRoutes from './routes/services.routes.js';
import bookingsRoutes from './routes/bookings.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import adminRoutes from './routes/admin.routes.js';
import usersRoutes from './routes/users.routes.js';
import uploadsRoutes from './routes/uploads.routes.js';


async function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // Stripe webhook must see the raw body — mount it before express.json().
  app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    asyncHandler(paymentsController.stripeWebhook)
  );

  app.use(
    cors({
      origin: (origin, cb) => {
        // No Origin (curl / same-origin) or an allowed origin → let through.
        // Disallowed origins get no CORS headers instead of a noisy 500.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
    })
  );

  const auth = await getAuth();
  console.log('[app] mounted /api/auth handler');

  app.get('/api/auth/test', (_req, res) => res.json({ ok: true }));

  // Use BetterAuth's official Node.js handler via dynamic import
  const { toNodeHandler } = await import('better-auth/node');
  app.use('/api/auth', (req, res, next) => {
    console.log('[app] /api/auth request:', req.method, req.url);
    return toNodeHandler(auth)(req, res).catch(next);
  });

  app.use(express.json({ limit: '2mb' }));

  app.get('/', (_req, res) =>
    res.json({ name: 'FixMate API', status: 'ok', time: new Date().toISOString() })
  );
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/services', servicesRoutes);
  app.use('/api/bookings', bookingsRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/uploads', uploadsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// Vercel auto-detects this file as the entry that serves "/" and "/index"
// (it is the module that imports `express`), so it must ALSO default-export a
// (req, res) handler. Without this the root path dies at boot with:
//   Invalid export found in module "/var/task/src/app.js".
// The handler is shared with api/index.js so both entries behave identically.
export { default } from './handler.js';

export { createApp };
