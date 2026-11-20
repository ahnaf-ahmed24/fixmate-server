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

  const auth = await getAuth();
  console.log('[app] mounted /api/auth handler');

  app.get('/api/auth/test', (_req, res) => res.json({ ok: true }));

  // BetterAuth exposes a fetch-compatible handler at .handler.
  // Wrap it as Express middleware to avoid toNodeHandler compatibility
  // issues on Vercel's serverless runtime.
  app.use('/api/auth', async (req, res, next) => {
    console.log('[app] /api/auth request:', req.method, req.url);
    try {
      const headers = {};
      for (const [key, value] of Object.entries(req.headers)) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }

      // Buffer the request body so it can be passed to fetch Request
      let body = null;
      if (!['GET', 'HEAD'].includes(req.method)) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = Buffer.concat(chunks);
      }

      const request = new Request(`${env.BETTER_AUTH_URL}${req.url}`, {
        method: req.method,
        headers,
        body,
      });

      const response = await auth.handler(request);

      res.status(response.status);
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      const bodyBuf = await response.arrayBuffer();
      res.send(Buffer.from(bodyBuf));
    } catch (err) {
      console.error('[app] auth handler error:', err.message);
      next(err);
    }
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

module.exports = { createApp };
