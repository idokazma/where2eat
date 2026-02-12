const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/admin/pipeline
 * Pipeline overview (queue depth, processing, stats)
 */
router.get('/', async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    # Queue depth
    cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status = 'queued'")
    queued = cursor.fetchone()['count']
    # Currently processing
    cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status = 'processing'")
    processing = cursor.fetchone()['count']
    # Completed
    cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status = 'completed'")
    completed = cursor.fetchone()['count']
    # Failed
    cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status = 'failed'")
    failed = cursor.fetchone()['count']
    # Skipped
    cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status = 'skipped'")
    skipped = cursor.fetchone()['count']
    print(json.dumps({
        'overview': {
            'queued': queued,
            'processing': processing,
            'completed': completed,
            'failed': failed,
            'skipped': skipped,
            'total': queued + processing + completed + failed + skipped
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
          console.error('Failed to parse pipeline overview output:', stdout);
          res.status(500).json({ error: 'Failed to parse pipeline data' });
        }
      } else {
        console.error('Failed to fetch pipeline overview:', stderr);
        res.status(500).json({ error: 'Failed to fetch pipeline overview' });
      }
    });
  } catch (error) {
    console.error('Error fetching pipeline overview:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline overview' });
  }
});

/**
 * GET /api/admin/pipeline/queue
 * List queued videos (paginated)
 */
router.get('/queue', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status = 'queued'")
    total = cursor.fetchone()['count']
    cursor.execute('''
        SELECT * FROM video_queue
        WHERE status = 'queued'
        ORDER BY priority DESC, created_at ASC
        LIMIT ? OFFSET ?
    ''', (${limit}, ${offset}))
    items = [dict(row) for row in cursor.fetchall()]
    print(json.dumps({
        'queue': items,
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
          console.error('Failed to parse queue output:', stdout);
          res.status(500).json({ error: 'Failed to parse queue data' });
        }
      } else {
        console.error('Failed to fetch queue:', stderr);
        res.status(500).json({ error: 'Failed to fetch queue' });
      }
    });
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

/**
 * GET /api/admin/pipeline/history
 * List completed/failed videos (paginated)
 */
router.get('/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status IN ('completed', 'failed')")
    total = cursor.fetchone()['count']
    cursor.execute('''
        SELECT * FROM video_queue
        WHERE status IN ('completed', 'failed')
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
    ''', (${limit}, ${offset}))
    items = [dict(row) for row in cursor.fetchall()]
    print(json.dumps({
        'history': items,
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
          console.error('Failed to parse history output:', stdout);
          res.status(500).json({ error: 'Failed to parse history data' });
        }
      } else {
        console.error('Failed to fetch history:', stderr);
        res.status(500).json({ error: 'Failed to fetch history' });
      }
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * GET /api/admin/pipeline/logs
 * Get pipeline logs (filterable)
 */
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const level = req.query.level || '';
    const event_type = req.query.event_type || '';

    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    where_clauses = []
    params = []
    level_filter = '${level}'
    event_type_filter = '${event_type}'
    if level_filter:
        where_clauses.append('level = ?')
        params.append(level_filter)
    if event_type_filter:
        where_clauses.append('event_type = ?')
        params.append(event_type_filter)
    where_sql = ''
    if where_clauses:
        where_sql = 'WHERE ' + ' AND '.join(where_clauses)
    cursor.execute(f'SELECT COUNT(*) as count FROM pipeline_logs {where_sql}', params)
    total = cursor.fetchone()['count']
    params_with_limit = params + [${limit}, ${offset}]
    cursor.execute(f'''
        SELECT * FROM pipeline_logs
        {where_sql}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
    ''', params_with_limit)
    logs = [dict(row) for row in cursor.fetchall()]
    print(json.dumps({
        'logs': logs,
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
          console.error('Failed to parse logs output:', stdout);
          res.status(500).json({ error: 'Failed to parse logs data' });
        }
      } else {
        console.error('Failed to fetch logs:', stderr);
        res.status(500).json({ error: 'Failed to fetch pipeline logs' });
      }
    });
  } catch (error) {
    console.error('Error fetching pipeline logs:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline logs' });
  }
});

/**
 * GET /api/admin/pipeline/stats
 * Get pipeline statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    # Overall counts by status
    cursor.execute('''
        SELECT status, COUNT(*) as count
        FROM video_queue
        GROUP BY status
    ''')
    status_counts = {row['status']: row['count'] for row in cursor.fetchall()}
    # Average processing time for completed items
    cursor.execute('''
        SELECT AVG(
            CAST((julianday(processing_completed_at) - julianday(processing_started_at)) * 86400 AS INTEGER)
        ) as avg_seconds
        FROM video_queue
        WHERE status = 'completed' AND processing_completed_at IS NOT NULL AND processing_started_at IS NOT NULL
    ''')
    row = cursor.fetchone()
    avg_processing_seconds = row['avg_seconds'] if row and row['avg_seconds'] else 0
    # Items processed in last 24 hours
    cursor.execute('''
        SELECT COUNT(*) as count
        FROM video_queue
        WHERE status = 'completed'
        AND updated_at >= datetime('now', '-1 day')
    ''')
    last_24h = cursor.fetchone()['count']
    # Items processed in last 7 days
    cursor.execute('''
        SELECT COUNT(*) as count
        FROM video_queue
        WHERE status = 'completed'
        AND updated_at >= datetime('now', '-7 days')
    ''')
    last_7d = cursor.fetchone()['count']
    # Failure rate
    total = sum(status_counts.values()) if status_counts else 0
    failed = status_counts.get('failed', 0)
    failure_rate = (failed / total * 100) if total > 0 else 0
    print(json.dumps({
        'stats': {
            'status_counts': status_counts,
            'avg_processing_seconds': round(avg_processing_seconds, 1),
            'completed_last_24h': last_24h,
            'completed_last_7d': last_7d,
            'failure_rate_percent': round(failure_rate, 2),
            'total_items': total
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
          console.error('Failed to parse stats output:', stdout);
          res.status(500).json({ error: 'Failed to parse stats data' });
        }
      } else {
        console.error('Failed to fetch stats:', stderr);
        res.status(500).json({ error: 'Failed to fetch pipeline stats' });
      }
    });
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stats' });
  }
});

/**
 * POST /api/admin/pipeline/:id/retry
 * Retry a failed video
 * Requires: admin role or higher
 */
