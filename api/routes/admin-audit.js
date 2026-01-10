const express = require('express');
const { query, validationResult } = require('express-validator');
const { spawn } = require('child_process');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Helper function to call Python database bridge
 */
function callPythonDB(method, args = {}) {
  return new Promise((resolve, reject) => {
    const python = spawn('python', [
      path.join(__dirname, '..', '..', 'scripts', 'admin_db_bridge.py'),
      method,
      JSON.stringify(args)
    ]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (error) {
          resolve(stdout);
        }
      }
    });
  });
}

/**
 * GET /api/admin/audit/history
 * Get edit history with optional filters
 */
router.get('/history',
  [
    query('restaurant_id').optional().isString(),
    query('admin_user_id').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 500 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        restaurant_id,
        admin_user_id,
        limit = 100,
      } = req.query;

      const result = await callPythonDB('get_edit_history', {
        restaurant_id,
        admin_user_id,
        limit: parseInt(limit),
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Failed to fetch edit history' });
      }

      res.json({
        history: result.history || [],
        total: result.history?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching edit history:', error);
      res.status(500).json({ error: 'Failed to fetch edit history' });
    }
  }
);

/**
 * GET /api/admin/audit/activity
 * Get recent activity feed
 */
router.get('/activity',
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  async (req, res) => {
    try {
      const { limit = 20 } = req.query;

      const result = await callPythonDB('get_edit_history', {
        limit: parseInt(limit),
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Failed to fetch activity' });
      }

      // Transform history into activity feed format
      const activities = (result.history || []).map(item => ({
        id: item.id,
        type: item.edit_type,
        user: {
          name: item.admin_name,
          email: item.admin_email,
        },
        restaurant: {
          id: item.restaurant_id,
          name: item.restaurant_name,
        },
        changes: item.changes ? JSON.parse(item.changes) : null,
        timestamp: item.timestamp,
      }));

      res.json({
        activities,
        total: activities.length,
      });
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ error: 'Failed to fetch activity' });
    }
  }
);

module.exports = router;
