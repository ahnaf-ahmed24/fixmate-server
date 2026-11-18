const router = require('express').Router();
const c = require('../controllers/users.controller');
const s = require('../controllers/stats.controller');
const { verifyToken, verifyCustomer, verifyTechnician } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/me', verifyToken, asyncHandler(c.getMe));
router.patch('/profile', verifyToken, asyncHandler(c.updateProfile));

router.get('/stats/customer', verifyToken, verifyCustomer, asyncHandler(s.customerStats));
router.get('/stats/technician', verifyToken, verifyTechnician, asyncHandler(s.technicianStats));

module.exports = router;
