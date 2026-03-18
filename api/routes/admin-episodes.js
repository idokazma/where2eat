const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/admin/episodes
 * List all analyzed episodes with restaurant counts (paginated)
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    # Build search filter
    where_sql = ''
    params = []
    search_term = '${search.replace(/'/g, "''")}'
    if search_term:
        where_sql = 'WHERE e.title LIKE ? OR e.channel_name LIKE ?'
        search_pattern = f'%{search_term}%'
        params = [search_pattern, search_pattern]
    # Get total count
    count_sql = f'SELECT COUNT(*) as count FROM episodes e {where_sql}'
    cursor.execute(count_sql, params)
    total = cursor.fetchone()['count']
    # Get episodes with restaurant count
    episodes_sql = f'''
        SELECT e.id, e.video_id, e.video_url, e.channel_id, e.channel_name, e.title,
               e.analysis_date, e.created_at,
               COUNT(r.id) as restaurant_count
        FROM episodes e
        LEFT JOIN restaurants r ON r.episode_id = e.id
        {where_sql}
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
    '''
    params_with_limit = params + [${limit}, ${offset}]
    cursor.execute(episodes_sql, params_with_limit)
    episodes = [dict(row) for row in cursor.fetchall()]
    print(json.dumps({
        'episodes': episodes,
        'pagination': {
            'page': ${page},
            'limit': ${limit},
            'total': total,
            'total_pages': max(1, (total + ${limit} - 1) // ${limit})
        }
    }))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          res.json(result);
        } catch (err) {
          console.error('Failed to parse episodes output:', stdout);
          res.status(500).json({ error: 'Failed to parse episodes data' });
        }
      } else {
        console.error('Failed to fetch episodes:', stderr);
        res.status(500).json({ error: 'Failed to fetch episodes' });
      }
    });
  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

/**
 * GET /api/admin/episodes/:id/restaurants
 * Get restaurants for a specific episode
 */
router.get('/:id/restaurants', async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, name_hebrew, name_english, city, cuisine_type,
               google_rating, status, created_at
        FROM restaurants
        WHERE episode_id = ?
        ORDER BY created_at DESC
    ''', ('${req.params.id}',))
    restaurants = [dict(row) for row in cursor.fetchall()]
    print(json.dumps({
        'restaurants': restaurants
    }))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          res.json(result);
        } catch (err) {
          console.error('Failed to parse episode restaurants output:', stdout);
          res.status(500).json({ error: 'Failed to parse restaurants data' });
        }
      } else {
        console.error('Failed to fetch episode restaurants:', stderr);
        res.status(500).json({ error: 'Failed to fetch episode restaurants' });
      }
    });
  } catch (error) {
    console.error('Error fetching episode restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch episode restaurants' });
  }
});

module.exports = router;
