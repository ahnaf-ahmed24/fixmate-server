const express = require('express');
const cors = require('cors');

const env = require('./config/env');
const { getAuth } = require('./lib/auth');
const paymentsController = require('./controllers/payments.controller');
const { notFound, errorHandler, asyncHandler } = require('./middlewares/error.middleware');

const servicesRoutes = require('./routes/services.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const paymentsRoutes = require('./routes/payments.routes');
const adminRoutes = require('./routes/admin.routes');
const usersRoutes = require('./routes/users.routes');
const uploadsRoutes = require('./routes/uploads.routes');


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

  const { toNodeHandler } = await import('better-auth/node');
  app.use('/api/auth', toNodeHandler(await getAuth()));

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

module.exports = { createApp };
