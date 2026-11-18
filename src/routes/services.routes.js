const router = require('express').Router();
const c = require('../controllers/services.controller');
const { verifyToken, verifyTechnician } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/', asyncHandler(c.listServices));
router.get('/featured', asyncHandler(c.featuredServices));
router.get('/:id', asyncHandler(c.getServiceById));


router.post('/', verifyToken, verifyTechnician, asyncHandler(c.createService));
router.get('/mine/all', verifyToken, verifyTechnician, asyncHandler(c.getMyServices));
router.patch('/:id/availability', verifyToken, verifyTechnician, asyncHandler(c.updateAvailability));
router.patch('/:id', verifyToken, verifyTechnician, asyncHandler(c.updateService));
router.delete('/:id', verifyToken, verifyTechnician, asyncHandler(c.deleteService));

module.exports = router;
