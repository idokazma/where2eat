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
 * GET /api/admin/queue
 * List jobs with optional status filter and pagination.
 * Query: ?status=pending&limit=50&offset=0
 */
router.get('/', async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;

  const statusFilter = status ? `status='${status}'` : 'True';

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()

with db.get_connection() as conn:
    cursor = conn.cursor()
    where = "WHERE status = '${status}'" if '${status}' else ''
    cursor.execute(
        f'SELECT * FROM jobs {where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}'
    )
    jobs = [dict(row) for row in cursor.fetchall()]

    cursor.execute(f'SELECT COUNT(*) as total FROM jobs {where}')
    total = cursor.fetchone()['total']

print(json.dumps({"jobs": jobs, "total": total, "limit": ${limit}, "offset": ${offset}}))
`);
    res.json(result);
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({ error: 'Failed to list jobs', details: error.message });
  }
});

/**
 * GET /api/admin/queue/stats
 * Return counts per status, average processing time, and recent error rate.
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()

with db.get_connection() as conn:
    cursor = conn.cursor()

    # Counts per status
    cursor.execute('SELECT status, COUNT(*) as count FROM jobs GROUP BY status')
    status_counts = {row['status']: row['count'] for row in cursor.fetchall()}

    # Average processing time for completed jobs (seconds)
    cursor.execute("""
        SELECT AVG(
            (julianday(completed_at) - julianday(started_at)) * 86400
        ) as avg_seconds
        FROM jobs
        WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
    """)
    avg_row = cursor.fetchone()
    avg_processing_seconds = round(avg_row['avg_seconds'] or 0, 2)

    # Error rate in last 24 hours
    cursor.execute("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM jobs
        WHERE created_at >= datetime('now', '-24 hours')
    """)
    rate_row = cursor.fetchone()
    total_24h = rate_row['total'] or 0
    failed_24h = rate_row['failed'] or 0
    error_rate_24h = round(failed_24h / total_24h * 100, 1) if total_24h > 0 else 0.0

print(json.dumps({
    "status_counts": status_counts,
    "avg_processing_seconds": avg_processing_seconds,
    "last_24h": {
        "total": total_24h,
        "failed": failed_24h,
        "error_rate_percent": error_rate_24h
    }
}))
`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    res.status(500).json({ error: 'Failed to fetch queue stats', details: error.message });
  }
});

/**
 * POST /api/admin/queue/process
 * Dequeue the next pending job and run the full analysis pipeline.
 * The job is processed synchronously in a spawned Python process; the HTTP
 * response is returned immediately with the job ID and final status once the
 * Python process completes.
 */
router.post('/process', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
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
            "status": "completed",
            "restaurants_found": restaurants_found
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
    res.json(result);
  } catch (error) {
    console.error('Error processing queue item:', error);
    res.status(500).json({ error: 'Failed to process queue item', details: error.message });
  }
});

/**
 * GET /api/admin/queue/:id
 * Get full details for a single job.
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await runPython(`
import sys, os, json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')
from database import Database
db = Database()

with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM jobs WHERE id = ?', ('${id}',))
    row = cursor.fetchone()
    if row:
        print(json.dumps(dict(row)))
    else:
        print(json.dumps({"error": "Job not found"}))
`);

    if (result && result.error) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job', details: error.message });
  }
});

/**
 * DELETE /api/admin/queue/:id
 * Cancel or delete a job (admin only).
 * Pending/failed jobs are deleted outright; processing jobs are marked cancelled.
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

with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT id, status FROM jobs WHERE id = ?', ('${id}',))
    row = cursor.fetchone()

    if not row:
        print(json.dumps({"error": "Job not found"}))
    elif row['status'] == 'processing':
        # Cannot hard-delete an in-progress job - mark it cancelled instead
        cursor.execute("UPDATE jobs SET status = 'cancelled' WHERE id = ?", ('${id}',))
        conn.commit()
        print(json.dumps({"success": True, "action": "cancelled", "id": "${id}"}))
    else:
        cursor.execute('DELETE FROM jobs WHERE id = ?', ('${id}',))
        conn.commit()
        print(json.dumps({"success": True, "action": "deleted", "id": "${id}"}))
`);

    if (result && result.error) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job', details: error.message });
  }
});

module.exports = router;
