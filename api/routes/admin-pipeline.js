const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  getSchedulerStatus,
  startScheduler,
  stopScheduler,
  updateSettings,
  pollChannels,
  processQueue
} = require('../scheduler');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/admin/pipeline/status
 * Full scheduler status: enabled, intervals, last/next poll times, stats.
 */
router.get('/status', (req, res) => {
  try {
    res.json(getSchedulerStatus());
  } catch (error) {
    console.error('Error fetching pipeline status:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline status' });
  }
});

/**
 * POST /api/admin/pipeline/start
 * Enable the scheduler (admin+).
 */
router.post('/start', requireRole(['admin', 'super_admin']), (req, res) => {
  try {
    const { poll_interval_ms, process_interval_ms } = req.body || {};
    const started = startScheduler({ poll_interval_ms, process_interval_ms });

    if (!started) {
      return res.status(409).json({
        error: 'Scheduler is already running',
        status: getSchedulerStatus()
      });
    }

    console.log(`[Pipeline] Scheduler started by user ${req.user?.userId}`);
    res.json({ message: 'Scheduler started', status: getSchedulerStatus() });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({ error: 'Failed to start scheduler' });
  }
});

/**
 * POST /api/admin/pipeline/stop
 * Disable the scheduler (admin+). Stops auto-polling but manual poll still works.
 */
router.post('/stop', requireRole(['admin', 'super_admin']), (req, res) => {
  try {
    const stopped = stopScheduler();

    if (!stopped) {
      return res.status(409).json({
        error: 'Scheduler is not running',
        status: getSchedulerStatus()
      });
    }

    console.log(`[Pipeline] Scheduler stopped by user ${req.user?.userId}`);
    res.json({ message: 'Scheduler stopped', status: getSchedulerStatus() });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({ error: 'Failed to stop scheduler' });
  }
});

/**
 * PUT /api/admin/pipeline/settings
 * Update scheduler settings: poll_interval_ms, process_interval_ms, enabled.
 */
router.put('/settings', requireRole(['admin', 'super_admin']), (req, res) => {
  try {
    const { poll_interval_ms, process_interval_ms, enabled } = req.body || {};
    const status = updateSettings({ poll_interval_ms, process_interval_ms, enabled });

    console.log(`[Pipeline] Settings updated by user ${req.user?.userId}:`, req.body);
    res.json({ message: 'Settings updated', status });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * POST /api/admin/pipeline/poll-now
 * Force an immediate poll of all due channels (editor+).
 */
router.post('/poll-now', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  try {
    console.log(`[Pipeline] Manual poll triggered by user ${req.user?.userId}`);
    const result = await pollChannels();
    res.json({ message: 'Poll completed', result, status: getSchedulerStatus() });
  } catch (error) {
    console.error('Error in manual poll:', error);
    res.status(500).json({ error: 'Poll failed' });
  }
});

/**
 * POST /api/admin/pipeline/process-now
 * Force processing of the next queued job (editor+).
 */
router.post('/process-now', requireRole(['editor', 'admin', 'super_admin']), async (req, res) => {
  try {
    console.log(`[Pipeline] Manual process triggered by user ${req.user?.userId}`);
    const result = await processQueue();
    res.json({ message: 'Process completed', result, status: getSchedulerStatus() });
  } catch (error) {
    console.error('Error in manual process:', error);
    res.status(500).json({ error: 'Process failed' });
  }
});

module.exports = router;
