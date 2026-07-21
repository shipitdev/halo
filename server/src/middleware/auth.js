/**
 * Halo Server — JWT Authentication Middleware
 * Verifies token and attaches user to request.
 */

const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'halo-dev-secret';

/**
 * Express middleware: require valid JWT.
 * Sets req.user = { id, email, plan } on success.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Verify session exists and isn't expired
    const sessionResult = await query(
      'SELECT id FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }

    // Fetch user
    const userResult = await query(
      'SELECT id, email, plan, stripe_customer_id FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Optional auth — attaches user if token present, otherwise continues.
 */
async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    const userResult = await query(
      'SELECT id, email, plan, stripe_customer_id FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length > 0) {
      req.user = userResult.rows[0];
    }
  } catch {
    // Silent fail — user just won't be attached
  }

  next();
}

/**
 * Generate a JWT token for a user.
 * @param {number} userId
 * @returns {string}
 */
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '7d',
  });
}

module.exports = { requireAuth, optionalAuth, generateToken, JWT_SECRET };
