const express = require('express');
const { body, validationResult } = require('express-validator');
const { spawn } = require('child_process');
const path = require('path');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/admin/auth/setup
 * One-time setup to create the default admin user
 * This should be called once after deployment
 */
router.post('/setup', async (req, res) => {
  try {
    // Default credentials (should be changed after first login)
    const email = 'admin@where2eat.com';
    const password = 'admin123';
    const name = 'Super Admin';
    const role = 'super_admin';

    // Check if admin already exists
    const existingResult = await callPythonAdminDB('get_user_by_email', { email });

    if (existingResult.success && existingResult.user) {
      return res.json({
        message: 'Admin user already exists',
        email: email,
        hint: 'Use these credentials to login: admin@where2eat.com / admin123'
      });
    }

    // Create admin user
    const createResult = await callPythonAdminDB('create_user', {
      email,
      password,
      name,
      role
    });

    if (createResult.success) {
      console.log('✅ Admin user created successfully');
      res.json({
        message: 'Admin user created successfully',
        email: email,
        hint: 'Login with: admin@where2eat.com / admin123 (change password after login!)'
      });
    } else {
      res.status(500).json({
        error: 'Failed to create admin user',
        details: createResult.error
      });
    }
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup failed', details: error.message });
  }
});

/**
 * Helper function to call Python admin_database methods
 * @param {string} method - Python method name
 * @param {Object} args - Arguments to pass to the method
 * @returns {Promise<Object>} Result from Python
 */
function callPythonAdminDB(method, args = {}) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '..', '..', 'scripts', 'admin_db_bridge.py');
    const python = spawn('python', [pythonScript, method, JSON.stringify(args)]);

    let dataString = '';
    let errorString = '';

    python.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(errorString || `Python process exited with code ${code}`));
        return;
      }

      try {
        const result = JSON.parse(dataString);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse Python output: ${err.message}`));
      }
    });
  });
}

/**
 * POST /api/admin/auth/login
 * Login with email and password
 */
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Call Python AdminDatabase to authenticate
      const result = await callPythonAdminDB('authenticate', { email, password });

      if (!result.success) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      const user = result.user;

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({
          error: 'Account is deactivated'
        });
      }

      // Generate JWT token
      const token = generateToken(user);

      // Create session in database
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      await callPythonAdminDB('create_session', {
        user_id: user.id,
        token,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      // Set cookie (httpOnly for security)
      res.cookie('where2eat_admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Return token and user info (exclude password_hash)
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          created_at: user.created_at,
          last_login: user.last_login
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }
);

/**
 * POST /api/admin/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Get token from header or cookie
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies?.where2eat_admin_token;
    const finalToken = token || cookieToken;

    if (finalToken) {
      // Delete session from database
      await callPythonAdminDB('delete_session', { token: finalToken });
    }

    // Clear cookie
    res.clearCookie('where2eat_admin_token');

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/admin/auth/me
 * Get current authenticated user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get user from token (already validated by middleware)
    const userId = req.user.userId;

    // Fetch fresh user data from database
    const result = await callPythonAdminDB('get_user', { user_id: userId });

    if (!result.success || !result.user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.user;

    // Return user info (exclude password_hash)
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      last_login: user.last_login
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

/**
 * POST /api/admin/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch user data
    const result = await callPythonAdminDB('get_user', { user_id: userId });

    if (!result.success || !result.user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.user;

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Generate new token
    const newToken = generateToken(user);

    // Update cookie
    res.cookie('where2eat_admin_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ token: newToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;
