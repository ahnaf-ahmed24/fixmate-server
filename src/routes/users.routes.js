import express from 'express';
import * as c from '../controllers/users.controller.js';
import * as s from '../controllers/stats.controller.js';
import { verifyToken, verifyCustomer, verifyTechnician } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

const router = express.Router();

router.get('/me', verifyToken, asyncHandler(c.getMe));
router.patch('/profile', verifyToken, asyncHandler(c.updateProfile));

router.get('/stats/customer', verifyToken, verifyCustomer, asyncHandler(s.customerStats));
router.get('/stats/technician', verifyToken, verifyTechnician, asyncHandler(s.technicianStats));

export default router;
