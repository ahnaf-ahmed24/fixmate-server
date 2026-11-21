import express from 'express';
import * as c from '../controllers/uploads.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

const router = express.Router();

// Any signed-in user can host an image (service photos for technicians, avatars for all).
router.post('/image', verifyToken, asyncHandler(c.uploadImage));

export default router;