router.post('/:id/retry', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM video_queue WHERE id = ?", ('${req.params.id}',))
    item = cursor.fetchone()
    if item:
        item = dict(item)
        if item['status'] != 'failed':
            print(json.dumps({'success': False, 'error': 'Only failed items can be retried'}))
        else:
            cursor.execute('''
                UPDATE video_queue
                SET status = 'queued', error_message = NULL, updated_at = datetime('now')
                WHERE id = ?
            ''', ('${req.params.id}',))
            conn.commit()
            print(json.dumps({'success': True, 'message': 'Video requeued for retry'}))
    else:
        print(json.dumps({'success': False, 'error': 'Item not found'}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            const status = result.error === 'Item not found' ? 404 : 400;
            return res.status(status).json({ error: result.error });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse retry output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to retry video:', stderr);
        res.status(500).json({ error: 'Failed to retry video' });
      }
    });
  } catch (error) {
    console.error('Error retrying video:', error);
    res.status(500).json({ error: 'Failed to retry video' });
  }
});

/**
 * POST /api/admin/pipeline/:id/skip
 * Skip a queued video
 * Requires: admin role or higher
 */
router.post('/:id/skip', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM video_queue WHERE id = ?", ('${req.params.id}',))
    item = cursor.fetchone()
    if item:
        item = dict(item)
        if item['status'] != 'queued':
            print(json.dumps({'success': False, 'error': 'Only queued items can be skipped'}))
        else:
            cursor.execute('''
                UPDATE video_queue
                SET status = 'skipped', updated_at = datetime('now')
                WHERE id = ?
            ''', ('${req.params.id}',))
            conn.commit()
            print(json.dumps({'success': True, 'message': 'Video skipped'}))
    else:
        print(json.dumps({'success': False, 'error': 'Item not found'}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            const status = result.error === 'Item not found' ? 404 : 400;
            return res.status(status).json({ error: result.error });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse skip output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to skip video:', stderr);
        res.status(500).json({ error: 'Failed to skip video' });
      }
    });
  } catch (error) {
    console.error('Error skipping video:', error);
    res.status(500).json({ error: 'Failed to skip video' });
  }
});

/**
 * POST /api/admin/pipeline/:id/prioritize
 * Move video to front of queue
 * Requires: admin role or higher
 */
router.post('/:id/prioritize', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM video_queue WHERE id = ?", ('${req.params.id}',))
    item = cursor.fetchone()
    if item:
        item = dict(item)
        if item['status'] != 'queued':
            print(json.dumps({'success': False, 'error': 'Only queued items can be prioritized'}))
        else:
            # Set priority higher than current max
            cursor.execute("SELECT MAX(priority) as max_priority FROM video_queue WHERE status = 'queued'")
            max_row = cursor.fetchone()
            new_priority = (max_row['max_priority'] or 0) + 1
            cursor.execute('''
                UPDATE video_queue
                SET priority = ?, updated_at = datetime('now')
                WHERE id = ?
            ''', (new_priority, '${req.params.id}'))
            conn.commit()
            print(json.dumps({'success': True, 'message': 'Video moved to front of queue', 'new_priority': new_priority}))
    else:
        print(json.dumps({'success': False, 'error': 'Item not found'}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            const status = result.error === 'Item not found' ? 404 : 400;
            return res.status(status).json({ error: result.error });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse prioritize output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to prioritize video:', stderr);
        res.status(500).json({ error: 'Failed to prioritize video' });
      }
    });
  } catch (error) {
    console.error('Error prioritizing video:', error);
    res.status(500).json({ error: 'Failed to prioritize video' });
  }
});

/**
 * DELETE /api/admin/pipeline/:id
 * Remove video from queue
 * Requires: admin role or higher
 */
router.delete('/:id', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM video_queue WHERE id = ?", ('${req.params.id}',))
    item = cursor.fetchone()
    if item:
        cursor.execute("DELETE FROM video_queue WHERE id = ?", ('${req.params.id}',))
        conn.commit()
        print(json.dumps({'success': True, 'message': 'Video removed from queue'}))
    else:
        print(json.dumps({'success': False, 'error': 'Item not found'}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            return res.status(404).json({ error: result.error });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse delete output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to remove video from queue:', stderr);
        res.status(500).json({ error: 'Failed to remove video from queue' });
      }
    });
  } catch (error) {
    console.error('Error removing video from queue:', error);
    res.status(500).json({ error: 'Failed to remove video from queue' });
  }
});

module.exports = router;
