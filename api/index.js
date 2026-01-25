const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config()

// Database imports
const { initializeDatabase, getHealth: getDbHealth, testConnection } = require('./db')
const { migrateOnStartup } = require('./db/migrate')
const restaurantRepository = require('./db/repositories/restaurantRepository')
const episodeRepository = require('./db/repositories/episodeRepository')
const jobRepository = require('./db/repositories/jobRepository')

const app = express()
const port = process.env.PORT || 3001

// Import admin routes
const adminAuthRoutes = require('./routes/admin-auth')
const adminRestaurantsRoutes = require('./routes/admin-restaurants')
const adminAnalyticsRoutes = require('./routes/admin-analytics')
const adminArticlesRoutes = require('./routes/admin-articles')
const adminVideosRoutes = require('./routes/admin-videos')
const adminBulkRoutes = require('./routes/admin-bulk')
const adminAuditRoutes = require('./routes/admin-audit')

app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://where2eat.vercel.app',
    'https://where2eat-delta.vercel.app',
  ],
  credentials: true
}))
app.use(morgan('combined'))
app.use(express.json())
app.use(cookieParser())

const dataDir = path.join(__dirname, '..', 'data', 'restaurants')

// Sample video to analyze on startup if no data exists
const SEED_VIDEO_URL = 'https://www.youtube.com/watch?v=6jvskRWvQkg'

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await getDbHealth()
    res.json({
      status: dbHealth.status === 'healthy' ? 'OK' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbHealth
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    })
  }
})

// YouTube Transcript Collector health check endpoint
app.get('/api/youtube-transcript/health', async (req, res) => {
  try {
    const { spawn } = require('child_process')

    const pythonScript = `
import sys
import os
sys.path.insert(0, 'src')
from youtube_transcript_collector import YouTubeTranscriptCollector
import json

try:
    collector = YouTubeTranscriptCollector()
    health = collector.health_check()
    print(json.dumps(health))
except Exception as e:
    import traceback
    print(json.dumps({
        "status": "error",
        "message": str(e),
        "traceback": traceback.format_exc(),
        "api_connectivity": "unknown",
        "cache": {"enabled": False},
        "rate_limiter": {"enabled": False}
    }))
`

    const projectRoot = path.join(__dirname, '..')
    const python = spawn('python3', ['-c', pythonScript], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: projectRoot }
    })

    let output = ''
    let errorOutput = ''

    python.stdout.on('data', (data) => { output += data.toString() })
    python.stderr.on('data', (data) => { errorOutput += data.toString() })

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const health = JSON.parse(output.trim())
          res.json(health)
        } catch (e) {
          res.status(500).json({ status: 'error', message: 'Failed to parse health check response' })
        }
      } else {
        res.status(500).json({ status: 'error', message: 'Health check failed', error: errorOutput })
      }
    })

    python.on('error', (error) => {
      res.status(500).json({ status: 'error', message: 'Failed to spawn Python process', error: error.message })
    })
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to run health check', error: error.message })
  }
})

// Admin routes
app.use('/api/admin/auth', adminAuthRoutes)
app.use('/api/admin/restaurants', adminRestaurantsRoutes)
app.use('/api/admin/analytics', adminAnalyticsRoutes)
app.use('/api/admin/articles', adminArticlesRoutes)
app.use('/api/admin/videos', adminVideosRoutes)
app.use('/api/admin/bulk', adminBulkRoutes)
app.use('/api/admin/audit', adminAuditRoutes)

// GET /api/restaurants - List all restaurants
app.get('/api/restaurants', async (req, res) => {
  try {
    const restaurants = await restaurantRepository.findAll({
      limit: 1000 // Default limit
    })
    res.json({ restaurants, count: restaurants.length })
  } catch (error) {
    console.error('Error loading restaurants:', error)
    res.status(500).json({ error: 'Failed to load restaurants' })
  }
})

