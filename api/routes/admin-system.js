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

/**
 * Execute a Python function and return the result
 */
function executePythonFunction(functionCall) {
  return new Promise((resolve, reject) => {
    const pythonPath = fs.existsSync(venvPython) ? venvPython : 'python3';

    const script = `
import sys
import os
import json
sys.path.insert(0, '${projectRoot}/src')
os.chdir('${projectRoot}')

from backend_service import get_backend_service
service = get_backend_service()
result = ${functionCall}
print(json.dumps(result))
`;

    const pythonProcess = spawn(pythonPath, ['-c', script], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: `${projectRoot}/src` }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python process exited with code ${code}`));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    pythonProcess.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * GET /api/admin/system/connections/status
 * Get status of all service connections
 */
router.get('/connections/status', async (req, res) => {
  try {
    const result = await executePythonFunction('service.test_all_connections()');
    res.json(result);
  } catch (error) {
    console.error('Error testing connections:', error);
    res.status(500).json({
      error: 'Failed to test connections',
      details: error.message
    });
  }
});

/**
 * POST /api/admin/system/connections/test
 * Test a specific service connection
 */
router.post('/connections/test', async (req, res) => {
  const { service } = req.body;

  if (!service) {
    return res.status(400).json({ error: 'Service name required' });
  }

  const validServices = ['database', 'youtube_transcript', 'google_places', 'claude_api', 'openai_api'];
  if (!validServices.includes(service)) {
    return res.status(400).json({
      error: 'Invalid service name',
      validServices
    });
  }

  const functionMap = {
    'database': 'service.test_database_connection()',
    'youtube_transcript': 'service.test_youtube_connection()',
    'google_places': 'service.test_google_places_connection()',
    'claude_api': 'service.test_claude_connection()',
    'openai_api': 'service.test_openai_connection()'
  };

  try {
    const result = await executePythonFunction(functionMap[service]);

    // Log the test result to database
    await executePythonFunction(`service.db.log_connection_test(
      service='${service}',
      status='${result.status}',
      response_time_ms=${result.response_time_ms},
      error_message=${result.details?.error ? `'${result.details.error.replace(/'/g, "\\'")}''` : 'None'},
      details=${JSON.stringify(result.details).replace(/'/g, "\\'")},
      tested_by='${req.user?.userId || ''}'
    )`).catch(err => console.warn('Failed to log connection test:', err.message));

    res.json(result);
  } catch (error) {
    console.error(`Error testing ${service} connection:`, error);
    res.status(500).json({
      service,
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/system/connections/history
 * Get connection test history
 */
router.get('/connections/history', async (req, res) => {
  const { service, limit = 100, hours = 24 } = req.query;

  try {
    const functionCall = service
      ? `service.db.get_connection_history(service='${service}', limit=${limit}, hours=${hours})`
      : `service.db.get_connection_history(limit=${limit}, hours=${hours})`;

    const result = await executePythonFunction(functionCall);
    res.json({ history: result });
  } catch (error) {
    console.error('Error fetching connection history:', error);
    res.status(500).json({ error: 'Failed to fetch connection history' });
  }
});

/**
 * GET /api/admin/system/api-keys/status
 * Get masked API key status (super_admin only)
 */
router.get('/api-keys/status', requireRole(['super_admin']), async (req, res) => {
  try {
    const result = await executePythonFunction('service.get_api_key_status()');
    res.json(result);
  } catch (error) {
    console.error('Error fetching API key status:', error);
    res.status(500).json({ error: 'Failed to fetch API key status' });
  }
});

/**
 * GET /api/admin/system/health
 * Get comprehensive system health
 */
router.get('/health', async (req, res) => {
  try {
    // Get Python backend health
    const backendHealth = await executePythonFunction('service.health_check()');

    // Add Node.js server info
    const serverHealth = {
      uptime_seconds: process.uptime(),
      uptime_formatted: formatUptime(process.uptime()),
      memory_usage: process.memoryUsage(),
      node_version: process.version,
      platform: process.platform
    };

    res.json({
      status: backendHealth.status,
      backend: backendHealth,
      server: serverHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      server: {
        uptime_seconds: process.uptime(),
        memory_usage: process.memoryUsage()
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/system/stats
 * Get database and system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await executePythonFunction('service.get_stats()');
    const metrics = await executePythonFunction('service.get_system_metrics()');

    res.json({
      database: stats,
      system: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

/**
 * GET /api/admin/system/metrics
 * Get historical system metrics
 */
router.get('/metrics', async (req, res) => {
  const { type, name, hours = 24, limit = 1000 } = req.query;

  try {
    let functionCall = 'service.db.get_metrics(';
    const params = [];
    if (type) params.push(`metric_type='${type}'`);
    if (name) params.push(`metric_name='${name}'`);
    params.push(`hours=${hours}`);
    params.push(`limit=${limit}`);
    functionCall += params.join(', ') + ')';

    const result = await executePythonFunction(functionCall);
    res.json({ metrics: result });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * POST /api/admin/system/maintenance/vacuum
 * Run database vacuum (super_admin only)
 */
router.post('/maintenance/vacuum', requireRole(['super_admin']), async (req, res) => {
  try {
    await executePythonFunction('service.db.conn.execute("VACUUM")');
    res.json({
      success: true,
      message: 'Database vacuum completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running vacuum:', error);
    res.status(500).json({ error: 'Failed to run vacuum' });
  }
});

/**
 * POST /api/admin/system/maintenance/clear-errors
 * Clear resolved errors (super_admin only)
 */
router.post('/maintenance/clear-errors', requireRole(['super_admin']), async (req, res) => {
  const { olderThanDays = 30 } = req.body;

  try {
    const result = await executePythonFunction(
      `service.db.clear_resolved_errors(older_than_days=${olderThanDays})`
    );
    res.json({
      success: true,
      deleted: result,
      message: `Cleared ${result} resolved errors older than ${olderThanDays} days`
    });
  } catch (error) {
    console.error('Error clearing errors:', error);
    res.status(500).json({ error: 'Failed to clear errors' });
  }
});

// ==================== Error Logging Routes ====================

/**
 * GET /api/admin/errors
 * Get error logs with filters
 */
router.get('/errors', async (req, res) => {
  const { level, service, resolved, limit = 100, offset = 0 } = req.query;

  try {
    const params = [];
    if (level) params.push(`level='${level}'`);
    if (service) params.push(`service='${service}'`);
    if (resolved !== undefined) params.push(`resolved=${resolved === 'true'}`);
    params.push(`limit=${limit}`);
    params.push(`offset=${offset}`);

    const functionCall = `service.db.get_errors(${params.join(', ')})`;
    const result = await executePythonFunction(functionCall);
    res.json(result);
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

/**
 * GET /api/admin/errors/summary
 * Get error summary statistics
 */
router.get('/errors/summary', async (req, res) => {
  const { hours = 24 } = req.query;

  try {
    const result = await executePythonFunction(`service.db.get_error_summary(hours=${hours})`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching error summary:', error);
    res.status(500).json({ error: 'Failed to fetch error summary' });
  }
});

/**
 * POST /api/admin/errors/:errorId/resolve
 * Mark an error as resolved
 */
router.post('/errors/:errorId/resolve', requireRole(['admin', 'super_admin']), async (req, res) => {
  const { errorId } = req.params;
  const { notes } = req.body;

  try {
    const notesParam = notes ? `'${notes.replace(/'/g, "\\'")}'` : 'None';
    const result = await executePythonFunction(
      `service.db.resolve_error('${errorId}', admin_user_id='${req.user.userId}', notes=${notesParam})`
    );

    if (result) {
      res.json({ success: true, message: 'Error marked as resolved' });
    } else {
      res.status(404).json({ error: 'Error not found' });
    }
  } catch (error) {
    console.error('Error resolving error:', error);
    res.status(500).json({ error: 'Failed to resolve error' });
  }
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

module.exports = router;
