const express = require('express');
const { query, body, param, validationResult } = require('express-validator');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

const dataDir = path.join(__dirname, '..', '..', 'data', 'restaurants');

/**
 * GET /api/admin/restaurants
 * Get all restaurants with pagination, sorting, and filtering
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sort').optional().isString(),
    query('search').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        page = 1,
        limit = 25,
        sort = '-created_at',
        search = '',
        'filter[status]': filterStatus,
        'filter[cuisine]': filterCuisine,
        'filter[city]': filterCity,
      } = req.query;

      // Read all restaurant files
      await fs.ensureDir(dataDir);
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      let restaurants = [];
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(dataDir, file);
          const data = await fs.readJson(filePath);
          restaurants.push(data);
        } catch (err) {
          console.warn(`Warning: Failed to read ${file}:`, err.message);
        }
      }

      // Apply filters
      let filtered = restaurants;

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(r =>
          r.name_hebrew?.toLowerCase().includes(searchLower) ||
          r.name_english?.toLowerCase().includes(searchLower) ||
          r.location?.city?.toLowerCase().includes(searchLower) ||
          r.cuisine_type?.toLowerCase().includes(searchLower)
        );
      }

      if (filterStatus) {
        filtered = filtered.filter(r => r.status === filterStatus);
      }

      if (filterCuisine) {
        filtered = filtered.filter(r => r.cuisine_type === filterCuisine);
      }

      if (filterCity) {
        filtered = filtered.filter(r => r.location?.city === filterCity);
      }

      // Apply sorting
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortDirection = sort.startsWith('-') ? -1 : 1;

      filtered.sort((a, b) => {
        let aVal, bVal;

        switch (sortField) {
          case 'name':
            aVal = a.name_hebrew || '';
            bVal = b.name_hebrew || '';
            break;
          case 'city':
            aVal = a.location?.city || '';
            bVal = b.location?.city || '';
            break;
          case 'cuisine':
            aVal = a.cuisine_type || '';
            bVal = b.cuisine_type || '';
            break;
          case 'created_at':
          default:
            aVal = a.created_at || '';
            bVal = b.created_at || '';
            break;
        }

        if (aVal < bVal) return -1 * sortDirection;
        if (aVal > bVal) return 1 * sortDirection;
        return 0;
      });

      // Apply pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedRestaurants = filtered.slice(startIndex, startIndex + limitNum);

      res.json({
        restaurants: paginatedRestaurants,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limitNum),
        },
      });
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      res.status(500).json({ error: 'Failed to fetch restaurants' });
    }
  }
);

/**
 * GET /api/admin/restaurants/:id
 * Get single restaurant by ID
 */
router.get('/:id',
  [param('id').notEmpty()],
  async (req, res) => {
    try {
      const { id } = req.params;
      const filePath = path.join(dataDir, `${id}.json`);

      if (await fs.pathExists(filePath)) {
        const data = await fs.readJson(filePath);
        res.json(data);
      } else {
        res.status(404).json({ error: 'Restaurant not found' });
      }
    } catch (error) {
      console.error('Error fetching restaurant:', error);
      res.status(500).json({ error: 'Failed to fetch restaurant' });
    }
  }
);

/**
 * POST /api/admin/restaurants
 * Create new restaurant
 * Requires: editor role or higher
 */
router.post('/',
  requireRole(['editor', 'admin', 'super_admin']),
  [
    body('name_hebrew').notEmpty().withMessage('Hebrew name is required'),
    body('cuisine_type').notEmpty().withMessage('Cuisine type is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const restaurant = req.body;
      const { v4: uuidv4 } = require('uuid');
      const id = restaurant.id || uuidv4();
      const filePath = path.join(dataDir, `${id}.json`);

      const restaurantWithMeta = {
        ...restaurant,
        id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await fs.ensureDir(dataDir);
      await fs.writeJson(filePath, restaurantWithMeta, { spaces: 2 });

      // Log the edit
      // TODO: Call Python bridge to log edit in restaurant_edits table

      res.status(201).json(restaurantWithMeta);
    } catch (error) {
      console.error('Error creating restaurant:', error);
      res.status(500).json({ error: 'Failed to create restaurant' });
    }
  }
);

/**
 * PUT /api/admin/restaurants/:id
 * Update restaurant
 * Requires: editor role or higher
 */
router.put('/:id',
  requireRole(['editor', 'admin', 'super_admin']),
  [
    param('id').notEmpty(),
    body('name_hebrew').notEmpty().withMessage('Hebrew name is required'),
    body('cuisine_type').notEmpty().withMessage('Cuisine type is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const restaurant = req.body;
      const filePath = path.join(dataDir, `${id}.json`);

      if (!(await fs.pathExists(filePath))) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      const updatedRestaurant = {
        ...restaurant,
        id,
        updated_at: new Date().toISOString(),
      };

      await fs.writeJson(filePath, updatedRestaurant, { spaces: 2 });

      // Log the edit
      // TODO: Call Python bridge to log edit in restaurant_edits table

      res.json(updatedRestaurant);
    } catch (error) {
      console.error('Error updating restaurant:', error);
      res.status(500).json({ error: 'Failed to update restaurant' });
    }
  }
);

/**
 * DELETE /api/admin/restaurants/:id
 * Delete restaurant
 * Requires: admin role or higher
 */
router.delete('/:id',
  requireRole(['admin', 'super_admin']),
  [param('id').notEmpty()],
  async (req, res) => {
    try {
      const { id } = req.params;
      const filePath = path.join(dataDir, `${id}.json`);

      if (!(await fs.pathExists(filePath))) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      await fs.remove(filePath);

      // Log the edit
      // TODO: Call Python bridge to log edit in restaurant_edits table

      res.json({ message: 'Restaurant deleted successfully' });
    } catch (error) {
      console.error('Error deleting restaurant:', error);
      res.status(500).json({ error: 'Failed to delete restaurant' });
    }
  }
);

/**
 * GET /api/admin/restaurants/:id/history
 * Get edit history for a restaurant
 */
router.get('/:id/history',
  [param('id').notEmpty()],
  async (req, res) => {
    try {
      const { id } = req.params;

      // TODO: Call Python bridge to get edit history from restaurant_edits table

      // Mock response for now
      res.json({
        history: [
          {
            id: '1',
            restaurant_id: id,
            admin_email: req.user.email,
            admin_name: req.user.name,
            edit_type: 'update',
            changes: { price_range: { old: 'budget', new: 'mid-range' } },
            timestamp: new Date().toISOString(),
          },
        ],
      });
    } catch (error) {
      console.error('Error fetching edit history:', error);
      res.status(500).json({ error: 'Failed to fetch edit history' });
    }
  }
);

module.exports = router;