// GET /api/restaurants/search - Advanced search with filters
app.get('/api/restaurants/search', async (req, res) => {
  try {
    const {
      location,
      cuisine,
      price_range,
      status,
      host_opinion,
      date_start,
      date_end,
      episode_id,
      lat,
      lng,
      radius,
      sort_by = 'analysis_date',
      sort_direction = 'desc',
      page = 1,
      limit = 20
    } = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    // Handle nearby search
    if (lat && lng) {
      const restaurants = await restaurantRepository.findNearby(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius) || 5,
        limitNum
      )
      return res.json({
        restaurants,
        analytics: { total_count: restaurants.length },
        timeline_data: []
      })
    }

    // Build filters
    const filters = {
      city: location,
      cuisine,
      priceRange: price_range,
      status,
      hostOpinion: host_opinion,
      dateStart: date_start,
      dateEnd: date_end,
      videoId: episode_id,
      sortBy: sort_by === 'analysis_date' ? 'analysis_date' :
              sort_by === 'name' ? 'name_hebrew' :
              sort_by === 'location' ? 'city' :
              sort_by === 'rating' ? 'google_rating' : 'created_at',
      sortDirection: sort_direction,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    }

    // Get restaurants
    const restaurants = await restaurantRepository.findAll(filters)

    // Get total count for pagination
    const totalCount = await restaurantRepository.count(filters)

    // Get analytics
    const analytics = await restaurantRepository.getAnalytics()
    const dateDistribution = await restaurantRepository.getDateDistribution({
      dateStart: date_start,
      dateEnd: date_end
    })

    // Generate timeline data
    const timelineData = []
    const dateGroups = {}
    restaurants.forEach(restaurant => {
      if (restaurant.episode_info?.analysis_date) {
        const dateKey = new Date(restaurant.episode_info.analysis_date).toISOString().split('T')[0]
        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = []
        }
        dateGroups[dateKey].push({
          name_hebrew: restaurant.name_hebrew,
          name_english: restaurant.name_english,
          cuisine_type: restaurant.cuisine_type,
          location: restaurant.location,
          host_opinion: restaurant.host_opinion,
          episode_id: restaurant.episode_info.video_id
        })
      }
    })

    Object.entries(dateGroups).forEach(([date, rests]) => {
      timelineData.push({ date, restaurants: rests, count: rests.length })
    })
    timelineData.sort((a, b) => new Date(b.date) - new Date(a.date))

    res.json({
      restaurants,
      timeline_data: timelineData,
      analytics: {
        total_count: totalCount,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(totalCount / limitNum),
        filter_counts: {
          cuisine: analytics.cuisineDistribution,
          location: analytics.locationDistribution,
          price_range: analytics.priceDistribution,
          host_opinion: analytics.opinionDistribution
        },
        date_distribution: dateDistribution
      }
    })
  } catch (error) {
    console.error('Error in search:', error)
    res.status(500).json({ error: 'Failed to search restaurants' })
  }
})

