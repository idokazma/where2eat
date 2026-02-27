const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/admin/subscriptions
 * List all subscriptions
 */
router.get('/', async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.subscription_manager import SubscriptionManager
manager = SubscriptionManager()
subscriptions = manager.list_subscriptions()
print(json.dumps({'subscriptions': subscriptions}))
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
          console.error('Failed to parse subscriptions output:', stdout);
          res.status(500).json({ error: 'Failed to parse subscriptions data' });
        }
      } else {
        console.error('Failed to list subscriptions:', stderr);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

/**
 * POST /api/admin/subscriptions
 * Add a new subscription
 * Requires: admin role or higher
 */
router.post('/', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { source_url, source_name, priority, check_interval_hours } = req.body;

    if (!source_url) {
      return res.status(400).json({ error: 'source_url is required' });
    }

    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.subscription_manager import SubscriptionManager
manager = SubscriptionManager()
result = manager.add_subscription(
    source_url=${JSON.stringify(source_url)},
    source_name=${source_name ? JSON.stringify(source_name) : 'None'},
    priority=${priority != null ? JSON.stringify(priority) : 'None'},
    check_interval_hours=${check_interval_hours != null ? JSON.stringify(check_interval_hours) : 'None'}
)
print(json.dumps({'subscription': result}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          res.status(201).json(result);
        } catch (err) {
          console.error('Failed to parse add subscription output:', stdout);
          res.status(500).json({ error: 'Failed to parse subscription data' });
        }
      } else {
        console.error('Failed to add subscription:', stderr);
        res.status(500).json({ error: 'Failed to add subscription' });
      }
    });
  } catch (error) {
    console.error('Error adding subscription:', error);
    res.status(500).json({ error: 'Failed to add subscription' });
  }
});

/**
 * GET /api/admin/subscriptions/:id
 * Get subscription details
 */
router.get('/:id', async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.subscription_manager import SubscriptionManager
manager = SubscriptionManager()
subscription = manager.get_subscription('${req.params.id}')
print(json.dumps({'subscription': subscription}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse subscription output:', stdout);
          res.status(500).json({ error: 'Failed to parse subscription data' });
        }
      } else {
        console.error('Failed to fetch subscription:', stderr);
        res.status(500).json({ error: 'Failed to fetch subscription' });
      }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription details' });
  }
});

/**
 * PUT /api/admin/subscriptions/:id
 * Update a subscription
 * Requires: admin role or higher
 */
router.put('/:id', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { priority, check_interval_hours, source_name } = req.body;

    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.subscription_manager import SubscriptionManager
manager = SubscriptionManager()
updates = {}
${priority != null ? `updates['priority'] = ${JSON.stringify(priority)}` : ''}
${check_interval_hours != null ? `updates['check_interval_hours'] = ${JSON.stringify(check_interval_hours)}` : ''}
${source_name ? `updates['source_name'] = ${JSON.stringify(source_name)}` : ''}
result = manager.update_subscription('${req.params.id}', **updates)
print(json.dumps({'subscription': result}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse update subscription output:', stdout);
          res.status(500).json({ error: 'Failed to parse subscription data' });
        }
      } else {
        console.error('Failed to update subscription:', stderr);
        res.status(500).json({ error: 'Failed to update subscription' });
      }
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * DELETE /api/admin/subscriptions/:id
 * Delete a subscription
 * Requires: super_admin role
 */
router.delete('/:id', requireRole(['super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.subscription_manager import SubscriptionManager
manager = SubscriptionManager()
result = manager.delete_subscription('${req.params.id}')
print(json.dumps({'success': result}))
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
            return res.status(404).json({ error: 'Subscription not found' });
          }
          res.json({ message: 'Subscription deleted successfully' });
        } catch (err) {
          console.error('Failed to parse delete subscription output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to delete subscription:', stderr);
        res.status(500).json({ error: 'Failed to delete subscription' });
      }
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

/**
 * POST /api/admin/subscriptions/:id/pause
 * Pause a subscription
 * Requires: admin role or higher
 */
router.post('/:id/pause', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.subscription_manager import SubscriptionManager
manager = SubscriptionManager()
result = manager.pause_subscription('${req.params.id}')
print(json.dumps({'subscription': result}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
          }
          res.json({ message: 'Subscription paused successfully', ...result });
        } catch (err) {
          console.error('Failed to parse pause subscription output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to pause subscription:', stderr);
        res.status(500).json({ error: 'Failed to pause subscription' });
      }
    });
  } catch (error) {
    console.error('Error pausing subscription:', error);
    res.status(500).json({ error: 'Failed to pause subscription' });
  }
});

