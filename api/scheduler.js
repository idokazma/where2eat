const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

// Paths relative to the api/ directory's parent (project root)
const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python');
const projectRoot = path.join(__dirname, '..');

// ---- In-memory scheduler state ----
let pollTimer = null;
let processTimer = null;
let isEnabled = true; // enabled by default — built-in cron
let isPolling = false;
let isProcessing = false;
let lastPollAt = null;
let lastProcessAt = null;
let nextPollAt = null;
let nextProcessAt = null;
let pollIntervalMs = 3600000;   // 1 hour default
let processIntervalMs = 60000;  // 1 minute default
let stats = { polls_completed: 0, jobs_processed: 0, errors: 0 };

// ---- Helpers ----

function getPythonPath() {
  return fs.existsSync(venvPython) ? venvPython : 'python3';
}

function runPython(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn(getPythonPath(), ['-c', script], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: `${projectRoot}/src` }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python process exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        resolve({ output: stdout });
      }
    });

    proc.on('error', (err) => { reject(err); });
  });
}

function computeNextTime(lastTime, intervalMs) {
  if (!lastTime) return new Date().toISOString();
  return new Date(new Date(lastTime).getTime() + intervalMs).toISOString();
}

// ---- Core scheduler tasks ----

async function pollChannels() {
  if (isPolling) return;
  isPolling = true;

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()

channels = db.get_channels_due_for_polling()
results = []

for ch in channels:
    try:
        existing_ids = set()
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT video_id FROM episodes WHERE channel_id = ?', (ch['channel_id'],))
            existing_ids = set(row['video_id'] for row in cursor.fetchall())

        try:
            from youtube_channel_collector import YouTubeChannelCollector
            collector = YouTubeChannelCollector()
            videos = collector.get_channel_videos(ch['channel_url'], max_results=20)
            new_videos = [v for v in videos if v.get('video_id') not in existing_ids]

            for v in new_videos:
                url = v.get('url') or f"https://www.youtube.com/watch?v={v['video_id']}"
                db.create_job('video_analysis', video_url=url, channel_url=ch['channel_url'])

            db.update_channel_poll_result(ch['id'], len(new_videos))
            results.append({"channel": ch['channel_name'], "new": len(new_videos)})
        except Exception as e:
            db.update_channel_poll_result(ch['id'], 0)
            results.append({"channel": ch['channel_name'], "error": str(e)})
    except Exception as e:
        results.append({"channel": ch.get('channel_name', 'unknown'), "error": str(e)})

print(json.dumps({"polled": len(channels), "results": results}))
`);

    lastPollAt = new Date().toISOString();
    nextPollAt = computeNextTime(lastPollAt, pollIntervalMs);
    stats.polls_completed++;
    console.log('[Scheduler] Poll completed:', result);
    return result;
  } catch (err) {
    stats.errors++;
    console.error('[Scheduler] Poll error:', err.message);
    return { error: err.message };
  } finally {
    isPolling = false;
  }
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()

job = db.get_pending_job()
if not job:
    print(json.dumps({"processed": False, "reason": "queue_empty"}))
else:
    db.update_job_status(job['id'], 'processing')
    try:
        from backend_service import get_backend_service
        service = get_backend_service()
        result = service.process_video(job['video_url'])
        restaurants_found = result.get('restaurants_found', 0) if isinstance(result, dict) else 0
        db.update_job_status(job['id'], 'completed',
                             progress_restaurants_found=restaurants_found)
        print(json.dumps({
            "processed": True,
            "job_id": job['id'],
            "status": "completed"
        }))
    except Exception as e:
        db.update_job_status(job['id'], 'failed', error_message=str(e))
        print(json.dumps({
            "processed": True,
            "job_id": job['id'],
            "status": "failed",
            "error": str(e)
        }))
`);

    lastProcessAt = new Date().toISOString();
    nextProcessAt = computeNextTime(lastProcessAt, processIntervalMs);
    if (result.processed) stats.jobs_processed++;
    console.log('[Scheduler] Process result:', result);
    return result;
  } catch (err) {
    stats.errors++;
    console.error('[Scheduler] Process error:', err.message);
    return { error: err.message };
  } finally {
    isProcessing = false;
  }
}

// ---- Interval management ----

function scheduleTimers() {
  clearTimers();
  if (!isEnabled) return;

  pollTimer = setInterval(pollChannels, pollIntervalMs);
  processTimer = setInterval(processQueue, processIntervalMs);

  nextPollAt = computeNextTime(lastPollAt, pollIntervalMs);
  nextProcessAt = computeNextTime(lastProcessAt, processIntervalMs);
}

function clearTimers() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (processTimer) { clearInterval(processTimer); processTimer = null; }
}

// ---- Public API ----

/**
 * Start the scheduler (built-in cron). Called automatically on server boot.
 */
function startScheduler(options = {}) {
  if (options.poll_interval_ms) pollIntervalMs = options.poll_interval_ms;
  if (options.process_interval_ms) processIntervalMs = options.process_interval_ms;

  if (isEnabled && pollTimer) return false; // already running

  isEnabled = true;
  scheduleTimers();

  // Kick off immediately
  pollChannels();
  processQueue();

  console.log(`[Scheduler] Started (poll every ${pollIntervalMs / 1000}s, process every ${processIntervalMs / 1000}s)`);
  return true;
}

/**
 * Stop the scheduler (disable auto-polling from admin).
 */
function stopScheduler() {
  if (!isEnabled) return false;

  isEnabled = false;
  clearTimers();
  nextPollAt = null;
  nextProcessAt = null;

  console.log('[Scheduler] Stopped by admin');
  return true;
}

/**
 * Update scheduler settings without full stop/start.
 */
function updateSettings(options = {}) {
  let changed = false;

  if (options.poll_interval_ms && options.poll_interval_ms !== pollIntervalMs) {
    pollIntervalMs = options.poll_interval_ms;
    changed = true;
  }
  if (options.process_interval_ms && options.process_interval_ms !== processIntervalMs) {
    processIntervalMs = options.process_interval_ms;
    changed = true;
  }
  if (typeof options.enabled === 'boolean' && options.enabled !== isEnabled) {
    isEnabled = options.enabled;
    changed = true;
  }

  // Restart timers with new intervals if running
  if (changed && isEnabled) {
    scheduleTimers();
  } else if (changed && !isEnabled) {
    clearTimers();
    nextPollAt = null;
    nextProcessAt = null;
  }

  return getSchedulerStatus();
}

/**
 * Return a snapshot of the current scheduler state.
 */
function getSchedulerStatus() {
  return {
    enabled: isEnabled,
    is_polling: isPolling,
    is_processing: isProcessing,
    poll_interval_ms: pollIntervalMs,
    process_interval_ms: processIntervalMs,
    last_poll_at: lastPollAt,
    last_process_at: lastProcessAt,
    next_poll_at: isEnabled ? nextPollAt : null,
    next_process_at: isEnabled ? nextProcessAt : null,
    stats: { ...stats }
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  updateSettings,
  getSchedulerStatus,
  pollChannels,
  processQueue
};
