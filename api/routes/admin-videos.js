const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Helper function to call Python video processing
 */
function callPythonScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '..', '..', 'scripts', scriptName);
    const python = spawn('python', [pythonScript, ...args]);

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
        reject(new Error(`Script failed: ${stderr}`));
      } else {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (err) {
          resolve({ output: stdout });
        }
      }
    });
  });
}

/**
 * GET /api/admin/videos
 * List all video processing jobs
 */
router.get('/', async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('''
        SELECT j.*, e.title as video_title, e.video_url
        FROM jobs j
        LEFT JOIN episodes e ON j.episode_id = e.id
        ORDER BY j.created_at DESC
        LIMIT 50
    ''')
    jobs = [dict(row) for row in cursor.fetchall()]
    print(json.dumps({'jobs': jobs}))
    `]);

    let stdout = '';
    python.stdout.on('data', (data) => stdout += data);
    python.on('close', (code) => {
      if (code === 0) {
        const result = JSON.parse(stdout);
        res.json(result);
      } else {
        res.status(500).json({ error: 'Failed to fetch jobs' });
      }
    });
  } catch (error) {
    console.error('Error fetching video jobs:', error);
    res.status(500).json({ error: 'Failed to fetch video jobs' });
  }
});

/**
 * POST /api/admin/videos
 * Process a new YouTube video
 */
router.post('/', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  try {
    const { video_url } = req.body;

    if (!video_url) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    // Validate YouTube URL
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
    const match = video_url.match(youtubeRegex);

    if (!match) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Start processing in background
    const python = spawn('python', [
      path.join(__dirname, '..', '..', 'scripts', 'main.py'),
      video_url
    ]);

    // Don't wait for completion, just acknowledge
    res.status(202).json({
      message: 'Video processing started',
      video_url,
      status: 'processing'
    });

    // Log output
    python.stdout.on('data', (data) => {
      console.log(`Processing: ${data}`);
    });

    python.stderr.on('data', (data) => {
      console.error(`Error: ${data}`);
    });

  } catch (error) {
    console.error('Error starting video processing:', error);
    res.status(500).json({ error: 'Failed to start processing' });
  }
});

/**
 * GET /api/admin/videos/:id
 * Get video processing job details
 */
router.get('/:id', async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM jobs WHERE id = ?', ('${req.params.id}',))
    job = cursor.fetchone()
    if job:
        job = dict(job)
        # Get associated restaurants
        cursor.execute('''
            SELECT * FROM restaurants
            WHERE episode_id = (SELECT episode_id FROM jobs WHERE id = ?)
        ''', ('${req.params.id}',))
        restaurants = [dict(r) for r in cursor.fetchall()]
        job['restaurants'] = restaurants
    print(json.dumps({'job': job}))
    `]);

    let stdout = '';
    python.stdout.on('data', (data) => stdout += data);
    python.on('close', (code) => {
      if (code === 0) {
        const result = JSON.parse(stdout);
        if (!result.job) {
          return res.status(404).json({ error: 'Job not found' });
        }
        res.json(result.job);
      } else {
        res.status(500).json({ error: 'Failed to fetch job' });
      }
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
});

/**
 * DELETE /api/admin/videos/:id
 * Cancel/delete a video processing job
 */
router.delete('/:id', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const python = spawn('python', ['-c', `
import sys
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('DELETE FROM jobs WHERE id = ?', ('${req.params.id}',))
    conn.commit()
print('success')
    `]);

    python.on('close', (code) => {
      if (code === 0) {
        res.json({ message: 'Job deleted successfully' });
      } else {
        res.status(500).json({ error: 'Failed to delete job' });
      }
    });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

module.exports = router;
