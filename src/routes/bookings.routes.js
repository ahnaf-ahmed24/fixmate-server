const router = require('express').Router();
const c = require('../controllers/bookings.controller');
const { verifyToken, verifyCustomer, verifyTechnician } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');


router.post('/', verifyToken, verifyCustomer, asyncHandler(c.createBooking));
router.get('/my', verifyToken, verifyCustomer, asyncHandler(c.getMyBookings));
router.patch('/:id/cancel', verifyToken, verifyCustomer, asyncHandler(c.cancelBooking));


router.get('/technician', verifyToken, verifyTechnician, asyncHandler(c.getTechnicianBookings));
router.patch('/:id/status', verifyToken, verifyTechnician, asyncHandler(c.updateBookingStatus));


router.get('/:id', verifyToken, asyncHandler(c.getBookingById));

module.exports = router;