/**
 * POST /api/admin/subscriptions/:id/resume
 * Resume a paused subscription
 * Requires: admin role or higher
 */
router.post('/:id/resume', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.subscription_manager import SubscriptionManager
manager = SubscriptionManager()
result = manager.resume_subscription('${req.params.id}')
print(json.dumps({'subscription': result}))
    `]);

    let stdout = '';
    let stderr = '';
    python.stdout.on('data', (data) => stdout += data);
    python.stderr.on('data', (data) => stderr += data);
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          if (!result.subscription) {
            return res.status(404).json({ error: 'Subscription not found' });
          }
          res.json({ message: 'Subscription resumed successfully', ...result });
        } catch (err) {
          console.error('Failed to parse resume subscription output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to resume subscription:', stderr);
        res.status(500).json({ error: 'Failed to resume subscription' });
      }
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    res.status(500).json({ error: 'Failed to resume subscription' });
  }
});

/**
 * POST /api/admin/subscriptions/:id/check
 * Trigger immediate poll for a subscription
 * Requires: admin role or higher
 */
router.post('/:id/check', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
from src.pipeline_scheduler import PipelineScheduler
from src.database import Database
scheduler = PipelineScheduler()
sub = scheduler.sub_manager.get_subscription('${req.params.id}')
if sub:
    videos = scheduler._fetch_channel_videos(sub)
    print(json.dumps({
        'success': True,
        'subscription_id': '${req.params.id}',
        'videos_found': len(videos) if videos else 0,
        'videos': videos[:10] if videos else []
    }))
else:
    print(json.dumps({'success': False, 'error': 'Subscription not found'}))
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
            return res.status(404).json({ error: result.error || 'Subscription not found' });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse check subscription output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to check subscription:', stderr);
        res.status(500).json({ error: 'Failed to trigger subscription check' });
      }
    });
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: 'Failed to trigger subscription check' });
  }
});

/**
 * POST /api/admin/subscriptions/:id/refresh
 * Refresh a subscription: fetch latest videos, queue new ones, skip old ones.
 * Fetches the N most recent videos, skips already-processed ones, queues the rest.
 * Requires: admin role or higher
 */
router.post('/:id/refresh', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const python = spawn('python', ['-c', `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '..', '..')}')
sys.path.insert(0, '${path.join(__dirname, '..', '..', 'src')}')
from pipeline_scheduler import PipelineScheduler
scheduler = PipelineScheduler()
try:
    result = scheduler.refresh_subscription('${subscriptionId}')
    print(json.dumps({'success': True, **result}))
except ValueError as e:
    print(json.dumps({'success': False, 'error': str(e)}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
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
            const status = result.error && result.error.includes('not found') ? 404 : 500;
            return res.status(status).json({ error: result.error });
          }
          res.json(result);
        } catch (err) {
          console.error('Failed to parse refresh subscription output:', stdout);
          res.status(500).json({ error: 'Failed to parse response' });
        }
      } else {
        console.error('Failed to refresh subscription:', stderr);
        res.status(500).json({ error: 'Failed to refresh subscription' });
      }
    });
  } catch (error) {
    console.error('Error refreshing subscription:', error);
    res.status(500).json({ error: 'Failed to refresh subscription' });
  }
});

module.exports = router;
