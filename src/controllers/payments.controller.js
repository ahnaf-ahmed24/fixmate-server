const { oid, ok, fail, collections } = require('../utils/helpers');
const { getStripe } = require('../utils/stripe');
const env = require('../config/env');


async function savePayment(session) {
  const { payments, bookings } = collections();
  const metadata = session.metadata || {};
  const bookingId = metadata.bookingId;
  if (!bookingId) return null;

  const booking = await bookings.findOne({ _id: oid(bookingId) });
  if (!booking) return null;


  if (booking.activeCheckoutSessionId && booking.activeCheckoutSessionId !== session.id) {
    console.warn(`[payments] ignoring stale session ${session.id} for booking ${bookingId}`);
    return null;
  }

  const existing = await payments.findOne({ stripeSessionId: session.id });
  if (existing) return existing;

  const byBooking = await payments.findOne({ bookingId });
  if (byBooking) {

    await bookings.updateOne(
      { _id: booking._id, paymentStatus: { $ne: 'paid' } },
      { $set: { paymentStatus: 'paid', updatedAt: new Date() } }
    );
    return byBooking;
  }

  const doc = {
    bookingId,
    serviceTitle: booking.serviceTitle,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    technicianName: booking.technicianName,
    technicianEmail: booking.technicianEmail,
    amount: session.amount_total != null ? session.amount_total / 100 : booking.finalAmount,
    currency: 'usd',
    transactionId: session.payment_intent || `pi_${session.id}`,
    stripeSessionId: session.id,
    paymentStatus: 'paid',
    paidAt: new Date(),
  };

  try {
    await payments.insertOne(doc);
  } catch (err) {
    if (err && err.code === 11000) {

      return payments.findOne({ stripeSessionId: session.id });
    }
    throw err;
  }

  await bookings.updateOne(
    { _id: booking._id, paymentStatus: { $ne: 'paid' } },
    { $set: { paymentStatus: 'paid', updatedAt: new Date() } }
  );

  return doc;
}

async function createCheckoutSession(req, res) {
  const { bookingId } = req.body || {};
  if (!bookingId) return fail(res, 400, 'bookingId is required');

  const { bookings } = collections();
  const booking = await bookings.findOne({ _id: oid(bookingId) });
  if (!booking) return fail(res, 404, 'Booking not found');


  if (booking.customerEmail !== req.user.email) {
    return fail(res, 403, 'Forbidden: you can only pay for your own bookings');
  }
  if (booking.status !== 'completed') {
    return fail(res, 400, 'Payment is only possible for a completed job');
  }
  if (booking.paymentStatus === 'paid') {
    return fail(res, 400, 'This booking is already paid');
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: booking.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(booking.finalAmount * 100),
          product_data: {
            name: booking.serviceTitle,
            description: `Repair service by ${booking.technicianName}`,
          },
        },
      },
    ],
    metadata: {
      bookingId: booking._id.toString(),
      customerEmail: booking.customerEmail,
    },
    success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/payment/cancel?bookingId=${booking._id.toString()}`,
  });

  await bookings.updateOne(
    { _id: booking._id },
    { $set: { activeCheckoutSessionId: session.id } }
  );

  ok(res, { url: session.url });
}


async function verifyCheckout(req, res) {
  const { session_id: sessionId } = req.query;
  if (!sessionId) return fail(res, 400, 'session_id is required');

  const stripe = getStripe();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(String(sessionId));
  } catch {
    return fail(res, 404, 'Stripe session not found');
  }

  const metaEmail = session.metadata?.customerEmail;
  if (metaEmail && metaEmail !== req.user.email) {
    return fail(res, 403, 'Forbidden');
  }

  if (session.payment_status !== 'paid') {
    return ok(res, { paid: false, status: session.payment_status });
  }

  const payment = await savePayment(session);
  ok(res, { paid: true, data: payment });
}

async function stripeWebhook(req, res) {
  const stripe = getStripe();
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      try {
        await savePayment(session);
      } catch (err) {
        console.error('[stripe webhook] failed to save payment:', err);
        return res.status(500).json({ received: false });
      }
    }
  }

  res.json({ received: true });
}


async function getMyPayments(req, res) {
  const { payments } = collections();
  const data = await payments
    .find({ customerEmail: req.user.email })
    .sort({ paidAt: -1 })
    .toArray();
  ok(res, { data });
}

module.exports = { createCheckoutSession, verifyCheckout, stripeWebhook, getMyPayments, savePayment };
