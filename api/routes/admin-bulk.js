const express = require('express');
const { body, validationResult } = require('express-validator');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { Parser } = require('json2csv');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

const dataDir = path.join(__dirname, '..', '..', 'data', 'restaurants');

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
 * POST /api/admin/bulk/restaurants/delete
 * Bulk delete restaurants
 * Requires: admin role or higher
 */
router.post('/restaurants/delete',
  requireRole(['admin', 'super_admin']),
  [body('ids').isArray({ min: 1 }).withMessage('At least one ID is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ids } = req.body;
      const results = {
        success: [],
        failed: [],
      };

      for (const id of ids) {
        try {
          const filePath = path.join(dataDir, `${id}.json`);
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            results.success.push(id);

            // Log the deletion
            await callPythonDB('log_edit', {
              restaurant_id: id,
              restaurant_name: id,
              admin_user_id: req.user.userId,
              edit_type: 'delete',
              changes: JSON.stringify({ action: 'bulk_delete' }),
            });
          } else {
            results.failed.push({ id, reason: 'Not found' });
          }
        } catch (error) {
          results.failed.push({ id, reason: error.message });
        }
      }

      res.json({
        message: `Deleted ${results.success.length} of ${ids.length} restaurants`,
        results,
      });
    } catch (error) {
      console.error('Error bulk deleting restaurants:', error);
      res.status(500).json({ error: 'Failed to bulk delete restaurants' });
    }
  }
);

/**
 * POST /api/admin/bulk/restaurants/update
 * Bulk update restaurants
 * Requires: editor role or higher
 */
router.post('/restaurants/update',
  requireRole(['editor', 'admin', 'super_admin']),
  [
    body('ids').isArray({ min: 1 }).withMessage('At least one ID is required'),
    body('updates').isObject().withMessage('Updates object is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ids, updates } = req.body;
      const results = {
        success: [],
        failed: [],
      };

      for (const id of ids) {
        try {
          const filePath = path.join(dataDir, `${id}.json`);
          if (await fs.pathExists(filePath)) {
            const restaurant = await fs.readJson(filePath);
            const updatedRestaurant = {
              ...restaurant,
              ...updates,
              id, // Ensure ID doesn't change
              updated_at: new Date().toISOString(),
            };

            await fs.writeJson(filePath, updatedRestaurant, { spaces: 2 });
            results.success.push(id);

            // Log the update
            await callPythonDB('log_edit', {
              restaurant_id: id,
              restaurant_name: restaurant.name_hebrew || id,
              admin_user_id: req.user.userId,
              edit_type: 'update',
              changes: JSON.stringify({ action: 'bulk_update', updates }),
            });
          } else {
            results.failed.push({ id, reason: 'Not found' });
          }
        } catch (error) {
          results.failed.push({ id, reason: error.message });
        }
      }

      res.json({
        message: `Updated ${results.success.length} of ${ids.length} restaurants`,
        results,
      });
    } catch (error) {
      console.error('Error bulk updating restaurants:', error);
      res.status(500).json({ error: 'Failed to bulk update restaurants' });
    }
  }
);

/**
 * GET /api/admin/bulk/restaurants/export
 * Export restaurants to CSV or JSON
 */
router.get('/restaurants/export',
  async (req, res) => {
    try {
      const { format = 'json', ids } = req.query;

      await fs.ensureDir(dataDir);
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      let restaurants = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(dataDir, file);
          const data = await fs.readJson(filePath);

          // If specific IDs requested, filter
          if (ids && Array.isArray(ids)) {
            if (ids.includes(data.id)) {
              restaurants.push(data);
            }
          } else {
            restaurants.push(data);
          }
        } catch (err) {
          console.warn(`Warning: Failed to read ${file}:`, err.message);
        }
      }

      if (format === 'csv') {
        // Flatten nested objects for CSV
        const flatRestaurants = restaurants.map(r => ({
          id: r.id,
          name_hebrew: r.name_hebrew,
          name_english: r.name_english,
          city: r.location?.city || '',
          neighborhood: r.location?.neighborhood || '',
          address: r.location?.address || '',
          cuisine_type: r.cuisine_type,
          status: r.status,
          price_range: r.price_range,
          phone: r.contact?.phone || '',
          website: r.contact?.website || '',
          google_rating: r.google_rating,
          latitude: r.location?.latitude || '',
          longitude: r.location?.longitude || '',
          created_at: r.created_at,
          updated_at: r.updated_at,
        }));

        const parser = new Parser();
        const csv = parser.parse(flatRestaurants);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=restaurants.csv');
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=restaurants.json');
        res.json(restaurants);
      }
    } catch (error) {
      console.error('Error exporting restaurants:', error);
      res.status(500).json({ error: 'Failed to export restaurants' });
    }
  }
);

/**
 * POST /api/admin/bulk/restaurants/import
 * Import restaurants from JSON
 * Requires: editor role or higher
 */
router.post('/restaurants/import',
  requireRole(['editor', 'admin', 'super_admin']),
  [body('restaurants').isArray({ min: 1 }).withMessage('At least one restaurant is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { restaurants } = req.body;
      const results = {
        created: [],
        updated: [],
        failed: [],
      };

      await fs.ensureDir(dataDir);

      for (const restaurant of restaurants) {
        try {
          const { v4: uuidv4 } = require('uuid');
          const id = restaurant.id || uuidv4();
          const filePath = path.join(dataDir, `${id}.json`);
          const exists = await fs.pathExists(filePath);

          const restaurantWithMeta = {
            ...restaurant,
            id,
            updated_at: new Date().toISOString(),
            created_at: exists ? restaurant.created_at : new Date().toISOString(),
          };

          await fs.writeJson(filePath, restaurantWithMeta, { spaces: 2 });

          if (exists) {
            results.updated.push(id);
          } else {
            results.created.push(id);
          }

          // Log the import
          await callPythonDB('log_restaurant_edit', {
            restaurant_id: id,
            restaurant_name: restaurant.name_hebrew || id,
            admin_user_id: req.user.userId,
            edit_type: exists ? 'update' : 'create',
            changes: JSON.stringify({ action: 'import' }),
          });
        } catch (error) {
          results.failed.push({
            restaurant: restaurant.name_hebrew || 'Unknown',
            reason: error.message,
          });
        }
      }

      res.json({
        message: `Imported ${results.created.length + results.updated.length} restaurants`,
        results,
      });
    } catch (error) {
      console.error('Error importing restaurants:', error);
      res.status(500).json({ error: 'Failed to import restaurants' });
    }
  }
);

/**
 * GET /api/admin/bulk/articles/export
 * Export articles to JSON
 */
router.get('/articles/export',
  async (req, res) => {
    try {
      const { ids } = req.query;

      const result = await callPythonDB('list_articles', {
        limit: 10000, // Get all articles
      });

      let articles = result.articles || [];

      // Filter by IDs if specified
      if (ids && Array.isArray(ids)) {
        articles = articles.filter(a => ids.includes(a.id));
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=articles.json');
      res.json(articles);
    } catch (error) {
      console.error('Error exporting articles:', error);
      res.status(500).json({ error: 'Failed to export articles' });
    }
  }
);

module.exports = router;
