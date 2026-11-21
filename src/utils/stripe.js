import Stripe from 'stripe';
import env from '../config/env.js';
import { ApiError } from '../middlewares/error.middleware.js';

let _stripe = null;

function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    // Stripe is optional in dev — surface a clean 503 instead of an unhandled 500.
    throw new ApiError(503, 'Stripe is not configured: set STRIPE_SECRET_KEY in the server .env');
  }
  if (!_stripe) _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return _stripe;
}

export { getStripe };
