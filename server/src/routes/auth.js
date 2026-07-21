/**
 * Halo Server — Auth Routes
 * POST /register, POST /login, POST /logout, GET /me
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { requireAuth, generateToken } = require('../middleware/auth');

const router = express.Router();

const SALT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 7;

/**
 * POST /api/auth/register
 * Create a new user account.
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, plan',
      [email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];

    // Create session
    const token = generateToken(user.id);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.status(201).json({
      user: { id: user.id, email: user.email, plan: user.plan },
      token,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate and create a session.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user
    const result = await query(
      'SELECT id, email, password_hash, plan FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Create session
    const token = generateToken(user.id);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // Update last login
    await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);

    res.json({
      user: { id: user.id, email: user.email, plan: user.plan },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate the current session.
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization.slice(7);
    await query('DELETE FROM sessions WHERE token = $1', [token]);
    res.json({ message: 'Logged out.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed.' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info.
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      plan: req.user.plan,
    },
  });
});

module.exports = router;
