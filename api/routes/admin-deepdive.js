const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/admin/deepdive
 * List episodes with their pipeline status (joined from video_queue)
 * Query params: ?search=, ?status=, ?page=, ?limit=
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

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
    search_filter = '${search.replace(/'/g, "\\'")}'
    status_filter = '${status.replace(/'/g, "\\'")}'
    if search_filter:
        where_clauses.append('(e.title LIKE ? OR e.channel_name LIKE ?)')
        params.append('%' + search_filter + '%')
        params.append('%' + search_filter + '%')
    if status_filter:
        where_clauses.append('vq.status = ?')
        params.append(status_filter)
    where_sql = ''
    if where_clauses:
        where_sql = 'WHERE ' + ' AND '.join(where_clauses)
    cursor.execute(f'SELECT COUNT(*) as count FROM episodes e LEFT JOIN video_queue vq ON e.video_id = vq.video_id {where_sql}', params)
    total = cursor.fetchone()['count']
    params_with_limit = params + [${limit}, ${offset}]
    cursor.execute(f'''
        SELECT
            e.id, e.video_id, e.video_url, e.title, e.channel_name, e.language,
            e.analysis_date, e.created_at,
            vq.status as queue_status, vq.priority as queue_priority,
            vq.attempt_count, vq.error_message, vq.restaurants_found,
            vq.processing_started_at, vq.processing_completed_at
        FROM episodes e
        LEFT JOIN video_queue vq ON e.video_id = vq.video_id
        {where_sql}
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
    ''', params_with_limit)
    episodes = [dict(row) for row in cursor.fetchall()]
    print(json.dumps({{
        'episodes': episodes,
        'pagination': {{
            'page': ${page},
            'limit': ${limit},
            'total': total,
            'total_pages': max(1, (total + ${limit} - 1) // ${limit})
        }}
    }}))
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
          console.error('Failed to parse deepdive episodes output:', stdout);
          res.status(500).json({ error: 'Failed to parse episodes data' });
        }
      } else {
        console.error('Failed to fetch deepdive episodes:', stderr);
        res.status(500).json({ error: 'Failed to fetch episodes' });
      }
    });
  } catch (error) {
    console.error('Error fetching deepdive episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

/**
 * GET /api/admin/deepdive/restaurants/:id
 * Restaurant deep dive — restaurant, related episode, and queue info
 * NOTE: Must be defined before /:videoId to avoid Express matching "restaurants" as a videoId
 */
router.get('/restaurants/:id', async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM restaurants WHERE id = ?', ('${req.params.id}',))
    restaurant_row = cursor.fetchone()
    if not restaurant_row:
        print(json.dumps({'found': False}))
    else:
        restaurant = dict(restaurant_row)
        episode = None
        queue_info = None
        if restaurant.get('episode_id'):
            cursor.execute('SELECT * FROM episodes WHERE id = ?', (restaurant['episode_id'],))
            ep_row = cursor.fetchone()
            if ep_row:
                episode = dict(ep_row)
                cursor.execute('SELECT * FROM video_queue WHERE video_id = ?', (episode['video_id'],))
                q_row = cursor.fetchone()
                queue_info = dict(q_row) if q_row else None
        print(json.dumps({{'found': True, 'restaurant': restaurant, 'episode': episode, 'queue_info': queue_info}}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.found) {
            return res.status(404).json({ error: 'Restaurant not found' });
          }
          res.json({
            restaurant: result.restaurant,
            episode: result.episode,
            queue_info: result.queue_info
          });
        } catch (err) {
          console.error('Failed to parse deepdive restaurant output:', stdout);
          res.status(500).json({ error: 'Failed to parse restaurant data' });
        }
      } else {
        console.error('Failed to fetch deepdive restaurant:', stderr);
        res.status(500).json({ error: 'Failed to fetch restaurant deep dive' });
      }
    });
  } catch (error) {
    console.error('Error fetching deepdive restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant deep dive' });
  }
});

/**
 * GET /api/admin/deepdive/:videoId
 * Full episode deep dive — episode, restaurants, queue_info, pipeline_logs, analysis files, transcript files
 */
