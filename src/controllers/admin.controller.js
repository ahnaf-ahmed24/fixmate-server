import { oid, ok, fail, collections, userFilter, ROLES, BOOKING_STATUSES } from '../utils/helpers.js';

async function getStats(_req, res) {
  const { users, services, bookings, payments } = collections();

  const [totalUsers, technicians, customers, pendingServices, totalBookings, revenueAgg, statusCounts, categoryCounts] =
    await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ role: 'technician' }),
      users.countDocuments({ role: 'customer' }),
      services.countDocuments({ approvalStatus: 'pending' }),
      bookings.countDocuments({}),
      payments.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
      bookings.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
      services
        .aggregate([{ $match: { approvalStatus: 'approved' } }, { $group: { _id: '$category', count: { $sum: 1 } } }])
        .toArray(),
    ]);

  ok(res, {
    data: {
      totalUsers,
      technicians,
      customers,
      pendingServices,
      totalBookings,
      totalRevenue: revenueAgg[0]?.total || 0,
      statusCounts: statusCounts.map((s) => ({ status: s._id, count: s.count })),
      categoryCounts: categoryCounts.map((c) => ({ category: c._id, count: c.count })),
    },
  });
}


async function listUsers(_req, res) {
  const { users } = collections();
  const data = await users
    .find({}, { projection: { name: 1, email: 1, image: 1, role: 1, createdAt: 1, area: 1 } })
    .sort({ createdAt: -1 })
    .toArray();
  ok(res, { data });
}


async function updateUserRole(req, res) {
  const { users } = collections();
  const { role } = req.body || {};
  if (!ROLES.includes(role)) return fail(res, 400, 'Invalid role');

  const user = await users.findOne(userFilter(req.params.id));
  if (!user) return fail(res, 404, 'User not found');
  if (String(user._id) === String(req.user.id)) {
    return fail(res, 400, 'You cannot change your own role');
  }

  await users.updateOne({ _id: user._id }, { $set: { role, updatedAt: new Date() } });
  const updated = await users.findOne({ _id: user._id }, { projection: { name: 1, email: 1, image: 1, role: 1, createdAt: 1 } });
  ok(res, { data: updated, message: `Role updated to ${role}` });
}


async function listAllServices(req, res) {
  const { services } = collections();
  const { approval } = req.query;

  const query = {};
  if (approval && approval !== 'all') query.approvalStatus = approval;

  const pipeline = [{ $match: query }];
  if (approval === 'all' || !approval) {
    // Pending first, then newest first.
    pipeline.push({
      $addFields: {
        _pendingRank: { $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 0, 1] },
      },
    });
    pipeline.push({ $sort: { _pendingRank: 1, createdAt: -1 } });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }
  pipeline.push({
    $project: {
      _pendingRank: 0,
    },
  });

  const data = await services.aggregate(pipeline).toArray();
  ok(res, { data });
}


async function updateApproval(req, res) {
  const { services } = collections();
  const { approvalStatus } = req.body || {};
  if (!['approved', 'rejected'].includes(approvalStatus)) {
    return fail(res, 400, 'approvalStatus must be "approved" or "rejected"');
  }

  const service = await services.findOne({ _id: oid(req.params.id) });
  if (!service) return fail(res, 404, 'Service not found');

  await services.updateOne(
    { _id: service._id },
    { $set: { approvalStatus, updatedAt: new Date() } }
  );
  const updated = await services.findOne({ _id: service._id });
  ok(res, { data: updated, message: `Service ${approvalStatus}` });
}


async function listAllBookings(req, res) {
  const { bookings } = collections();
  const { status } = req.query;
  const query = {};
  if (status && status !== 'all') {
    if (!BOOKING_STATUSES.includes(status)) return fail(res, 400, 'Invalid status filter');
    query.status = status;
  }
  const data = await bookings.find(query).sort({ createdAt: -1 }).toArray();
  ok(res, { data });
}


async function listAllPayments(_req, res) {
  const { payments } = collections();
  const [data, revenueAgg] = await Promise.all([
    payments.find({}).sort({ paidAt: -1 }).toArray(),
    payments.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
  ]);
  ok(res, { data, totalRevenue: revenueAgg[0]?.total || 0 });
}

export {
  getStats,
  listUsers,
  updateUserRole,
  listAllServices,
  updateApproval,
  listAllBookings,
  listAllPayments,
};