// GET /api/episodes/search - Search episodes
app.get('/api/episodes/search', async (req, res) => {
  try {
    const {
      date_start,
      date_end,
      cuisine_filter,
      location_filter,
      min_restaurants = 1,
      sort_by = 'analysis_date',
      sort_direction = 'desc',
      page = 1,
      limit = 20
    } = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    // Get episodes with restaurant counts
    const episodes = await episodeRepository.getWithRestaurantCounts({
      dateStart: date_start,
      dateEnd: date_end,
      minRestaurants: parseInt(min_restaurants),
      limit: limitNum
    })

    // Get restaurants for each episode if needed
    const episodesWithRestaurants = await Promise.all(
      episodes.map(async (episode) => {
        const restaurants = await restaurantRepository.findByVideoId(episode.video_id)

        // Apply cuisine/location filters
        let filteredRestaurants = restaurants
        if (cuisine_filter) {
          filteredRestaurants = filteredRestaurants.filter(r =>
            r.cuisine_type?.toLowerCase().includes(cuisine_filter.toLowerCase())
          )
        }
        if (location_filter) {
          filteredRestaurants = filteredRestaurants.filter(r =>
            r.location?.city?.toLowerCase().includes(location_filter.toLowerCase())
          )
        }

        return {
          episode_info: {
            video_id: episode.video_id,
            title: episode.title,
            channel_name: episode.channel_name,
            video_url: episode.video_url,
            analysis_date: episode.analyzed_at
          },
          restaurants: filteredRestaurants,
          matching_restaurants: filteredRestaurants.length
        }
      })
    )

    // Filter out episodes with no matching restaurants
    const filteredEpisodes = episodesWithRestaurants.filter(
      e => e.matching_restaurants >= parseInt(min_restaurants)
    )

    const totalRestaurants = filteredEpisodes.reduce((sum, e) => sum + e.restaurants.length, 0)

    res.json({
      episodes: filteredEpisodes,
      count: filteredEpisodes.length,
      total_restaurants: totalRestaurants
    })
  } catch (error) {
    console.error('Error in episodes search:', error)
    res.status(500).json({ error: 'Failed to search episodes' })
  }
})

