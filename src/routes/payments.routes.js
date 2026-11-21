import express from 'express';
import * as c from '../controllers/payments.controller.js';
import { verifyToken, verifyCustomer } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

const router = express.Router();

router.post('/create-checkout-session', verifyToken, verifyCustomer, asyncHandler(c.createCheckoutSession));
router.get('/verify', verifyToken, verifyCustomer, asyncHandler(c.verifyCheckout));
router.get('/my', verifyToken, verifyCustomer, asyncHandler(c.getMyPayments));

export default router;
