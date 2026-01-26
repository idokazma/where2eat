/**
 * Database utility for Express API
 * Bridges Node.js API calls to Python SQLite database via api_db_bridge.py
 */

const { spawn } = require('child_process')
const path = require('path')

const BRIDGE_SCRIPT = path.join(__dirname, '../../scripts/api_db_bridge.py')
const PYTHON_PATH = process.env.PYTHON_PATH || 'python'

/**
 * Call the Python database bridge with a method and arguments
 * @param {string} method - The method name to call
 * @param {object} args - Arguments to pass to the method
 * @returns {Promise<object>} - The result from the database
 */
async function callBridge(method, args = {}) {
  return new Promise((resolve, reject) => {
    const argsJson = JSON.stringify(args)
    const python = spawn(PYTHON_PATH, [BRIDGE_SCRIPT, method, argsJson])

    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    python.on('close', (code) => {
      if (code !== 0) {
        console.error(`Database bridge error (${method}):`, stderr)
        reject(new Error(`Database bridge failed: ${stderr || 'Unknown error'}`))
        return
      }

      try {
        const result = JSON.parse(stdout)
        if (!result.success) {
          reject(new Error(result.error || 'Unknown database error'))
          return
        }
        resolve(result)
      } catch (e) {
        console.error('Failed to parse database response:', stdout)
        reject(new Error('Invalid JSON response from database'))
      }
    })

    python.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`))
    })
  })
}

// ==================== Restaurant Operations ====================

/**
 * Get all restaurants
 * @returns {Promise<{restaurants: Array, count: number}>}
 */
async function getAllRestaurants() {
  const result = await callBridge('get_all_restaurants')
  return { restaurants: result.restaurants, count: result.count }
}

/**
 * Search restaurants with filters
 * @param {object} params - Search parameters
 * @returns {Promise<{restaurants: Array, analytics: object}>}
 */
async function searchRestaurants(params = {}) {
  const result = await callBridge('search_restaurants', params)
  return {
    restaurants: result.restaurants,
    analytics: result.analytics
  }
}

/**
 * Get a single restaurant by ID
 * @param {string} restaurantId
 * @returns {Promise<object>}
 */
async function getRestaurant(restaurantId) {
  const result = await callBridge('get_restaurant', { restaurant_id: restaurantId })
  return result.restaurant
}

/**
 * Create a new restaurant
 * @param {object} data - Restaurant data
 * @returns {Promise<string>} - Restaurant ID
 */
async function createRestaurant(data) {
  const result = await callBridge('create_restaurant', data)
  return result.restaurant_id
}

/**
 * Update a restaurant
 * @param {string} restaurantId
 * @param {object} data - Updated fields
 * @returns {Promise<boolean>}
 */
async function updateRestaurant(restaurantId, data) {
  const result = await callBridge('update_restaurant', { restaurant_id: restaurantId, ...data })
  return result.success
}

/**
 * Delete a restaurant
 * @param {string} restaurantId
 * @returns {Promise<boolean>}
 */
async function deleteRestaurant(restaurantId) {
  const result = await callBridge('delete_restaurant', { restaurant_id: restaurantId })
  return result.success
}

// ==================== Episode Operations ====================

/**
 * Get all episodes
 * @returns {Promise<{episodes: Array, count: number}>}
 */
async function getAllEpisodes() {
  const result = await callBridge('get_all_episodes')
  return { episodes: result.episodes, count: result.count }
}

/**
 * Get a single episode
 * @param {string} episodeId - Episode ID or video ID
 * @param {boolean} byVideoId - If true, search by video_id instead of id
 * @returns {Promise<object>}
 */
async function getEpisode(episodeId, byVideoId = false) {
  const args = byVideoId ? { video_id: episodeId } : { episode_id: episodeId }
  const result = await callBridge('get_episode', args)
  return result.episode
}

/**
 * Search episodes with filters
 * @param {object} params - Search parameters
 * @returns {Promise<{episodes: Array, count: number}>}
 */
async function searchEpisodes(params = {}) {
  const result = await callBridge('search_episodes', params)
  return { episodes: result.episodes, count: result.count }
}

// ==================== Job Operations ====================

/**
 * Create a new job
 * @param {string} jobType - Type of job ('video', 'channel', 'batch')
 * @param {object} options - Job options
 * @returns {Promise<string>} - Job ID
 */
async function createJob(jobType, options = {}) {
  const result = await callBridge('create_job', { job_type: jobType, ...options })
  return result.job_id
}

/**
 * Get a job by ID
 * @param {string} jobId
 * @returns {Promise<object>}
 */
async function getJob(jobId) {
  const result = await callBridge('get_job', { job_id: jobId })
  return result.job
}

/**
 * Update job status
 * @param {string} jobId
 * @param {string} status - New status
 * @param {object} extras - Additional fields to update
 * @returns {Promise<boolean>}
 */
async function updateJobStatus(jobId, status, extras = {}) {
  const result = await callBridge('update_job_status', { job_id: jobId, status, ...extras })
  return result.success
}

/**
 * Update job progress
 * @param {string} jobId
 * @param {object} progress - Progress fields
 * @returns {Promise<boolean>}
 */
async function updateJobProgress(jobId, progress) {
  const result = await callBridge('update_job_progress', { job_id: jobId, ...progress })
  return result.success
}

/**
 * List all jobs with optional status filter
 * @param {string} status - Optional status filter
 * @returns {Promise<{jobs: Array, count: number}>}
 */
async function listJobs(status = null) {
  const args = status ? { status } : {}
  const result = await callBridge('list_jobs', args)
  return { jobs: result.jobs, count: result.count }
}

/**
 * Cancel a job
 * @param {string} jobId
 * @returns {Promise<boolean>}
 */
async function cancelJob(jobId) {
  const result = await callBridge('cancel_job', { job_id: jobId })
  return result.success
}

// ==================== Analytics Operations ====================

/**
 * Get timeline analytics
 * @param {object} params - Date range parameters
 * @returns {Promise<{timeline: Array, total_restaurants: number}>}
 */
async function getTimelineAnalytics(params = {}) {
  const result = await callBridge('get_timeline_analytics', params)
  return { timeline: result.timeline, total_restaurants: result.total_restaurants }
}

/**
 * Get trends analytics
 * @param {object} params - Period parameters
 * @returns {Promise<object>}
 */
async function getTrendsAnalytics(params = {}) {
  const result = await callBridge('get_trends_analytics', params)
  return result.trends
}

/**
 * Get database statistics
 * @returns {Promise<object>}
 */
async function getStats() {
  const result = await callBridge('get_stats')
  return result.stats
}

// ==================== Edit History Operations ====================

/**
 * Log a restaurant edit
 * @param {object} params - Edit details
 * @returns {Promise<string>} - Log ID
 */
async function logEdit(params) {
  const result = await callBridge('log_edit', params)
  return result.log_id
}

/**
 * Get edit history
 * @param {object} params - Filter parameters
 * @returns {Promise<Array>}
 */
async function getEditHistory(params = {}) {
  const result = await callBridge('get_edit_history', params)
  return result.history
}

module.exports = {
  // Restaurant operations
  getAllRestaurants,
  searchRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,

  // Episode operations
  getAllEpisodes,
  getEpisode,
  searchEpisodes,

  // Job operations
  createJob,
  getJob,
  updateJobStatus,
  updateJobProgress,
  listJobs,
  cancelJob,

  // Analytics operations
  getTimelineAnalytics,
  getTrendsAnalytics,
  getStats,

  // Edit history
  logEdit,
  getEditHistory,

  // Low-level access
  callBridge
}