// GET /api/analytics/timeline - Timeline analytics
app.get('/api/analytics/timeline', async (req, res) => {
  try {
    const {
      date_start,
      date_end,
      granularity = 'day',
      cuisine_filter,
      location_filter
    } = req.query

    const filters = {
      dateStart: date_start,
      dateEnd: date_end,
      cuisine: cuisine_filter,
      city: location_filter
    }

    const restaurants = await restaurantRepository.findAll({ ...filters, limit: 10000 })
    const analytics = await restaurantRepository.getAnalytics()

    // Group by time period
    const timelineGroups = {}
    restaurants.forEach(restaurant => {
      if (restaurant.episode_info?.analysis_date) {
        const date = new Date(restaurant.episode_info.analysis_date)
        let dateKey

        switch (granularity) {
          case 'week':
            const startOfWeek = new Date(date)
            startOfWeek.setDate(date.getDate() - date.getDay())
            dateKey = startOfWeek.toISOString().split('T')[0]
            break
          case 'month':
            dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            break
          default:
            dateKey = date.toISOString().split('T')[0]
        }

        if (!timelineGroups[dateKey]) {
          timelineGroups[dateKey] = []
        }
        timelineGroups[dateKey].push({
          name_hebrew: restaurant.name_hebrew,
          name_english: restaurant.name_english,
          cuisine_type: restaurant.cuisine_type,
          location: restaurant.location,
          host_opinion: restaurant.host_opinion,
          episode_id: restaurant.episode_info?.video_id
        })
      }
    })

    const timeline = Object.entries(timelineGroups)
      .map(([date, rests]) => ({ date, restaurants: rests, count: rests.length }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))

    // Top episodes
    const episodeGroups = {}
    restaurants.forEach(restaurant => {
      if (restaurant.episode_info?.video_id) {
        const videoId = restaurant.episode_info.video_id
        if (!episodeGroups[videoId]) {
          episodeGroups[videoId] = {
            video_id: videoId,
            video_url: restaurant.episode_info.video_url,
            count: 0,
            restaurants: []
          }
        }
        episodeGroups[videoId].count++
        episodeGroups[videoId].restaurants.push(restaurant.name_hebrew)
      }
    })

    const topEpisodes = Object.values(episodeGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    res.json({
      timeline,
      analytics: {
        cuisine_distribution: analytics.cuisineDistribution,
        location_distribution: analytics.locationDistribution,
        opinion_distribution: analytics.opinionDistribution,
        price_distribution: analytics.priceDistribution,
        top_episodes: topEpisodes
      },
      summary: {
        total_restaurants: restaurants.length,
        unique_episodes: Object.keys(episodeGroups).length
      }
    })
  } catch (error) {
    console.error('Error in timeline analytics:', error)
    res.status(500).json({ error: 'Failed to generate timeline analytics' })
  }
})

// GET /api/analytics/trends - Trends analytics
app.get('/api/analytics/trends', async (req, res) => {
  try {
    const { period = '3months', trending_threshold = 3 } = req.query

    // Calculate period start date
    const now = new Date()
    const periodStartDate = new Date()
    switch (period) {
      case '1month': periodStartDate.setMonth(now.getMonth() - 1); break
      case '6months': periodStartDate.setMonth(now.getMonth() - 6); break
      case '1year': periodStartDate.setFullYear(now.getFullYear() - 1); break
      default: periodStartDate.setMonth(now.getMonth() - 3)
    }

    const restaurants = await restaurantRepository.findAll({
      dateStart: periodStartDate.toISOString(),
      limit: 10000
    })

    // Regional patterns
    const regionalGroups = {
      'North': { cities: {}, total: 0, cuisines: {}, ratings: [] },
      'Center': { cities: {}, total: 0, cuisines: {}, ratings: [] },
      'South': { cities: {}, total: 0, cuisines: {}, ratings: [] }
    }

    restaurants.forEach(restaurant => {
      const region = restaurant.location?.region || 'Center'
      const city = restaurant.location?.city
      const cuisine = restaurant.cuisine_type
      const rating = restaurant.rating?.google_rating

      if (regionalGroups[region]) {
        regionalGroups[region].total++
        if (city) regionalGroups[region].cities[city] = (regionalGroups[region].cities[city] || 0) + 1
        if (cuisine) regionalGroups[region].cuisines[cuisine] = (regionalGroups[region].cuisines[cuisine] || 0) + 1
        if (rating) regionalGroups[region].ratings.push(rating)
      }
    })

    const regional_patterns = Object.entries(regionalGroups).map(([region, data]) => ({
      region,
      cities: data.cities,
      total: data.total,
      cuisines: data.cuisines,
      average_rating: data.ratings.length > 0
        ? data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length
        : 0,
      top_city: Object.entries(data.cities).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      top_cuisine: Object.entries(data.cuisines).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    }))

    // Cuisine trends
    const cuisineTrends = {}
    restaurants.forEach(restaurant => {
      const cuisine = restaurant.cuisine_type
      if (!cuisine) return

      if (!cuisineTrends[cuisine]) {
        cuisineTrends[cuisine] = { cuisine, total: 0, recent_mentions: 0 }
      }
      cuisineTrends[cuisine].total++
    })

    const cuisine_trends = Object.values(cuisineTrends)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const most_active_region = regional_patterns
      .sort((a, b) => b.total - a.total)[0]?.region || ''

    res.json({
      trending_restaurants: restaurants.slice(0, 10),
      regional_patterns,
      cuisine_trends,
      period_summary: {
        period,
        restaurants_discovered: restaurants.length,
        most_active_region
      }
    })
  } catch (error) {
    console.error('Error in trends analytics:', error)
    res.status(500).json({ error: 'Failed to generate trends analytics' })
  }
})

// GET /api/restaurants/:id - Get single restaurant
app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params
    const restaurant = await restaurantRepository.findById(id)

    if (restaurant) {
      res.json(restaurant)
    } else {
      res.status(404).json({ error: 'Restaurant not found' })
    }
  } catch (error) {
    console.error('Error loading restaurant:', error)
    res.status(500).json({ error: 'Failed to load restaurant' })
  }
})

// POST /api/restaurants - Create restaurant
app.post('/api/restaurants', async (req, res) => {
  try {
    const restaurant = await restaurantRepository.create(req.body)
    res.status(201).json(restaurant)
  } catch (error) {
    console.error('Error saving restaurant:', error)
    res.status(500).json({ error: 'Failed to save restaurant' })
  }
})

// PUT /api/restaurants/:id - Update restaurant
app.put('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params
    const restaurant = await restaurantRepository.update(id, req.body)

    if (restaurant) {
      res.json(restaurant)
    } else {
      res.status(404).json({ error: 'Restaurant not found' })
    }
  } catch (error) {
    console.error('Error updating restaurant:', error)
    res.status(500).json({ error: 'Failed to update restaurant' })
  }
})

