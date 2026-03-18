const express = require('express');
const { body, validationResult } = require('express-validator');
const { spawn } = require('child_process');
const path = require('path');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

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

/**
 * PATCH /api/admin/auth/profile
 * Update current user's profile (name)
 */
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await callPythonAdminDB('update_user', {
      user_id: userId,
      updates: { name: name.trim() }
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to update profile' });
    }

    res.json(result.user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * PUT /api/admin/auth/password
 * Change current user's password
 */
router.put('/password', authenticateToken,
  [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const userId = req.user.userId;
      const { current_password, new_password } = req.body;

      // Verify current password
      const userResult = await callPythonAdminDB('get_user', { user_id: userId });
      if (!userResult.success || !userResult.user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const verifyResult = await callPythonAdminDB('verify_password', {
        user_id: userId,
        password: current_password
      });

      if (!verifyResult.success) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Update password
      const updateResult = await callPythonAdminDB('update_password', {
        user_id: userId,
        new_password
      });

      if (!updateResult.success) {
        return res.status(400).json({ error: updateResult.error || 'Failed to update password' });
      }

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

/**
 * GET /api/admin/users
 * List all admin users (super_admin only)
 */
router.get('/users', authenticateToken, async (req, res) => {
  try {
    // Check if user is super_admin
    const currentUser = await callPythonAdminDB('get_user', { user_id: req.user.userId });
    if (!currentUser.success || currentUser.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: super_admin role required' });
    }

    const result = await callPythonAdminDB('list_users', {});

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    // Strip password hashes
    const users = (result.users || []).map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      is_active: u.is_active,
      created_at: u.created_at,
      last_login: u.last_login,
    }));

    res.json({ users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * POST /api/admin/users
 * Create a new admin user (super_admin only)
 */
router.post('/users', authenticateToken,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('role').isIn(['viewer', 'editor', 'admin', 'super_admin']).withMessage('Invalid role')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Check if user is super_admin
      const currentUser = await callPythonAdminDB('get_user', { user_id: req.user.userId });
      if (!currentUser.success || currentUser.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden: super_admin role required' });
      }

      const { email, password, name, role } = req.body;

      const result = await callPythonAdminDB('create_user', {
        email,
        password,
        name,
        role
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error || 'Failed to create user' });
      }

      res.status(201).json(result.user);
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

/**
 * PATCH /api/admin/users/:id
 * Update admin user role/status (super_admin only)
 */
router.patch('/users/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is super_admin
    const currentUser = await callPythonAdminDB('get_user', { user_id: req.user.userId });
    if (!currentUser.success || currentUser.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: super_admin role required' });
    }

    const { id } = req.params;
    const updates = {};

    if (req.body.role) updates.role = req.body.role;
    if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
    if (req.body.name) updates.name = req.body.name;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const result = await callPythonAdminDB('update_user', {
      user_id: id,
      updates
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to update user' });
    }

    res.json(result.user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
