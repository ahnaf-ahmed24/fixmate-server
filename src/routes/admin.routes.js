import express from 'express';
import * as c from '../controllers/admin.controller.js';
import { verifyToken, verifyAdmin } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

const router = express.Router();

router.get('/stats', verifyToken, verifyAdmin, asyncHandler(c.getStats));
router.get('/users', verifyToken, verifyAdmin, asyncHandler(c.listUsers));
router.patch('/users/:id/role', verifyToken, verifyAdmin, asyncHandler(c.updateUserRole));
router.get('/services', verifyToken, verifyAdmin, asyncHandler(c.listAllServices));
router.patch('/services/:id/approval', verifyToken, verifyAdmin, asyncHandler(c.updateApproval));
router.get('/bookings', verifyToken, verifyAdmin, asyncHandler(c.listAllBookings));
router.get('/payments', verifyToken, verifyAdmin, asyncHandler(c.listAllPayments));

export default router;