// DELETE /api/restaurants/:id - Delete restaurant
app.delete('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params
    const deleted = await restaurantRepository.delete(id)

    if (deleted) {
      res.json({ message: 'Restaurant deleted successfully' })
    } else {
      res.status(404).json({ error: 'Restaurant not found' })
    }
  } catch (error) {
    console.error('Error deleting restaurant:', error)
    res.status(500).json({ error: 'Failed to delete restaurant' })
  }
})

// Google Places endpoints
app.get('/api/places/search', async (req, res) => {
  try {
    const { query: searchQuery } = req.query

    if (!searchQuery) {
      return res.status(400).json({ error: 'Search query required' })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Places API key not configured' })
    }

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`

    const fetch = (await import('node-fetch')).default
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (data.status === 'OK') {
      res.json({
        places: data.results.map(place => ({
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address,
          geometry: place.geometry,
          rating: place.rating,
          price_level: place.price_level,
          types: place.types
        }))
      })
    } else {
      res.status(400).json({ error: data.status, message: data.error_message })
    }
  } catch (error) {
    console.error('Error searching places:', error)
    res.status(500).json({ error: 'Failed to search places' })
  }
})

app.get('/api/places/details/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params
    const apiKey = process.env.GOOGLE_PLACES_API_KEY

    if (!apiKey) {
      return res.status(500).json({ error: 'Google Places API key not configured' })
    }

    const fields = 'place_id,name,formatted_address,geometry,rating,price_level,formatted_phone_number,website,opening_hours,photos,reviews'
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`

    const fetch = (await import('node-fetch')).default
    const response = await fetch(detailsUrl)
    const data = await response.json()

    if (data.status === 'OK') {
      res.json({ place: data.result })
    } else {
      res.status(400).json({ error: data.status, message: data.error_message })
    }
  } catch (error) {
    console.error('Error getting place details:', error)
    res.status(500).json({ error: 'Failed to get place details' })
  }
})

// Channel analysis endpoint
app.post('/api/analyze/channel', async (req, res) => {
  try {
    const { channel_url, filters = {}, processing_options = {} } = req.body

    if (!channel_url || (!channel_url.includes('youtube.com/channel') && !channel_url.includes('youtube.com/c/') && !channel_url.includes('youtube.com/user/') && !channel_url.includes('youtube.com/@'))) {
      return res.status(400).json({ error: 'Valid YouTube channel URL required' })
    }

    // Create job in database
    const job = await jobRepository.create('channel_analysis', {
      channel_url,
      filters,
      processing_options
    })

    console.log(`Starting channel analysis job: ${job.id}`)

    // Start the Python channel analysis in the background
    const { spawn } = require('child_process')
    const pythonPath = path.join(__dirname, '..', 'scripts', 'process_channel.py')
    const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python')

    const args = [
      pythonPath,
      '--channel_url', channel_url,
      '--max_results', (filters.max_results || 50).toString(),
      '--batch_size', (processing_options.batch_size || 5).toString(),
      '--job_id', job.id
    ]

    if (filters.date_from) args.push('--date_from', filters.date_from)
    if (filters.date_to) args.push('--date_to', filters.date_to)

    const python = spawn(venvPython, args, {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '..'),
        DATABASE_URL: process.env.DATABASE_URL
      }
    })

    python.stdout.on('data', (data) => console.log('PYTHON:', data.toString().trim()))
    python.stderr.on('data', (data) => console.log('PYTHON ERR:', data.toString().trim()))

    python.on('close', async (code) => {
      if (code === 0) {
        await jobRepository.complete(job.id, { status: 'completed' })
      } else {
        await jobRepository.fail(job.id, `Process exited with code ${code}`)
      }
    })

    res.status(202).json({
      job_id: job.id,
      message: 'Channel analysis started successfully',
      status: 'started',
      channel_url,
      filters,
      processing_options
    })
  } catch (error) {
    console.error('Error starting channel analysis:', error)
    res.status(500).json({ error: 'Failed to start channel analysis' })
  }
})

