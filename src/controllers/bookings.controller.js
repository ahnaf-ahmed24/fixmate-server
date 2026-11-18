const {
  oid,
  ok,
  fail,
  collections,
  startOfToday,
  BOOKING_STATUSES,
} = require('../utils/helpers');


const TRANSITIONS = {
  requested: ['accepted', 'rejected'],
  accepted: ['in-progress'],
  'in-progress': ['completed'],
};

const ACTIVE_STATUSES = ['requested', 'accepted', 'in-progress'];

/** Customer: send a repair request. */
async function createBooking(req, res) {
  const body = req.body || {};
  const { services, bookings } = collections();

  const { serviceId, customerPhone, address, preferredDate, problemDescription } = body;

  if (!serviceId) return fail(res, 400, 'Service is required');
  if (!customerPhone || !String(customerPhone).trim()) return fail(res, 400, 'Phone number is required');
  if (!address || !String(address).trim()) return fail(res, 400, 'Address is required');

  const desc = String(problemDescription || '').trim();
  if (desc.length < 20) return fail(res, 400, 'Problem description must be at least 20 characters');

  const preferred = new Date(preferredDate);
  if (!preferredDate || Number.isNaN(preferred.getTime())) {
    return fail(res, 400, 'Preferred date is required');
  }
  if (preferred.setHours(0, 0, 0, 0) < startOfToday().getTime()) {
    return fail(res, 400, 'Preferred date must be today or a future date');
  }

  const service = await services.findOne({ _id: oid(serviceId) });
  if (!service) return fail(res, 404, 'Service not found');
  if (service.approvalStatus !== 'approved' || !service.isAvailable) {
    return fail(res, 400, 'This service is not available right now');
  }
  if (service.technicianEmail === req.user.email) {
    return fail(res, 403, 'Forbidden: you cannot request your own service');
  }

 
  const duplicate = await bookings.countDocuments({
    customerEmail: req.user.email,
    serviceId: service._id.toString(),
    status: { $in: ACTIVE_STATUSES },
  });
  if (duplicate > 0) {
    return fail(res, 409, 'You already have an active request for this service');
  }

  const now = new Date();
  const doc = {
    serviceId: service._id.toString(),
    serviceTitle: service.title,
    serviceImage: service.image,
    category: service.category,
    basePrice: service.basePrice,
    technicianName: service.technicianName,
    technicianEmail: service.technicianEmail,
    customerName: req.user.name,
    customerEmail: req.user.email,
    customerPhone: String(customerPhone).trim(),
    address: String(address).trim(),
    preferredDate: preferred,
    problemDescription: desc,
    status: 'requested',
    finalAmount: service.basePrice,
    paymentStatus: 'unpaid',
    statusHistory: [{ status: 'requested', changedAt: now }],
    createdAt: now,
    updatedAt: now,
  };

  const result = await bookings.insertOne(doc);
  ok(
    res,
    {
      data: { ...doc, _id: result.insertedId },
      message: 'Repair request sent successfully!',
    },
    201
  );
}


async function getMyBookings(req, res) {
  const { bookings } = collections();
  const data = await bookings
    .find({ customerEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  ok(res, { data });
}


async function getTechnicianBookings(req, res) {
  const { status } = req.query;
  const query = { technicianEmail: req.user.email };
  if (status && status !== 'all') query.status = status;

  const { bookings } = collections();
  const data = await bookings.find(query).sort({ createdAt: -1 }).toArray();
  ok(res, { data });
}


async function getBookingById(req, res) {
  const { bookings } = collections();
  const booking = await bookings.findOne({ _id: oid(req.params.id) });
  if (!booking) return fail(res, 404, 'Booking not found');

  const isOwner =
    booking.customerEmail === req.user.email ||
    booking.technicianEmail === req.user.email ||
    req.user.role === 'admin';
  if (!isOwner) return fail(res, 403, 'Forbidden: you cannot view this booking');

  ok(res, { data: booking });
}

async function cancelBooking(req, res) {
  const { bookings } = collections();
  const booking = await bookings.findOne({ _id: oid(req.params.id) });
  if (!booking) return fail(res, 404, 'Booking not found');
  if (booking.customerEmail !== req.user.email) {
    return fail(res, 403, 'Forbidden: you can only cancel your own requests');
  }
  if (booking.status !== 'requested') {
    return fail(res, 400, 'Only a requested job can be cancelled');
  }

  const now = new Date();
  await bookings.updateOne(
    { _id: booking._id },
    {
      $set: { status: 'cancelled', updatedAt: now },
      $push: { statusHistory: { status: 'cancelled', changedAt: now } },
    }
  );
  ok(res, { message: 'Booking cancelled successfully' });
}


async function updateBookingStatus(req, res) {
  const { bookings } = collections();
  const booking = await bookings.findOne({ _id: oid(req.params.id) });
  if (!booking) return fail(res, 404, 'Booking not found');
  if (booking.technicianEmail !== req.user.email) {
    return fail(res, 403, 'Forbidden: only the technician who owns this job can update it');
  }

  const next = req.body?.status;
  if (!next || !BOOKING_STATUSES.includes(next)) {
    return fail(res, 400, 'Invalid status value');
  }

  const allowed = TRANSITIONS[booking.status] || [];
  if (!allowed.includes(next)) {
    return fail(
      res,
      400,
      `Invalid status change: ${booking.status} → ${next}. Allowed next: ${
        allowed.length ? allowed.join(', ') : 'none (final state)'
      }`
    );
  }

  const $set = { status: next, updatedAt: new Date() };
  if (next === 'completed') {
    const finalAmount = Number(req.body?.finalAmount);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return fail(res, 400, 'A final amount greater than 0 is required to complete the job');
    }
    $set.finalAmount = finalAmount;
  }

  const now = new Date();
  await bookings.updateOne(
    { _id: booking._id },
    { $set, $push: { statusHistory: { status: next, changedAt: now } } }
  );
  const updated = await bookings.findOne({ _id: booking._id });
  ok(res, { data: updated, message: `Job marked as ${next}` });
}

module.exports = {
  createBooking,
  getMyBookings,
  getTechnicianBookings,
  getBookingById,
  cancelBooking,
  updateBookingStatus,
};
