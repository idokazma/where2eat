const { query } = require('../index')

const jobRepository = {
  /**
   * Create a new job
   */
  async create(jobType, inputData = {}) {
    const result = await query(
      `INSERT INTO jobs (job_type, input_data, status, started_at)
       VALUES ($1, $2, 'running', CURRENT_TIMESTAMP)
       RETURNING *`,
      [jobType, JSON.stringify(inputData)]
    )
    return this._formatJob(result.rows[0])
  },

  /**
   * Find job by ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM jobs WHERE id = $1',
      [id]
    )
    return result.rows[0] ? this._formatJob(result.rows[0]) : null
  },

  /**
   * Find all jobs with optional filters
   */
  async findAll(filters = {}) {
    let sql = 'SELECT * FROM jobs WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (filters.status) {
      sql += ` AND status = $${paramIndex++}`
      params.push(filters.status)
    }

    if (filters.jobType) {
      sql += ` AND job_type = $${paramIndex++}`
      params.push(filters.jobType)
    }

    sql += ' ORDER BY created_at DESC'

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex++}`
      params.push(filters.limit)
    }

    const result = await query(sql, params)
    return result.rows.map(this._formatJob)
  },

  /**
   * Update job progress
   */
  async updateProgress(id, progress, progressDetails = null) {
    const result = await query(
      `UPDATE jobs
       SET progress = $2, progress_details = $3
       WHERE id = $1
       RETURNING *`,
      [id, progress, progressDetails ? JSON.stringify(progressDetails) : null]
    )
    return result.rows[0] ? this._formatJob(result.rows[0]) : null
  },

  /**
   * Mark job as completed
   */
  async complete(id, resultData = {}) {
    const result = await query(
      `UPDATE jobs
       SET status = 'completed',
           progress = 100,
           result_data = $2,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(resultData)]
    )
    return result.rows[0] ? this._formatJob(result.rows[0]) : null
  },

  /**
   * Mark job as failed
   */
  async fail(id, errorMessage) {
    const result = await query(
      `UPDATE jobs
       SET status = 'failed',
           error_message = $2,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, errorMessage]
    )
    return result.rows[0] ? this._formatJob(result.rows[0]) : null
  },

  /**
   * Cancel a job
   */
  async cancel(id) {
    const result = await query(
      `UPDATE jobs
       SET status = 'cancelled',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'running'
       RETURNING *`,
      [id]
    )
    return result.rows[0] ? this._formatJob(result.rows[0]) : null
  },

  /**
   * Get active jobs count
   */
  async getActiveCount() {
    const result = await query(
      "SELECT COUNT(*) as count FROM jobs WHERE status = 'running'"
    )
    return parseInt(result.rows[0].count)
  },

  /**
   * Get job statistics
   */
  async getStats() {
    const result = await query(`
      SELECT
        job_type,
        status,
        COUNT(*) as count,
        AVG(progress) as avg_progress,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
      FROM jobs
      GROUP BY job_type, status
      ORDER BY job_type, status
    `)

    const stats = {}
    for (const row of result.rows) {
      if (!stats[row.job_type]) {
        stats[row.job_type] = {}
      }
      stats[row.job_type][row.status] = {
        count: parseInt(row.count),
        avgProgress: row.avg_progress ? parseFloat(row.avg_progress) : null,
        avgDurationSeconds: row.avg_duration_seconds ? parseFloat(row.avg_duration_seconds) : null
      }
    }
    return stats
  },

  /**
   * Clean up old completed jobs
   */
  async cleanup(daysOld = 30) {
    const result = await query(
      `DELETE FROM jobs
       WHERE status IN ('completed', 'failed', 'cancelled')
       AND completed_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysOld]
    )
    return result.rowCount
  },

  /**
   * Format job for response
   */
  _formatJob(row) {
    if (!row) return null

    return {
      id: row.id,
      job_id: row.id, // Alias for compatibility
      job_type: row.job_type,
      status: row.status,
      progress: row.progress,
      progress_details: row.progress_details,
      input_data: row.input_data,
      result_data: row.result_data,
      error_message: row.error_message,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at
    }
  }
}

module.exports = jobRepository
