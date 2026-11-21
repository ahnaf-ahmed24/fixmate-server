import { oid, escapeRegex, CATEGORIES, SERVICE_MODES, ok, fail, collections, startOfToday } from '../utils/helpers.js';
import { ApiError } from '../middlewares/error.middleware.js';


async function listServices(req, res) {
  const { search, category, serviceMode, sort, page, limit } = req.query;

  const query = { approvalStatus: 'approved', isAvailable: true };

  if (search && String(search).trim()) {
    const rx = escapeRegex(String(search).trim());
    query.$or = [
      { title: { $regex: rx, $options: 'i' } },
      { category: { $regex: rx, $options: 'i' } },
    ];
  }
  if (category && category !== 'all') query.category = category;
  if (serviceMode && serviceMode !== 'all') query.serviceMode = serviceMode;

  const sortMap = {
    'price-asc': { basePrice: 1, createdAt: -1 },
    'price-desc': { basePrice: -1, createdAt: -1 },
    newest: { createdAt: -1 },
  };
  const sortStage = sortMap[sort] || sortMap.newest;

  const lim = Math.min(Math.max(parseInt(limit, 10) || 9, 1), 48);
  const pg = Math.max(parseInt(page, 10) || 1, 1);

  const { services } = collections();
  const [data, total] = await Promise.all([
    services.find(query).sort(sortStage).skip((pg - 1) * lim).limit(lim).toArray(),
    services.countDocuments(query),
  ]);

  ok(res, {
    data,
    total,
    page: pg,
    limit: lim,
    totalPages: Math.ceil(total / lim) || 1,
  });
}


async function featuredServices(_req, res) {
  const { services } = collections();
  const data = await services
    .find({ approvalStatus: 'approved', isAvailable: true })
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();
  ok(res, { data });
}


async function getServiceById(req, res) {
  const { services, users } = collections();
  const service = await services.findOne({ _id: oid(req.params.id) });
  if (!service || service.approvalStatus !== 'approved' || !service.isAvailable) {
    return fail(res, 404, 'Service not found');
  }

  const tech = await users.findOne(
    { email: service.technicianEmail },
    { projection: { name: 1, image: 1, area: 1, bio: 1 } }
  );

  ok(res, {
    data: {
      ...service,
      technician: tech
        ? { name: tech.name, image: tech.image || null, area: tech.area || '', bio: tech.bio || '' }
        : { name: service.technicianName, image: null, area: '', bio: '' },
    },
  });
}


async function createService(req, res) {
  const body = req.body || {};
  const errors = validateServiceBody(body);
  if (errors.length) return fail(res, 400, errors[0], { errors });

  const { services } = collections();
  const now = new Date();
  const doc = {
    title: body.title.trim(),
    category: body.category,
    description: body.description.trim(),
    image: body.image,
    basePrice: Number(body.basePrice),
    estimatedDuration: body.estimatedDuration.trim(),
    serviceMode: body.serviceMode,
    serviceArea: body.serviceArea.trim(),
    technicianName: req.user.name,
    technicianEmail: req.user.email,
    approvalStatus: 'pending',
    isAvailable: true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await services.insertOne(doc);
  ok(
    res,
    {
      data: { ...doc, _id: result.insertedId },
      message: 'Service added! It is now waiting for admin approval.',
    },
    201
  );
}


async function getMyServices(req, res) {
  const { services } = collections();
  const data = await services
    .find({ technicianEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  ok(res, { data });
}


async function updateService(req, res) {
  const { services } = collections();
  const service = await services.findOne({ _id: oid(req.params.id) });
  if (!service) return fail(res, 404, 'Service not found');
  if (service.technicianEmail !== req.user.email) {
    return fail(res, 403, 'Forbidden: you can only update your own services');
  }

  const body = req.body || {};
  const merged = { ...service, ...body };
  const errors = validateServiceBody(merged, { requireImage: false });
  if (errors.length) return fail(res, 400, errors[0], { errors });

  const $set = {
    title: String(merged.title).trim(),
    category: merged.category,
    description: String(merged.description).trim(),
    basePrice: Number(merged.basePrice),
    estimatedDuration: String(merged.estimatedDuration).trim(),
    serviceMode: merged.serviceMode,
    serviceArea: String(merged.serviceArea).trim(),
    approvalStatus: 'pending', // re-moderation after edit
    updatedAt: new Date(),
  };
  if (body.image) $set.image = body.image;

  await services.updateOne({ _id: service._id }, { $set });
  const updated = await services.findOne({ _id: service._id });
  ok(res, { data: updated, message: 'Service updated — it is pending admin approval again.' });
}


async function updateAvailability(req, res) {
  const { services } = collections();
  const service = await services.findOne({ _id: oid(req.params.id) });
  if (!service) return fail(res, 404, 'Service not found');
  if (service.technicianEmail !== req.user.email) {
    return fail(res, 403, 'Forbidden: you can only update your own services');
  }

  const isAvailable = Boolean(req.body?.isAvailable);
  await services.updateOne(
    { _id: service._id },
    { $set: { isAvailable, updatedAt: new Date() } }
  );
  const updated = await services.findOne({ _id: service._id });
  ok(res, {
    data: updated,
    message: isAvailable ? 'Service is now available.' : 'Service is now unavailable (hidden from public pages).',
  });
}


async function deleteService(req, res) {
  const { services } = collections();
  const service = await services.findOne({ _id: oid(req.params.id) });
  if (!service) return fail(res, 404, 'Service not found');
  if (service.technicianEmail !== req.user.email) {
    return fail(res, 403, 'Forbidden: you can only delete your own services');
  }
  await services.deleteOne({ _id: service._id });
  ok(res, { message: 'Service deleted successfully' });
}

function validateServiceBody(body, { requireImage = true } = {}) {
  const errors = [];
  if (!body.title || !String(body.title).trim()) errors.push('Title is required');
  if (!CATEGORIES.includes(body.category)) errors.push('Please choose a valid category');
  if (!body.description || String(body.description).trim().length < 20) {
    errors.push('Description must be at least 20 characters');
  }
  const price = Number(body.basePrice);
  if (!Number.isFinite(price) || price <= 0) errors.push('Base price must be a positive number');
  if (!body.estimatedDuration || !String(body.estimatedDuration).trim()) {
    errors.push('Estimated duration is required');
  }
  if (!SERVICE_MODES.includes(body.serviceMode)) errors.push('Please choose a valid service mode');
  if (!body.serviceArea || !String(body.serviceArea).trim()) errors.push('Service area is required');
  if (requireImage && !body.image) errors.push('Service image is required (upload via ImgBB)');
  return errors;
}

export {
  listServices,
  featuredServices,
  getServiceById,
  createService,
  getMyServices,
  updateService,
  updateAvailability,
  deleteService,
  validateServiceBody,
};
