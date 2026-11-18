const Stripe = require('stripe');
const env = require('../config/env');

let _stripe = null;

function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured in the server .env');
  }
  if (!_stripe) _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return _stripe;
}

module.exports = { getStripe };
