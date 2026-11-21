import express from 'express';
import * as c from '../controllers/services.controller.js';
import { verifyToken, verifyTechnician } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../middlewares/error.middleware.js';

const router = express.Router();

router.get('/', asyncHandler(c.listServices));
router.get('/featured', asyncHandler(c.featuredServices));
router.get('/:id', asyncHandler(c.getServiceById));


router.post('/', verifyToken, verifyTechnician, asyncHandler(c.createService));
router.get('/mine/all', verifyToken, verifyTechnician, asyncHandler(c.getMyServices));
router.patch('/:id/availability', verifyToken, verifyTechnician, asyncHandler(c.updateAvailability));
router.patch('/:id', verifyToken, verifyTechnician, asyncHandler(c.updateService));
router.delete('/:id', verifyToken, verifyTechnician, asyncHandler(c.deleteService));

export default router;
