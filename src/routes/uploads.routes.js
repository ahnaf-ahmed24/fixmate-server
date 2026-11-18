const router = require('express').Router();
const c = require('../controllers/uploads.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

// Any signed-in user can host an image (service photos for technicians, avatars for all).
router.post('/image', verifyToken, asyncHandler(c.uploadImage));

module.exports = router;
