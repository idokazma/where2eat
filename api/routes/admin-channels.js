const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Python executable path
const venvPython = path.join(__dirname, '..', '..', 'venv', 'bin', 'python');
const projectRoot = path.join(__dirname, '..', '..');

function getPythonPath() {
  return fs.existsSync(venvPython) ? venvPython : 'python3';
}

/**
 * Run an inline Python script and resolve with the parsed JSON output.
 */
function runPython(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn(getPythonPath(), ['-c', script], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: `${projectRoot}/src` }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python process exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    proc.on('error', (err) => { reject(err); });
  });
}

/**
 * Extract channel ID/handle from various YouTube URL formats.
 * Returns { channel_id, type } or null if the URL is not recognised.
 */
function extractChannelInfo(url) {
  // Handle @handle format  e.g. youtube.com/@FoodChannel
  const handleMatch = url.match(/youtube\.com\/@([^\/\?]+)/);
  if (handleMatch) return { channel_id: handleMatch[1], type: 'handle' };

  // Handle /channel/ID format
  const channelMatch = url.match(/youtube\.com\/channel\/([^\/\?]+)/);
  if (channelMatch) return { channel_id: channelMatch[1], type: 'id' };

  // Handle /c/ custom URL format
  const customMatch = url.match(/youtube\.com\/c\/([^\/\?]+)/);
  if (customMatch) return { channel_id: customMatch[1], type: 'custom' };

  return null;
}

/**
 * GET /api/admin/channels
 * List all monitored channels.
 */
router.get('/', async (req, res) => {
  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()
channels = db.list_monitored_channels()
print(json.dumps(channels))
`);
    res.json({ channels: Array.isArray(result) ? result : [], count: Array.isArray(result) ? result.length : 0 });
  } catch (error) {
    console.error('Error listing channels:', error);
    res.status(500).json({ error: 'Failed to list monitored channels', details: error.message });
  }
});

/**
 * POST /api/admin/channels
 * Add a YouTube channel to the monitored list.
 * Body: { channel_url, channel_name?, poll_interval_minutes? }
 */
router.post('/', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  const { channel_url, channel_name, poll_interval_minutes = 60 } = req.body;

  if (!channel_url) {
    return res.status(400).json({ error: 'channel_url is required' });
  }

  const channelInfo = extractChannelInfo(channel_url);
  if (!channelInfo) {
    return res.status(400).json({
      error: 'Unrecognised YouTube channel URL format',
      supported_formats: [
        'https://www.youtube.com/@handle',
        'https://www.youtube.com/channel/UCxxxxxxxx',
        'https://www.youtube.com/c/CustomName'
      ]
    });
  }

  const safeName = (channel_name || channelInfo.channel_id).replace(/'/g, "\\'");
  const safeUrl = channel_url.replace(/'/g, "\\'");
  const safeChannelId = channelInfo.channel_id.replace(/'/g, "\\'");

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()
channel_id = db.add_monitored_channel(
    channel_url='${safeUrl}',
    channel_id='${safeChannelId}',
    channel_name='${safeName}',
    poll_interval_minutes=${poll_interval_minutes}
)
channel = db.get_monitored_channel(channel_id)
print(json.dumps(channel or {"id": channel_id}))
`);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding channel:', error);
    res.status(500).json({ error: 'Failed to add channel', details: error.message });
  }
});

/**
 * PUT /api/admin/channels/:id
 * Update a monitored channel's settings.
 * Body: { enabled?, poll_interval_minutes?, channel_name? }
 */
router.put('/:id', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  const { id } = req.params;
  const { enabled, poll_interval_minutes, channel_name } = req.body;

  // Build a Python dict of fields to update (only those provided)
  const updates = {};
  if (enabled !== undefined) updates.enabled = enabled;
  if (poll_interval_minutes !== undefined) updates.poll_interval_minutes = poll_interval_minutes;
  if (channel_name !== undefined) updates.channel_name = channel_name;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' });
  }

  const updatesJson = JSON.stringify(updates).replace(/'/g, "\\'");

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()
updates = json.loads('${updatesJson}')
success = db.update_monitored_channel('${id}', **updates)
if success:
    channel = db.get_monitored_channel('${id}')
    print(json.dumps(channel or {"success": True}))
else:
    print(json.dumps({"error": "Channel not found"}))
`);

    if (result && result.error) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({ error: 'Failed to update channel', details: error.message });
  }
});

/**
 * DELETE /api/admin/channels/:id
 * Remove a channel from monitoring (admin only).
 */
router.delete('/:id', requireRole(['admin', 'super_admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()
success = db.delete_monitored_channel('${id}')
print(json.dumps({"success": bool(success), "id": "${id}"}))
`);

    if (!result.success) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json({ message: 'Channel removed from monitoring', id });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ error: 'Failed to delete channel', details: error.message });
  }
});

/**
 * POST /api/admin/channels/:id/poll
 * Trigger an immediate poll of the channel for new videos.
 * Creates analysis jobs for any videos not already in the episodes table.
 */
router.post('/:id/poll', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()

channel = db.get_monitored_channel('${id}')
if not channel:
    print(json.dumps({"error": "Channel not found"}))
else:
    # Collect existing video IDs for this channel to avoid duplicates
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT video_id FROM episodes WHERE channel_id = ?', (channel['channel_id'],))
        existing = set(row['video_id'] for row in cursor.fetchall())

    try:
        from youtube_channel_collector import YouTubeChannelCollector
        collector = YouTubeChannelCollector()
        videos = collector.get_channel_videos(channel['channel_url'], max_results=20)
        new_videos = [v for v in videos if v.get('video_id') not in existing]

        # Queue a job for every new video found
        job_ids = []
        for v in new_videos:
            url = v.get('url') or f"https://www.youtube.com/watch?v={v['video_id']}"
            job_id = db.create_job('video_analysis', video_url=url)
            job_ids.append(job_id)

        db.update_channel_poll_result('${id}', len(new_videos))
        print(json.dumps({
            "success": True,
            "new_videos": len(new_videos),
            "jobs_created": job_ids,
            "total_checked": len(videos)
        }))
    except Exception as e:
        db.update_channel_poll_result('${id}', 0)
        print(json.dumps({"success": False, "error": str(e)}))
`);

    if (result && result.error && result.error === 'Channel not found') {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error polling channel:', error);
    res.status(500).json({ error: 'Failed to poll channel', details: error.message });
  }
});

/**
 * GET /api/admin/channels/:id/videos
 * List episodes (processed videos) belonging to a channel.
 */
router.get('/:id/videos', async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()

channel = db.get_monitored_channel('${id}')
if not channel:
    print(json.dumps({"error": "Channel not found"}))
else:
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM episodes WHERE channel_id = ? ORDER BY published_at DESC LIMIT ? OFFSET ?',
            (channel['channel_id'], ${limit}, ${offset})
        )
        rows = cursor.fetchall()
        episodes = [dict(row) for row in rows]

        cursor.execute('SELECT COUNT(*) as total FROM episodes WHERE channel_id = ?', (channel['channel_id'],))
        total = cursor.fetchone()['total']

    print(json.dumps({"episodes": episodes, "total": total, "limit": ${limit}, "offset": ${offset}}))
`);

    if (result && result.error) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching channel videos:', error);
    res.status(500).json({ error: 'Failed to fetch channel videos', details: error.message });
  }
});

module.exports = router;
