const { query, transaction } = require('../index')

const episodeRepository = {
  /**
   * Find all episodes with optional filters
   */
  async findAll(filters = {}) {
    let sql = 'SELECT * FROM episodes WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (filters.status) {
      sql += ` AND status = $${paramIndex++}`
      params.push(filters.status)
    }

    if (filters.channelId) {
      sql += ` AND channel_id = $${paramIndex++}`
      params.push(filters.channelId)
    }

    if (filters.dateStart) {
      sql += ` AND analyzed_at >= $${paramIndex++}`
      params.push(filters.dateStart)
    }

    if (filters.dateEnd) {
      sql += ` AND analyzed_at <= $${paramIndex++}`
      params.push(filters.dateEnd)
    }

    // Sorting
    const sortBy = filters.sortBy || 'analyzed_at'
    const sortDir = filters.sortDirection === 'asc' ? 'ASC' : 'DESC'
    const validSortColumns = ['analyzed_at', 'published_at', 'title', 'view_count']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'analyzed_at'
    sql += ` ORDER BY ${sortColumn} ${sortDir} NULLS LAST`

    // Pagination
    if (filters.limit) {
      sql += ` LIMIT $${paramIndex++}`
      params.push(filters.limit)
    }

    if (filters.offset) {
      sql += ` OFFSET $${paramIndex++}`
      params.push(filters.offset)
    }

    const result = await query(sql, params)
    return result.rows
  },

  /**
   * Count episodes
   */
  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as count FROM episodes WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (filters.status) {
      sql += ` AND status = $${paramIndex++}`
      params.push(filters.status)
    }

    const result = await query(sql, params)
    return parseInt(result.rows[0].count)
  },

  /**
   * Find episode by video ID
   */
  async findByVideoId(videoId) {
    const result = await query(
      'SELECT * FROM episodes WHERE video_id = $1',
      [videoId]
    )
    return result.rows[0] || null
  },

  /**
   * Find episode by ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM episodes WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  },

  /**
   * Create a new episode
   */
  async create(episode) {
    const result = await query(
      `INSERT INTO episodes
       (video_id, title, channel_name, channel_id, video_url,
        published_at, transcript, transcript_language,
        duration_seconds, view_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (video_id) DO UPDATE SET
         title = EXCLUDED.title,
         channel_name = EXCLUDED.channel_name,
         transcript = COALESCE(EXCLUDED.transcript, episodes.transcript),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        episode.video_id,
        episode.title,
        episode.channel_name,
        episode.channel_id,
        episode.video_url || `https://www.youtube.com/watch?v=${episode.video_id}`,
        episode.published_at,
        episode.transcript,
        episode.transcript_language,
        episode.duration_seconds,
        episode.view_count,
        episode.status || 'pending'
      ]
    )
    return result.rows[0]
  },

  /**
   * Update episode status
   */
  async updateStatus(videoId, status, analyzedAt = null) {
    const result = await query(
      `UPDATE episodes
       SET status = $2, analyzed_at = COALESCE($3, CURRENT_TIMESTAMP)
       WHERE video_id = $1
       RETURNING *`,
      [videoId, status, analyzedAt]
    )
    return result.rows[0]
  },

  /**
   * Update episode
   */
  async update(videoId, updates) {
    const allowedFields = [
      'title', 'channel_name', 'channel_id', 'video_url',
      'published_at', 'transcript', 'transcript_language',
      'duration_seconds', 'view_count', 'status', 'analyzed_at'
    ]

    const fields = []
    const values = []
    let paramIndex = 2

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex++}`)
        values.push(value)
      }
    }

    if (fields.length === 0) {
      return this.findByVideoId(videoId)
    }

    const sql = `UPDATE episodes SET ${fields.join(', ')} WHERE video_id = $1 RETURNING *`
    const result = await query(sql, [videoId, ...values])
    return result.rows[0]
  },

  /**
   * Delete episode
   */
  async delete(videoId) {
    const result = await query(
      'DELETE FROM episodes WHERE video_id = $1 RETURNING id',
      [videoId]
    )
    return result.rowCount > 0
  },

  /**
   * Check if episode exists and is already analyzed
   */
  async isAnalyzed(videoId) {
    const result = await query(
      "SELECT status FROM episodes WHERE video_id = $1 AND status = 'analyzed'",
      [videoId]
    )
    return result.rowCount > 0
  },

  /**
   * Get episodes with restaurant counts
   */
  async getWithRestaurantCounts(filters = {}) {
    let sql = `
      SELECT e.*,
        (SELECT COUNT(*) FROM restaurants r WHERE r.source_video_id = e.video_id) as restaurant_count
      FROM episodes e
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (filters.minRestaurants) {
      sql += ` AND (SELECT COUNT(*) FROM restaurants r WHERE r.source_video_id = e.video_id) >= $${paramIndex++}`
      params.push(filters.minRestaurants)
    }

    if (filters.dateStart) {
      sql += ` AND e.analyzed_at >= $${paramIndex++}`
      params.push(filters.dateStart)
    }

    if (filters.dateEnd) {
      sql += ` AND e.analyzed_at <= $${paramIndex++}`
      params.push(filters.dateEnd)
    }

    sql += ' ORDER BY e.analyzed_at DESC NULLS LAST'

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex++}`
      params.push(filters.limit)
    }

    const result = await query(sql, params)
    return result.rows.map(row => ({
      ...row,
      restaurant_count: parseInt(row.restaurant_count)
    }))
  },

  /**
   * Get channel statistics
   */
  async getChannelStats() {
    const result = await query(`
      SELECT
        channel_name,
        channel_id,
        COUNT(*) as episode_count,
        SUM(view_count) as total_views,
        COUNT(CASE WHEN status = 'analyzed' THEN 1 END) as analyzed_count,
        (SELECT COUNT(*) FROM restaurants r WHERE r.source_video_id IN
          (SELECT video_id FROM episodes e2 WHERE e2.channel_id = episodes.channel_id)
        ) as restaurant_count
      FROM episodes
      WHERE channel_id IS NOT NULL
      GROUP BY channel_name, channel_id
      ORDER BY episode_count DESC
    `)
    return result.rows
  }
}

module.exports = episodeRepository
