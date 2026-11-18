const Stripe = require('stripe');
const env = require('../config/env');
const { ApiError } = require('../middlewares/error.middleware');

let _stripe = null;

function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    // Stripe is optional in dev — surface a clean 503 instead of an unhandled 500.
    throw new ApiError(503, 'Stripe is not configured: set STRIPE_SECRET_KEY in the server .env');
  }
  if (!_stripe) _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return _stripe;
}

module.exports = { getStripe };
