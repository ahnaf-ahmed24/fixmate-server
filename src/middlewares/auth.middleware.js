const { collections, userFilter } = require('../utils/helpers');
const env = require('../config/env');

let jose = null;
let jwks = null;

async function getJose() {
  if (!jose) jose = await import('jose');
  return jose;
}

async function getJwks() {
  if (!jwks) {
    const { createRemoteJWKSet } = await getJose();
    jwks = createRemoteJWKSet(new URL(`${env.BETTER_AUTH_URL}/api/auth/jwks`));
  }
  return jwks;
}

async function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: 'Unauthorized: missing or invalid token' });
    }

    let payload;
    try {
      const { jwtVerify } = await getJose();
      ({ payload } = await jwtVerify(token, await getJwks(), {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }));
    } catch (err) {
      console.error('[verifyToken] JWT check failed:', err.message);
      return res.status(401).json({ success: false, message: 'Unauthorized: invalid or expired token' });
    }

    const { users } = collections();
    const user = await users.findOne(userFilter(payload.id));
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: user no longer exists' });
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      image: user.image || null,
    };
    next();
  } catch (err) {
    next(err);
  }
}

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: ${roles.join(' or ')} access only`,
      });
    }
    next();
  };

const verifyCustomer = requireRole('customer');
const verifyTechnician = requireRole('technician');
const verifyAdmin = requireRole('admin');

module.exports = { verifyToken, verifyCustomer, verifyTechnician, verifyAdmin };
