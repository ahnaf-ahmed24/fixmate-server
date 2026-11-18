const router = require('express').Router();
const c = require('../controllers/admin.controller');
const { verifyToken, verifyAdmin } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/stats', verifyToken, verifyAdmin, asyncHandler(c.getStats));
router.get('/users', verifyToken, verifyAdmin, asyncHandler(c.listUsers));
router.patch('/users/:id/role', verifyToken, verifyAdmin, asyncHandler(c.updateUserRole));
router.get('/services', verifyToken, verifyAdmin, asyncHandler(c.listAllServices));
router.patch('/services/:id/approval', verifyToken, verifyAdmin, asyncHandler(c.updateApproval));
router.get('/bookings', verifyToken, verifyAdmin, asyncHandler(c.listAllBookings));
router.get('/payments', verifyToken, verifyAdmin, asyncHandler(c.listAllPayments));

module.exports = router;
