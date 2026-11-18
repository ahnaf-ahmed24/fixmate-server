const { ok, collections, ACTIVE_STATUSES } = require('../utils/helpers');


async function customerStats(req, res) {
  const { bookings, payments } = collections();
  const email = req.user.email;

  const [totalRequests, activeJobs, completedJobs, spentAgg] = await Promise.all([
    bookings.countDocuments({ customerEmail: email }),
    bookings.countDocuments({ customerEmail: email, status: { $in: ACTIVE_STATUSES } }),
    bookings.countDocuments({ customerEmail: email, status: 'completed' }),
    payments.aggregate([
      { $match: { customerEmail: email } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).toArray(),
  ]);

  ok(res, {
    data: {
      totalRequests,
      activeJobs,
      completedJobs,
      totalSpent: spentAgg[0]?.total || 0,
    },
  });
}


async function technicianStats(req, res) {
  const { services, bookings, payments } = collections();
  const email = req.user.email;

  const [totalServices, approvedServices, pendingRequests, inProgress, completed, earningsAgg] =
    await Promise.all([
      services.countDocuments({ technicianEmail: email }),
      services.countDocuments({ technicianEmail: email, approvalStatus: 'approved' }),
      bookings.countDocuments({ technicianEmail: email, status: 'requested' }),
      bookings.countDocuments({ technicianEmail: email, status: 'in-progress' }),
      bookings.countDocuments({ technicianEmail: email, status: 'completed' }),
      payments.aggregate([
        { $match: { technicianEmail: email } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).toArray(),
    ]);

  ok(res, {
    data: {
      totalServices,
      approvedServices,
      pendingRequests,
      inProgress,
      completed,
      totalEarnings: earningsAgg[0]?.total || 0,
    },
  });
}

module.exports = { customerStats, technicianStats };
