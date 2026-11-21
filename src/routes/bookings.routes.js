import express from 'express';
import * as c from '../controllers/bookings.controller.js';
import { verifyToken, verifyCustomer, verifyTechnician } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

const router = express.Router();


router.post('/', verifyToken, verifyCustomer, asyncHandler(c.createBooking));
router.get('/my', verifyToken, verifyCustomer, asyncHandler(c.getMyBookings));
router.patch('/:id/cancel', verifyToken, verifyCustomer, asyncHandler(c.cancelBooking));


router.get('/technician', verifyToken, verifyTechnician, asyncHandler(c.getTechnicianBookings));
router.patch('/:id/status', verifyToken, verifyTechnician, asyncHandler(c.updateBookingStatus));


router.get('/:id', verifyToken, asyncHandler(c.getBookingById));

export default router;