router.get('/:videoId', async (req, res) => {
  try {
    const videoId = req.params.videoId;
    const projectRoot = path.join(__dirname, '..', '..');

    const python = spawn('python', ['-c', `
import sys
import json
import glob
import os
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()

video_id = '${videoId.replace(/'/g, "\\'")}'
project_root = '${projectRoot.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'

with db.get_connection() as conn:
    cursor = conn.cursor()

    # Full episode data
    cursor.execute('SELECT * FROM episodes WHERE video_id = ?', (video_id,))
    episode_row = cursor.fetchone()
    episode = dict(episode_row) if episode_row else None

    # Restaurants for this episode
    restaurants = []
    if episode:
        cursor.execute('SELECT * FROM restaurants WHERE episode_id = ?', (episode['id'],))
        restaurants = [dict(row) for row in cursor.fetchall()]

    # Queue info
    cursor.execute('SELECT * FROM video_queue WHERE video_id = ?', (video_id,))
    queue_row = cursor.fetchone()
    queue_info = dict(queue_row) if queue_row else None

    # Pipeline logs via video_queue_id
    pipeline_logs = []
    if queue_info:
        cursor.execute(
            'SELECT * FROM pipeline_logs WHERE video_queue_id = ? ORDER BY timestamp ASC',
            (queue_info['id'],)
        )
        pipeline_logs = [dict(row) for row in cursor.fetchall()]

# Analysis files from filesystem
analyses_dir = os.path.join(project_root, 'analyses')
analysis_files = []
request_files = sorted(glob.glob(os.path.join(analyses_dir, video_id + '_*_analysis_request.txt')))
response_files = sorted(glob.glob(os.path.join(analyses_dir, video_id + '_*_claude_analysis.json')))

# Build a map of timestamp -> files
timestamp_map = {{}}
for rf in request_files:
    basename = os.path.basename(rf)
    # Format: {videoId}_{timestamp}_analysis_request.txt
    # Strip prefix and suffix to extract timestamp
    prefix = video_id + '_'
    suffix = '_analysis_request.txt'
    if basename.startswith(prefix) and basename.endswith(suffix):
        ts = basename[len(prefix):-len(suffix)]
        timestamp_map.setdefault(ts, {{}})['request_file'] = rf

for rf in response_files:
    basename = os.path.basename(rf)
    prefix = video_id + '_'
    suffix = '_claude_analysis.json'
    if basename.startswith(prefix) and basename.endswith(suffix):
        ts = basename[len(prefix):-len(suffix)]
        timestamp_map.setdefault(ts, {{}})['response_file'] = rf

for ts in sorted(timestamp_map.keys()):
    entry = {{'timestamp': ts}}
    req_path = timestamp_map[ts].get('request_file')
    resp_path = timestamp_map[ts].get('response_file')
    if req_path:
        try:
            with open(req_path, 'r', encoding='utf-8', errors='replace') as f:
                entry['request'] = f.read()
        except Exception:
            entry['request'] = None
    else:
        entry['request'] = None
    if resp_path:
        try:
            with open(resp_path, 'r', encoding='utf-8', errors='replace') as f:
                entry['response'] = json.load(f)
        except Exception:
            entry['response'] = None
    else:
        entry['response'] = None
    analysis_files.append(entry)

# Transcript files from filesystem
transcripts_dir = os.path.join(project_root, 'transcripts')
transcript_files = []
transcript_paths = sorted(glob.glob(os.path.join(transcripts_dir, video_id + '_*.json')))
for tp in transcript_paths:
    try:
        with open(tp, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        transcript_files.append({{
            'filename': os.path.basename(tp),
            'content': content[:5000]
        }})
    except Exception:
        pass

print(json.dumps({{
    'episode': episode,
    'restaurants': restaurants,
    'queue_info': queue_info,
    'pipeline_logs': pipeline_logs,
    'analysis_files': analysis_files,
    'transcript_files': transcript_files
}}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.episode) {
            return res.status(404).json({ error: 'Episode not found' });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse deepdive episode output:', stdout);
          res.status(500).json({ error: 'Failed to parse episode data' });
        }
      } else {
        console.error('Failed to fetch deepdive episode:', stderr);
        res.status(500).json({ error: 'Failed to fetch episode deep dive' });
      }
    });
  } catch (error) {
    console.error('Error fetching deepdive episode:', error);
    res.status(500).json({ error: 'Failed to fetch episode deep dive' });
  }
});

/**
 * POST /api/admin/deepdive/:videoId/reprocess
 * Re-queue a video for processing
 * Requires: admin role or higher
 */
router.post('/:videoId/reprocess', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.database import Database
db = Database()
with db.get_connection() as conn:
    cursor = conn.cursor()
    video_id = '${req.params.videoId.replace(/'/g, "\\'")}'

    # Look up the episode
    cursor.execute('SELECT * FROM episodes WHERE video_id = ?', (video_id,))
    episode_row = cursor.fetchone()
    if not episode_row:
        print(json.dumps({{'success': False, 'error': 'Episode not found'}}))
    else:
        episode = dict(episode_row)
        # Check existing queue entry
        cursor.execute('SELECT * FROM video_queue WHERE video_id = ?', (video_id,))
        queue_row = cursor.fetchone()
        if queue_row:
            queue_item = dict(queue_row)
            if queue_item['status'] in ('queued', 'processing'):
                print(json.dumps({{'success': False, 'error': f"Video is already {queue_item['status']}"}}))
            else:
                cursor.execute('''
                    UPDATE video_queue
                    SET status = 'queued', error_message = NULL,
                        attempt_count = attempt_count + 1,
                        updated_at = datetime('now')
                    WHERE video_id = ?
                ''', (video_id,))
                conn.commit()
                print(json.dumps({{'success': True, 'message': 'Video queued for reprocessing'}}))
        else:
            # Insert new queue entry
            cursor.execute('''
                INSERT INTO video_queue (video_id, video_url, title, channel_name, status, priority, attempt_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'queued', 0, 1, datetime('now'), datetime('now'))
            ''', (video_id, episode.get('video_url', ''), episode.get('title', ''), episode.get('channel_name', '')))
            conn.commit()
            print(json.dumps({{'success': True, 'message': 'Video queued for reprocessing'}}))
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
            const status = result.error === 'Episode not found' ? 404 : 400;
            return res.status(status).json({ error: result.error });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse reprocess output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to reprocess video:', stderr);
        res.status(500).json({ error: 'Failed to reprocess video' });
      }
    });
  } catch (error) {
    console.error('Error reprocessing video:', error);
    res.status(500).json({ error: 'Failed to reprocess video' });
  }
});

module.exports = router;
