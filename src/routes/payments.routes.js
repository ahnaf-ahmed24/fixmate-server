const router = require('express').Router();
const c = require('../controllers/payments.controller');
const { verifyToken, verifyCustomer } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.post('/create-checkout-session', verifyToken, verifyCustomer, asyncHandler(c.createCheckoutSession));
router.get('/verify', verifyToken, verifyCustomer, asyncHandler(c.verifyCheckout));
router.get('/my', verifyToken, verifyCustomer, asyncHandler(c.getMyPayments));

module.exports = router;
