const { ObjectId } = require('mongodb');
const { collections } = require('../config/db');
const env = require('../config/env');

const oid = (id) => {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
};

const userFilter = (id) => {
  const asOid = oid(id);
  return asOid ? { _id: asOid } : { _id: id };
};

const escapeRegex = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const CATEGORIES = [
  'Smartphone',
  'Laptop & PC',
  'AC',
  'Refrigerator',
  'TV',
  'Washing Machine',
  'Electrical',
];

const SERVICE_MODES = ['Home Visit', 'Shop Drop-off'];

const BOOKING_STATUSES = [
  'requested',
  'accepted',
  'rejected',
  'in-progress',
  'completed',
  'cancelled',
];

const ROLES = ['customer', 'technician', 'admin'];


const ACTIVE_STATUSES = ['requested', 'accepted', 'in-progress'];


const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const ok = (res, data = {}, status = 200) => res.status(status).json({ success: true, ...data });

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

module.exports = {
  oid,
  userFilter,
  escapeRegex,
  CATEGORIES,
  SERVICE_MODES,
  BOOKING_STATUSES,
  ACTIVE_STATUSES,
  ROLES,
  startOfToday,
  ok,
  fail,
  collections,
};
