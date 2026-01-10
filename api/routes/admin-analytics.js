const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

const dataDir = path.join(__dirname, '..', '..', 'data', 'restaurants');

/**
 * GET /api/admin/analytics/overview
 * Get high-level overview metrics
 */
router.get('/overview', async (req, res) => {
  try {
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

    // Calculate metrics
    const total = restaurants.length;
    const byStatus = restaurants.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    const byOpinion = restaurants.reduce((acc, r) => {
      acc[r.host_opinion] = (acc[r.host_opinion] || 0) + 1;
      return acc;
    }, {});

    // Calculate new restaurants (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newRestaurants = restaurants.filter(r => {
      return r.created_at && new Date(r.created_at) >= sevenDaysAgo;
    });

    // Calculate trend (comparing last 7 days to previous 7 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const previousWeek = restaurants.filter(r => {
      const date = r.created_at ? new Date(r.created_at) : null;
      return date && date >= fourteenDaysAgo && date < sevenDaysAgo;
    });

    const trend = previousWeek.length > 0
      ? ((newRestaurants.length - previousWeek.length) / previousWeek.length * 100).toFixed(1)
      : newRestaurants.length > 0 ? 100 : 0;

    res.json({
      overview: {
        totalRestaurants: total,
        newThisWeek: newRestaurants.length,
        trend: parseFloat(trend),
        byStatus,
        byOpinion,
      },
      videos: {
        total: 0, // Placeholder - will be implemented with episodes table
        processed: 0,
        pending: 0,
      },
      articles: {
        total: 0, // Placeholder - will be implemented with CMS
        published: 0,
        draft: 0,
      },
      jobs: {
        active: 0, // Placeholder - will be implemented with job queue
        completed: 0,
        failed: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching overview analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/admin/analytics/restaurants
 * Get detailed restaurant analytics
 */
router.get('/restaurants', async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
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

    // Filter by period
    const periodDays = parseInt(period);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);
    const filteredRestaurants = restaurants.filter(r => {
      return !r.created_at || new Date(r.created_at) >= cutoffDate;
    });

    // Cuisine distribution
    const cuisineStats = restaurants.reduce((acc, r) => {
      const cuisine = r.cuisine_type || 'Unknown';
      acc[cuisine] = (acc[cuisine] || 0) + 1;
      return acc;
    }, {});

    const cuisineDistribution = Object.entries(cuisineStats)
      .map(([cuisine, count]) => ({ cuisine, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Location distribution
    const locationStats = restaurants.reduce((acc, r) => {
      const city = r.location?.city || 'Unknown';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});

    const locationDistribution = Object.entries(locationStats)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Price range distribution
    const priceRangeStats = restaurants.reduce((acc, r) => {
      acc[r.price_range] = (acc[r.price_range] || 0) + 1;
      return acc;
    }, {});

    // Growth over time (last 30 days)
    const growthData = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = restaurants.filter(r => {
        if (!r.created_at) return false;
        const created = new Date(r.created_at);
        return created >= date && created < nextDate;
      }).length;

      growthData.push({
        date: date.toISOString().split('T')[0],
        count,
        cumulative: restaurants.filter(r => {
          if (!r.created_at) return false;
          return new Date(r.created_at) <= date;
        }).length,
      });
    }

    res.json({
      cuisineDistribution,
      locationDistribution,
      priceRangeStats,
      growthData,
      statusBreakdown: restaurants.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
      sentimentBreakdown: restaurants.reduce((acc, r) => {
        acc[r.host_opinion] = (acc[r.host_opinion] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Error fetching restaurant analytics:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant analytics' });
  }
});

/**
 * GET /api/admin/analytics/activities
 * Get recent activity feed
 */
router.get('/activities', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    await fs.ensureDir(dataDir);
    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    let restaurants = [];
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataDir, file);
        const data = await fs.readJson(filePath);
        const stats = await fs.stat(filePath);
        restaurants.push({
          ...data,
          file_modified: stats.mtime,
        });
      } catch (err) {
        console.warn(`Warning: Failed to read ${file}:`, err.message);
      }
    }

    // Create activity items from recent restaurants
    const activities = restaurants
      .sort((a, b) => {
        const aDate = a.updated_at || a.created_at || a.file_modified;
        const bDate = b.updated_at || b.created_at || b.file_modified;
        return new Date(bDate) - new Date(aDate);
      })
      .slice(0, parseInt(limit))
      .map(r => {
        const isNew = r.created_at === r.updated_at || !r.updated_at;
        return {
          id: r.id,
          type: isNew ? 'restaurant_created' : 'restaurant_updated',
          description: isNew
            ? `Restaurant "${r.name_hebrew}" was added`
            : `Restaurant "${r.name_hebrew}" was updated`,
          timestamp: r.updated_at || r.created_at || r.file_modified,
          metadata: {
            restaurantId: r.id,
            restaurantName: r.name_hebrew,
            cuisine: r.cuisine_type,
            status: r.status,
          },
        };
      });

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

/**
 * GET /api/admin/analytics/system
 * Get system health metrics
 */
router.get('/system', async (req, res) => {
  try {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'where2eat.db');
    let dbSize = 0;
    if (await fs.pathExists(dbPath)) {
      const stats = await fs.stat(dbPath);
      dbSize = stats.size;
    }

    await fs.ensureDir(dataDir);
    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    const totalFiles = jsonFiles.length;

    res.json({
      database: {
        size: dbSize,
        sizeFormatted: (dbSize / 1024 / 1024).toFixed(2) + ' MB',
        totalRecords: totalFiles,
      },
      api: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        responseTime: {
          p50: 50, // Placeholder
          p95: 120, // Placeholder
          p99: 200, // Placeholder
        },
      },
      errors: {
        total: 0, // Placeholder
        recent: [],
      },
    });
  } catch (error) {
    console.error('Error fetching system analytics:', error);
    res.status(500).json({ error: 'Failed to fetch system analytics' });
  }
});

module.exports = router;