// Job status endpoint
app.get('/api/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await jobRepository.findById(jobId)

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    res.json(job)
  } catch (error) {
    console.error('Error getting job status:', error)
    res.status(500).json({ error: 'Failed to get job status' })
  }
})

// Job results endpoint
app.get('/api/jobs/:jobId/results', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await jobRepository.findById(jobId)

    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    res.json({
      job_id: job.id,
      status: job.status,
      result_data: job.result_data,
      error_message: job.error_message
    })
  } catch (error) {
    console.error('Error getting job results:', error)
    res.status(500).json({ error: 'Failed to get job results' })
  }
})

// Cancel job endpoint
app.delete('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const job = await jobRepository.cancel(jobId)

    if (job) {
      res.json({ job_id: jobId, status: 'cancelled', message: 'Job cancelled successfully' })
    } else {
      res.status(404).json({ error: 'Job not found or already completed' })
    }
  } catch (error) {
    console.error('Error cancelling job:', error)
    res.status(500).json({ error: 'Failed to cancel job' })
  }
})

// List jobs endpoint
app.get('/api/jobs', async (req, res) => {
  try {
    const { status } = req.query
    const jobs = await jobRepository.findAll({ status, limit: 50 })
    res.json({ jobs, count: jobs.length })
  } catch (error) {
    console.error('Error listing jobs:', error)
    res.status(500).json({ error: 'Failed to list jobs' })
  }
})

// Video analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body

    if (!url || !url.includes('youtube.com')) {
      return res.status(400).json({ error: 'Valid YouTube URL required' })
    }

    // Create job in database
    const job = await jobRepository.create('video_analysis', { url })

    console.log(`Starting video analysis job: ${job.id}`)

    // Start the Python analysis in the background
    const { spawn } = require('child_process')
    const pythonPath = path.join(__dirname, '..', 'scripts', 'main.py')
    const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python')

    const python = spawn(venvPython, [pythonPath, url, '--job_id', job.id], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '..'),
        DATABASE_URL: process.env.DATABASE_URL
      }
    })

    python.stdout.on('data', (data) => console.log('PYTHON:', data.toString().trim()))
    python.stderr.on('data', (data) => console.log('PYTHON ERR:', data.toString().trim()))

    python.on('close', async (code) => {
      if (code === 0) {
        await jobRepository.complete(job.id, { status: 'completed' })
      } else {
        await jobRepository.fail(job.id, `Process exited with code ${code}`)
      }
    })

    res.status(202).json({
      job_id: job.id,
      message: 'Analysis started successfully',
      status: 'processing',
      url
    })
  } catch (error) {
    console.error('Error starting analysis:', error)
    res.status(500).json({ error: 'Failed to start analysis' })
  }
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

// Server startup
async function startServer() {
  console.log('=' .repeat(60))
  console.log('WHERE2EAT API SERVER STARTING')
  console.log('=' .repeat(60))
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'configured' : 'NOT SET'}`)

  try {
    // Test database connection
    console.log('\n1. Testing database connection...')
    const connected = await testConnection()

    if (!connected) {
      console.error('ERROR: Could not connect to database')
      console.log('Starting server without database - using fallback mode')
    } else {
      console.log('   Database connection successful')

      // Initialize database schema
      console.log('\n2. Initializing database schema...')
      await initializeDatabase()
      console.log('   Schema initialized')

      // Run migration if needed
      console.log('\n3. Checking for data migration...')
      await migrateOnStartup()
    }

    // Start server
    app.listen(port, () => {
      console.log('\n' + '=' .repeat(60))
      console.log(`Where2Eat API server running on http://localhost:${port}`)
      console.log('=' .repeat(60))
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
