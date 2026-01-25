const { query, transaction } = require('../index')

const restaurantRepository = {
  /**
   * Find all restaurants with optional filters
   */
  async findAll(filters = {}) {
    let sql = 'SELECT * FROM restaurants WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (filters.city) {
      sql += ` AND city ILIKE $${paramIndex++}`
      params.push(`%${filters.city}%`)
    }

    if (filters.cuisine) {
      sql += ` AND cuisine_type ILIKE $${paramIndex++}`
      params.push(`%${filters.cuisine}%`)
    }

    if (filters.minRating) {
      sql += ` AND google_rating >= $${paramIndex++}`
      params.push(filters.minRating)
    }

    if (filters.status) {
      sql += ` AND status = $${paramIndex++}`
      params.push(filters.status)
    }

    if (filters.hostOpinion) {
      sql += ` AND host_opinion = $${paramIndex++}`
      params.push(filters.hostOpinion)
    }

    if (filters.priceRange) {
      sql += ` AND price_range = $${paramIndex++}`
      params.push(filters.priceRange)
    }

    if (filters.videoId) {
      sql += ` AND source_video_id = $${paramIndex++}`
      params.push(filters.videoId)
    }

    if (filters.dateStart) {
      sql += ` AND analysis_date >= $${paramIndex++}`
      params.push(filters.dateStart)
    }

    if (filters.dateEnd) {
      sql += ` AND analysis_date <= $${paramIndex++}`
      params.push(filters.dateEnd)
    }

    // Sorting
    const sortBy = filters.sortBy || 'created_at'
    const sortDir = filters.sortDirection === 'asc' ? 'ASC' : 'DESC'
    const validSortColumns = ['created_at', 'analysis_date', 'name_hebrew', 'city', 'cuisine_type', 'google_rating']
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
    sql += ` ORDER BY ${sortColumn} ${sortDir}`

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
    return result.rows.map(this._formatRestaurant)
  },

  /**
   * Count restaurants matching filters
   */
  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) as count FROM restaurants WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (filters.city) {
      sql += ` AND city ILIKE $${paramIndex++}`
      params.push(`%${filters.city}%`)
    }

    if (filters.cuisine) {
      sql += ` AND cuisine_type ILIKE $${paramIndex++}`
      params.push(`%${filters.cuisine}%`)
    }

    if (filters.status) {
      sql += ` AND status = $${paramIndex++}`
      params.push(filters.status)
    }

    const result = await query(sql, params)
    return parseInt(result.rows[0].count)
  },

  /**
   * Find restaurant by ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM restaurants WHERE id = $1',
      [id]
    )
    return result.rows[0] ? this._formatRestaurant(result.rows[0]) : null
  },

  /**
   * Find restaurants by video ID
   */
  async findByVideoId(videoId) {
    const result = await query(
      'SELECT * FROM restaurants WHERE source_video_id = $1 ORDER BY created_at DESC',
      [videoId]
    )
    return result.rows.map(this._formatRestaurant)
  },

  /**
   * Create a new restaurant
   */
  async create(restaurant) {
    const result = await query(
      `INSERT INTO restaurants
       (name_hebrew, name_english, address, city, region,
        latitude, longitude, cuisine_type, price_range, status,
        google_place_id, google_maps_url, google_rating, google_user_ratings_total,
        phone, website, opening_hours, photos, source_video_id,
        host_opinion, recommendation_context, recommendation_sentiment,
        mentioned_dishes, specific_recommendations, analysis_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
       RETURNING *`,
      [
        restaurant.name_hebrew || restaurant.name,
        restaurant.name_english,
        restaurant.address,
        restaurant.city || this._extractCity(restaurant.address),
        restaurant.region,
        restaurant.latitude || restaurant.location?.lat,
        restaurant.longitude || restaurant.location?.lng,
        restaurant.cuisine_type,
        restaurant.price_range,
        restaurant.status || 'active',
        restaurant.google_place_id,
        restaurant.google_maps_url,
        restaurant.google_rating || restaurant.rating?.google_rating,
        restaurant.google_user_ratings_total || restaurant.rating?.google_user_ratings_total,
        restaurant.phone,
        restaurant.website,
        JSON.stringify(restaurant.opening_hours || {}),
        JSON.stringify(restaurant.photos || []),
        restaurant.source_video_id || restaurant.episode_info?.video_id,
        restaurant.host_opinion,
        restaurant.recommendation_context,
        restaurant.recommendation_sentiment,
        JSON.stringify(restaurant.mentioned_dishes || []),
        JSON.stringify(restaurant.specific_recommendations || []),
        restaurant.analysis_date || restaurant.episode_info?.analysis_date || new Date()
      ]
    )
    return this._formatRestaurant(result.rows[0])
  },

  /**
   * Update a restaurant
   */
  async update(id, updates) {
    const allowedFields = [
      'name_hebrew', 'name_english', 'address', 'city', 'region',
      'latitude', 'longitude', 'cuisine_type', 'price_range', 'status',
      'google_place_id', 'google_maps_url', 'google_rating', 'google_user_ratings_total',
      'phone', 'website', 'opening_hours', 'photos',
      'host_opinion', 'recommendation_context', 'recommendation_sentiment',
      'mentioned_dishes', 'specific_recommendations'
    ]

    const fields = []
    const values = []
    let paramIndex = 2

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramIndex++}`)
        // Stringify JSON fields
        if (['opening_hours', 'photos', 'mentioned_dishes', 'specific_recommendations'].includes(key)) {
          values.push(JSON.stringify(value))
        } else {
          values.push(value)
        }
      }
    }

    if (fields.length === 0) {
      return this.findById(id)
    }

    const sql = `UPDATE restaurants SET ${fields.join(', ')} WHERE id = $1 RETURNING *`
    const result = await query(sql, [id, ...values])
    return result.rows[0] ? this._formatRestaurant(result.rows[0]) : null
  },

  /**
   * Delete a restaurant
   */
  async delete(id) {
    const result = await query(
      'DELETE FROM restaurants WHERE id = $1 RETURNING id',
      [id]
    )
    return result.rowCount > 0
  },

  /**
   * Find restaurants near a location
   */
  async findNearby(lat, lng, radiusKm = 5, limit = 50) {
    const result = await query(
      `SELECT *,
        (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        )) AS distance
       FROM restaurants
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       AND (6371 * acos(
          cos(radians($1)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) * sin(radians(latitude))
        )) < $3
       ORDER BY distance
       LIMIT $4`,
      [lat, lng, radiusKm, limit]
    )
    return result.rows.map(row => ({
      ...this._formatRestaurant(row),
      distance: parseFloat(row.distance.toFixed(2))
    }))
  },

  /**
   * Get analytics data
   */
  async getAnalytics() {
    const [cuisineResult, cityResult, opinionResult, priceResult] = await Promise.all([
      query(`SELECT cuisine_type, COUNT(*) as count FROM restaurants
             WHERE cuisine_type IS NOT NULL
             GROUP BY cuisine_type ORDER BY count DESC LIMIT 20`),
      query(`SELECT city, COUNT(*) as count FROM restaurants
             WHERE city IS NOT NULL
             GROUP BY city ORDER BY count DESC LIMIT 20`),
      query(`SELECT host_opinion, COUNT(*) as count FROM restaurants
             WHERE host_opinion IS NOT NULL
             GROUP BY host_opinion ORDER BY count DESC`),
      query(`SELECT price_range, COUNT(*) as count FROM restaurants
             WHERE price_range IS NOT NULL
             GROUP BY price_range ORDER BY count DESC`)
    ])

    return {
      cuisineDistribution: Object.fromEntries(
        cuisineResult.rows.map(r => [r.cuisine_type, parseInt(r.count)])
      ),
      locationDistribution: Object.fromEntries(
        cityResult.rows.map(r => [r.city, parseInt(r.count)])
      ),
      opinionDistribution: Object.fromEntries(
        opinionResult.rows.map(r => [r.host_opinion, parseInt(r.count)])
      ),
      priceDistribution: Object.fromEntries(
        priceResult.rows.map(r => [r.price_range, parseInt(r.count)])
      )
    }
  },

  /**
   * Get date distribution for timeline
   */
  async getDateDistribution(filters = {}) {
    let sql = `SELECT DATE(analysis_date) as date, COUNT(*) as count
               FROM restaurants WHERE analysis_date IS NOT NULL`
    const params = []
    let paramIndex = 1

    if (filters.dateStart) {
      sql += ` AND analysis_date >= $${paramIndex++}`
      params.push(filters.dateStart)
    }

    if (filters.dateEnd) {
      sql += ` AND analysis_date <= $${paramIndex++}`
      params.push(filters.dateEnd)
    }

    sql += ' GROUP BY DATE(analysis_date) ORDER BY date DESC'

    const result = await query(sql, params)
    return Object.fromEntries(
      result.rows.map(r => [r.date.toISOString().split('T')[0], parseInt(r.count)])
    )
  },

  /**
   * Bulk create restaurants (for migration)
   */
  async bulkCreate(restaurants) {
    return transaction(async (client) => {
      const results = []
      for (const restaurant of restaurants) {
        const result = await client.query(
          `INSERT INTO restaurants
           (name_hebrew, name_english, address, city, region,
            latitude, longitude, cuisine_type, price_range, status,
            google_place_id, google_maps_url, google_rating, google_user_ratings_total,
            phone, website, opening_hours, photos, source_video_id,
            host_opinion, recommendation_context, recommendation_sentiment,
            mentioned_dishes, specific_recommendations, analysis_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            restaurant.name_hebrew || restaurant.name,
            restaurant.name_english,
            restaurant.address,
            restaurant.city || this._extractCity(restaurant.address),
            restaurant.region,
            restaurant.latitude || restaurant.location?.lat,
            restaurant.longitude || restaurant.location?.lng,
            restaurant.cuisine_type,
            restaurant.price_range,
            restaurant.status || 'active',
            restaurant.google_place_id,
            restaurant.google_maps_url,
            restaurant.google_rating || restaurant.rating?.google_rating,
            restaurant.google_user_ratings_total || restaurant.rating?.google_user_ratings_total,
            restaurant.phone,
            restaurant.website,
            JSON.stringify(restaurant.opening_hours || {}),
            JSON.stringify(restaurant.photos || []),
            restaurant.source_video_id || restaurant.episode_info?.video_id,
            restaurant.host_opinion,
            restaurant.recommendation_context,
            restaurant.recommendation_sentiment,
            JSON.stringify(restaurant.mentioned_dishes || []),
            JSON.stringify(restaurant.specific_recommendations || []),
            restaurant.analysis_date || restaurant.episode_info?.analysis_date || new Date()
          ]
        )
        if (result.rows[0]) {
          results.push(result.rows[0])
        }
      }
      return results.length
    })
  },

  /**
   * Format a database row to the expected restaurant format
   */
  _formatRestaurant(row) {
    if (!row) return null

    return {
      id: row.id,
      name_hebrew: row.name_hebrew,
      name_english: row.name_english,
      address: row.address,
      city: row.city,
      location: {
        city: row.city,
        region: row.region,
        lat: row.latitude ? parseFloat(row.latitude) : null,
        lng: row.longitude ? parseFloat(row.longitude) : null
      },
      cuisine_type: row.cuisine_type,
      price_range: row.price_range,
      status: row.status,
      google_place_id: row.google_place_id,
      google_maps_url: row.google_maps_url,
      rating: {
        google_rating: row.google_rating ? parseFloat(row.google_rating) : null,
        google_user_ratings_total: row.google_user_ratings_total
      },
      phone: row.phone,
      website: row.website,
      opening_hours: row.opening_hours,
      photos: row.photos || [],
      host_opinion: row.host_opinion,
      recommendation_context: row.recommendation_context,
      recommendation_sentiment: row.recommendation_sentiment,
      mentioned_dishes: row.mentioned_dishes || [],
      specific_recommendations: row.specific_recommendations || [],
      episode_info: row.source_video_id ? {
        video_id: row.source_video_id,
        video_url: `https://www.youtube.com/watch?v=${row.source_video_id}`,
        analysis_date: row.analysis_date
      } : null,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  },

  /**
   * Extract city from address
   */
  _extractCity(address) {
    if (!address) return null
    const parts = address.split(',')
    return parts.length > 1 ? parts[parts.length - 2].trim() : null
  }
}

module.exports = restaurantRepository
