const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config()

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
const adminSubscriptionsRoutes = require('./routes/admin-subscriptions')
const adminPipelineRoutes = require('./routes/admin-pipeline')
const adminEpisodesRoutes = require('./routes/admin-episodes')
const { filterHallucinations } = require('./utils/hallucination-filter')

app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001', // Admin dashboard
    'https://where2eat.vercel.app',
    'https://where2eat-delta.vercel.app', // Current Vercel deployment
    // Add your custom domain here or via ALLOWED_ORIGINS env var
  ],
  credentials: true
}))
app.use(morgan('combined'))
app.use(express.json())
app.use(cookieParser()) // Parse cookies for session management

const dataDir = path.join(__dirname, '..', 'data', 'restaurants')

// Sample video to analyze on startup if no data exists
// This video ID comes from the backup data files
const SEED_VIDEO_URL = 'https://www.youtube.com/watch?v=6jvskRWvQkg'

// Initialize restaurant data by fetching and analyzing a video if directory is empty
async function initializeRestaurantData() {
  console.log('=' .repeat(60))
  console.log('🚀 SERVER STARTUP - RESTAURANT DATA INITIALIZATION')
  console.log('=' .repeat(60))
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  console.log(`📂 Data directory: ${dataDir}`)

  try {
    // Step 1: Check data directory
    await fs.ensureDir(dataDir)
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))

    console.log(`📊 Current state: ${jsonFiles.length} restaurant JSON files found`)

    if (jsonFiles.length > 0) {
      console.log(`✅ Restaurant data already exists (${jsonFiles.length} files), skipping initialization`)
      console.log('Files:', jsonFiles.slice(0, 5).join(', '), jsonFiles.length > 5 ? `... and ${jsonFiles.length - 5} more` : '')
      return
    }

    // Step 2: Try to copy from backup directory first
    const backupDir = path.join(__dirname, '..', 'data', 'restaurants_backup')
    try {
      const backupFiles = await fs.readdir(backupDir)
      const backupJsonFiles = backupFiles.filter(file => file.endsWith('.json'))

      if (backupJsonFiles.length > 0) {
        console.log(`📦 Found ${backupJsonFiles.length} backup files, copying to data directory...`)
        for (const file of backupJsonFiles) {
          const src = path.join(backupDir, file)
          const dest = path.join(dataDir, file)
          await fs.copy(src, dest)
        }
        console.log(`✅ Copied ${backupJsonFiles.length} restaurant files from backup`)
        return
      }
    } catch (err) {
      console.log(`📦 No backup directory found or error reading: ${err.message}`)
    }

    // Step 3: No backup data - trigger video analysis
    console.log('⚠️ No restaurant data found and no backup - triggering video analysis...')
    console.log(`🎬 Seed video URL: ${SEED_VIDEO_URL}`)

    // Step 4: Check environment for required API keys
    console.log('\n📋 ENVIRONMENT CHECK:')
    console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ SET' : '❌ NOT SET'}`)
    console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ SET' : '❌ NOT SET'}`)
    console.log(`  GOOGLE_PLACES_API_KEY: ${process.env.GOOGLE_PLACES_API_KEY ? '✅ SET' : '❌ NOT SET'}`)
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`)
    console.log(`  PWD: ${process.cwd()}`)

    // Step 5: Check Python environment
    const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python')
    const systemPython = 'python3'
    let pythonPath = systemPython

    try {
      await fs.access(venvPython)
      pythonPath = venvPython
      console.log(`\n🐍 Python: Using venv (${venvPython})`)
    } catch {
      console.log(`\n🐍 Python: Using system python3 (venv not found at ${venvPython})`)
    }

    // Step 6: Check if main.py exists
    const mainScript = path.join(__dirname, '..', 'scripts', 'main.py')
    try {
      await fs.access(mainScript)
      console.log(`📜 Script: ${mainScript} ✅ EXISTS`)
    } catch {
      console.error(`📜 Script: ${mainScript} ❌ NOT FOUND`)
      console.error('❌ Cannot initialize - main.py script not found')
      return
    }

    // Step 7: Spawn Python process to analyze video
    console.log('\n🔄 STARTING VIDEO ANALYSIS...')
    console.log('-'.repeat(40))

    const { spawn } = require('child_process')

    const python = spawn(pythonPath, [mainScript, SEED_VIDEO_URL], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '..'),
        PYTHONUNBUFFERED: '1'  // Disable buffering for real-time logs
      }
    })

    python.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => console.log(`[PYTHON STDOUT] ${line}`))
    })

    python.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim())
      lines.forEach(line => console.log(`[PYTHON STDERR] ${line}`))
    })

    python.on('error', (error) => {
      console.error('❌ PYTHON SPAWN ERROR:', error.message)
      console.error('Error details:', JSON.stringify(error, null, 2))
    })

    python.on('close', async (code) => {
      console.log('-'.repeat(40))
      console.log(`🏁 PYTHON PROCESS EXITED WITH CODE: ${code}`)

      // Check if any restaurants were created
      try {
        const newFiles = await fs.readdir(dataDir)
        const newJsonFiles = newFiles.filter(file => file.endsWith('.json'))
        console.log(`📊 After analysis: ${newJsonFiles.length} restaurant JSON files`)

        if (newJsonFiles.length > 0) {
          console.log('✅ SUCCESS - Restaurant data initialized!')
          console.log('Files created:', newJsonFiles.join(', '))
        } else {
          console.log('⚠️ WARNING - No restaurant files created after analysis')
          console.log('Possible causes:')
          console.log('  - API keys not configured')
          console.log('  - Transcript fetch failed')
          console.log('  - LLM analysis failed')
          console.log('  - Check PYTHON STDERR logs above for details')
        }
      } catch (err) {
        console.error('❌ Error checking results:', err.message)
      }

      console.log('=' .repeat(60))
    })

  } catch (error) {
    console.error('❌ INITIALIZATION ERROR:', error.message)
    console.error('Stack trace:', error.stack)
  }
}

// Run initialization on startup
initializeRestaurantData()

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// YouTube Transcript Collector health check endpoint
app.get('/api/youtube-transcript/health', async (req, res) => {
  try {
    const { spawn } = require('child_process')
    const path = require('path')

    // Call Python health check script using relative paths
    const pythonScript = `
import sys
import os
# Add src directory to Python path
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

    // Use python3 and set PYTHONPATH to project root
    const projectRoot = path.join(__dirname, '..')
    const python = spawn('python3', ['-c', pythonScript], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PYTHONPATH: projectRoot
      }
    })

    let output = ''
    let errorOutput = ''

    python.stdout.on('data', (data) => {
      output += data.toString()
    })

    python.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    python.on('close', (code) => {
      if (code === 0) {
        try {
          const health = JSON.parse(output.trim())
          res.json(health)
        } catch (e) {
          res.status(500).json({
            status: 'error',
            message: 'Failed to parse health check response',
            error: e.message,
            raw_output: output.substring(0, 200)
          })
        }
      } else {
        res.status(500).json({
          status: 'error',
          message: 'Health check failed',
          error: errorOutput || 'Python process exited with error',
          exit_code: code
        })
      }
    })

    python.on('error', (error) => {
      res.status(500).json({
        status: 'error',
        message: 'Failed to spawn Python process',
        error: error.message
      })
    })

  } catch (error) {
    console.error('Error running transcript health check:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to run health check',
      error: error.message
    })
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
app.use('/api/admin/subscriptions', adminSubscriptionsRoutes)
app.use('/api/admin/pipeline', adminPipelineRoutes)
app.use('/api/admin/episodes', adminEpisodesRoutes)

app.get('/api/restaurants', async (req, res) => {
  try {
    await fs.ensureDir(dataDir)
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))

    let restaurants = []
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataDir, file)
        const data = await fs.readJson(filePath)
        restaurants.push(data)
      } catch (err) {
        console.warn(`Warning: Failed to read ${file}:`, err.message)
      }
    }

    // Filter out hallucinations (false extractions)
    const includeAll = req.query.include_all === 'true'
    if (!includeAll) {
      const originalCount = restaurants.length
      restaurants = filterHallucinations(restaurants, { strictMode: true })
      if (originalCount !== restaurants.length) {
        console.log(`[Hallucination Filter] Filtered ${originalCount - restaurants.length} of ${originalCount} restaurants`)
      }
    }

    res.json({ restaurants, count: restaurants.length })
  } catch (error) {
    console.error('Error loading restaurants:', error)
    res.status(500).json({ error: 'Failed to load restaurants' })
  }
})

// UNIFIED SEARCH API ENDPOINT - Advanced filtering and analytics
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
      sort_by = 'analysis_date',
      sort_direction = 'desc',
      page = 1,
      limit = 20,
      include_all = 'false'
    } = req.query;

    await fs.ensureDir(dataDir)
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))

    let restaurants = []
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataDir, file)
        const data = await fs.readJson(filePath)
        restaurants.push(data)
      } catch (err) {
        console.warn(`Warning: Failed to read ${file}:`, err.message)
      }
    }

    // Filter out hallucinations first (unless include_all is set)
    if (include_all !== 'true') {
      restaurants = filterHallucinations(restaurants, { strictMode: true })
    }

    // Apply filters
    let filteredRestaurants = restaurants.filter(restaurant => {
      // Location filtering
      if (location && restaurant.location?.city) {
        if (!restaurant.location.city.toLowerCase().includes(location.toLowerCase())) {
          return false;
        }
      }

      // Cuisine filtering
      if (cuisine) {
        const cuisines = Array.isArray(cuisine) ? cuisine : [cuisine];
        if (!cuisines.some(c => restaurant.cuisine_type?.toLowerCase().includes(c.toLowerCase()))) {
          return false;
        }
      }

      // Price range filtering
      if (price_range) {
        const priceRanges = Array.isArray(price_range) ? price_range : [price_range];
        if (!priceRanges.includes(restaurant.price_range)) {
          return false;
        }
      }

      // Status filtering
      if (status) {
        const statuses = Array.isArray(status) ? status : [status];
        if (!statuses.includes(restaurant.status)) {
          return false;
        }
      }

      // Host opinion filtering
      if (host_opinion) {
        const opinions = Array.isArray(host_opinion) ? host_opinion : [host_opinion];
        if (!opinions.includes(restaurant.host_opinion)) {
          return false;
        }
      }

      // Episode filtering
      if (episode_id) {
        const episodeIds = Array.isArray(episode_id) ? episode_id : [episode_id];
        if (!episodeIds.includes(restaurant.episode_info?.video_id)) {
          return false;
        }
      }

      // Date range filtering
      if (date_start || date_end) {
        const analysisDate = restaurant.episode_info?.analysis_date;
        if (analysisDate) {
          const restaurantDate = new Date(analysisDate);
          if (date_start && restaurantDate < new Date(date_start)) return false;
          if (date_end && restaurantDate > new Date(date_end)) return false;
        }
      }

      return true;
    });

    // Generate analytics before sorting/pagination
    const analytics = {
      filterCounts: {
        cuisine: {},
        location: {},
        price_range: {},
        host_opinion: {}
      },
      dateDistribution: {}
    };

    filteredRestaurants.forEach(restaurant => {
      // Count cuisines
      if (restaurant.cuisine_type) {
        analytics.filterCounts.cuisine[restaurant.cuisine_type] = 
          (analytics.filterCounts.cuisine[restaurant.cuisine_type] || 0) + 1;
      }

      // Count locations
      if (restaurant.location?.city) {
        analytics.filterCounts.location[restaurant.location.city] = 
          (analytics.filterCounts.location[restaurant.location.city] || 0) + 1;
      }

      // Count price ranges
      if (restaurant.price_range) {
        analytics.filterCounts.price_range[restaurant.price_range] = 
          (analytics.filterCounts.price_range[restaurant.price_range] || 0) + 1;
      }

      // Count host opinions
      if (restaurant.host_opinion) {
        analytics.filterCounts.host_opinion[restaurant.host_opinion] = 
          (analytics.filterCounts.host_opinion[restaurant.host_opinion] || 0) + 1;
      }

      // Count by date
      if (restaurant.episode_info?.analysis_date) {
        const dateKey = new Date(restaurant.episode_info.analysis_date).toISOString().split('T')[0];
        analytics.dateDistribution[dateKey] = (analytics.dateDistribution[dateKey] || 0) + 1;
      }
    });

    // Apply sorting
    filteredRestaurants.sort((a, b) => {
      let aValue, bValue;

      switch (sort_by) {
        case 'name':
          aValue = a.name_hebrew || '';
          bValue = b.name_hebrew || '';
          break;
        case 'location':
          aValue = a.location?.city || '';
          bValue = b.location?.city || '';
          break;
        case 'cuisine':
          aValue = a.cuisine_type || '';
          bValue = b.cuisine_type || '';
          break;
        case 'rating':
          aValue = a.rating?.google_rating || 0;
          bValue = b.rating?.google_rating || 0;
          break;
        case 'analysis_date':
        default:
          aValue = a.episode_info?.analysis_date || '';
          bValue = b.episode_info?.analysis_date || '';
          break;
      }

      if (sort_direction === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedRestaurants = filteredRestaurants.slice(startIndex, startIndex + limitNum);

    // Generate timeline data for included restaurants
    const timelineData = [];
    const dateGroups = {};

    paginatedRestaurants.forEach(restaurant => {
      if (restaurant.episode_info?.analysis_date) {
        const dateKey = new Date(restaurant.episode_info.analysis_date).toISOString().split('T')[0];
        if (!dateGroups[dateKey]) {
          dateGroups[dateKey] = [];
        }
        dateGroups[dateKey].push({
          name_hebrew: restaurant.name_hebrew,
          name_english: restaurant.name_english,
          cuisine_type: restaurant.cuisine_type,
          location: restaurant.location,
          host_opinion: restaurant.host_opinion,
          episode_id: restaurant.episode_info.video_id
        });
      }
    });

    Object.entries(dateGroups).forEach(([date, restaurants]) => {
      timelineData.push({
        date,
        restaurants,
        count: restaurants.length
      });
    });

    timelineData.sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log(`🔍 Unified search: ${filteredRestaurants.length} restaurants found, returning ${paginatedRestaurants.length}`);

    res.json({
      restaurants: paginatedRestaurants,
      timeline_data: timelineData,
      analytics: {
        total_count: filteredRestaurants.length,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(filteredRestaurants.length / limitNum),
        filter_counts: analytics.filterCounts,
        date_distribution: analytics.dateDistribution
      }
    });

  } catch (error) {
    console.error('Error in unified search:', error);
    res.status(500).json({ error: 'Failed to search restaurants' });
  }
});

// EPISODES SEARCH API ENDPOINT - For podcast review tracking
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
    } = req.query;

    await fs.ensureDir(dataDir)
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    const restaurants = []
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataDir, file)
        const data = await fs.readJson(filePath)
        restaurants.push(data)
      } catch (err) {
        console.warn(`Warning: Failed to read ${file}:`, err.message)
      }
    }

    // Group restaurants by episode
    const episodeGroups = {};
    restaurants.forEach(restaurant => {
      if (restaurant.episode_info?.video_id) {
        const videoId = restaurant.episode_info.video_id;
        if (!episodeGroups[videoId]) {
          episodeGroups[videoId] = {
            episode_info: restaurant.episode_info,
            restaurants: [],
            food_trends: [],
            episode_summary: ''
          };
        }
        episodeGroups[videoId].restaurants.push(restaurant);
      }
    });

    // Convert to episodes array and apply filters
    let episodes = Object.values(episodeGroups).filter(episode => {
      // Date filtering
      if (date_start || date_end) {
        const analysisDate = episode.episode_info?.analysis_date;
        if (analysisDate) {
          const episodeDate = new Date(analysisDate);
          if (date_start && episodeDate < new Date(date_start)) return false;
          if (date_end && episodeDate > new Date(date_end)) return false;
        }
      }

      // Cuisine filtering
      if (cuisine_filter) {
        const hasMatchingCuisine = episode.restaurants.some(r => 
          r.cuisine_type?.toLowerCase().includes(cuisine_filter.toLowerCase())
        );
        if (!hasMatchingCuisine) return false;
      }

      // Location filtering
      if (location_filter) {
        const hasMatchingLocation = episode.restaurants.some(r => 
          r.location?.city?.toLowerCase().includes(location_filter.toLowerCase())
        );
        if (!hasMatchingLocation) return false;
      }

      // Minimum restaurants filter
      if (episode.restaurants.length < parseInt(min_restaurants)) return false;

      return true;
    });

    // Add matching restaurants count
    episodes = episodes.map(episode => ({
      ...episode,
      matching_restaurants: episode.restaurants.length
    }));

    // Apply sorting
    episodes.sort((a, b) => {
      let aValue, bValue;
      
      switch (sort_by) {
        case 'restaurant_count':
          aValue = a.restaurants.length;
          bValue = b.restaurants.length;
          break;
        case 'analysis_date':
        default:
          aValue = a.episode_info?.analysis_date || '';
          bValue = b.episode_info?.analysis_date || '';
          break;
      }

      if (sort_direction === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedEpisodes = episodes.slice(startIndex, startIndex + limitNum);

    // Calculate total restaurants across episodes
    const totalRestaurants = episodes.reduce((sum, episode) => sum + episode.restaurants.length, 0);

    console.log(`📺 Episodes search: ${episodes.length} episodes found, ${totalRestaurants} total restaurants`);

    res.json({
      episodes: paginatedEpisodes,
      count: episodes.length,
      total_restaurants: totalRestaurants
    });

  } catch (error) {
    console.error('Error in episodes search:', error);
    res.status(500).json({ error: 'Failed to search episodes' });
  }
});

// TIMELINE ANALYTICS API ENDPOINT
app.get('/api/analytics/timeline', async (req, res) => {
  try {
    const {
      date_start,
      date_end,
      granularity = 'day', // day, week, month
      cuisine_filter,
      location_filter
    } = req.query;

    await fs.ensureDir(dataDir)
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    const restaurants = []
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataDir, file)
        const data = await fs.readJson(filePath)
        restaurants.push(data)
      } catch (err) {
        console.warn(`Warning: Failed to read ${file}:`, err.message)
      }
    }

    // Apply filters
    let filteredRestaurants = restaurants.filter(restaurant => {
      if (cuisine_filter && !restaurant.cuisine_type?.toLowerCase().includes(cuisine_filter.toLowerCase())) {
        return false;
      }
      if (location_filter && !restaurant.location?.city?.toLowerCase().includes(location_filter.toLowerCase())) {
        return false;
      }
      if (date_start || date_end) {
        const analysisDate = restaurant.episode_info?.analysis_date;
        if (analysisDate) {
          const restaurantDate = new Date(analysisDate);
          if (date_start && restaurantDate < new Date(date_start)) return false;
          if (date_end && restaurantDate > new Date(date_end)) return false;
        }
      }
      return true;
    });

    // Group by time period
    const timelineGroups = {};
    filteredRestaurants.forEach(restaurant => {
      if (restaurant.episode_info?.analysis_date) {
        const date = new Date(restaurant.episode_info.analysis_date);
        let dateKey;
        
        switch (granularity) {
          case 'week':
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay());
            dateKey = startOfWeek.toISOString().split('T')[0];
            break;
          case 'month':
            dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          case 'day':
          default:
            dateKey = date.toISOString().split('T')[0];
            break;
        }

        if (!timelineGroups[dateKey]) {
          timelineGroups[dateKey] = [];
        }
        timelineGroups[dateKey].push({
          name_hebrew: restaurant.name_hebrew,
          name_english: restaurant.name_english,
          cuisine_type: restaurant.cuisine_type,
          location: restaurant.location,
          host_opinion: restaurant.host_opinion,
          episode_id: restaurant.episode_info.video_id
        });
      }
    });

    // Convert to timeline array
    const timeline = Object.entries(timelineGroups).map(([date, restaurants]) => ({
      date,
      restaurants,
      count: restaurants.length
    }));

    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Generate comprehensive analytics
    const analytics = {
      cuisine_distribution: {},
      location_distribution: {},
      opinion_distribution: {},
      price_distribution: {},
      monthly_discoveries: {},
      top_episodes: []
    };

    // Count distributions
    filteredRestaurants.forEach(restaurant => {
      if (restaurant.cuisine_type) {
        analytics.cuisine_distribution[restaurant.cuisine_type] = 
          (analytics.cuisine_distribution[restaurant.cuisine_type] || 0) + 1;
      }
      if (restaurant.location?.city) {
        analytics.location_distribution[restaurant.location.city] = 
          (analytics.location_distribution[restaurant.location.city] || 0) + 1;
      }
      if (restaurant.host_opinion) {
        analytics.opinion_distribution[restaurant.host_opinion] = 
          (analytics.opinion_distribution[restaurant.host_opinion] || 0) + 1;
      }
      if (restaurant.price_range) {
        analytics.price_distribution[restaurant.price_range] = 
          (analytics.price_distribution[restaurant.price_range] || 0) + 1;
      }
    });

    // Top episodes by restaurant count
    const episodeGroups = {};
    filteredRestaurants.forEach(restaurant => {
      if (restaurant.episode_info?.video_id) {
        const videoId = restaurant.episode_info.video_id;
        if (!episodeGroups[videoId]) {
          episodeGroups[videoId] = {
            video_id: videoId,
            video_url: restaurant.episode_info.video_url,
            count: 0,
            restaurants: []
          };
        }
        episodeGroups[videoId].count++;
        episodeGroups[videoId].restaurants.push(restaurant.name_hebrew);
      }
    });

    analytics.top_episodes = Object.values(episodeGroups)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const dateRange = {
      start: Math.min(...filteredRestaurants.map(r => new Date(r.episode_info?.analysis_date || 0).getTime())),
      end: Math.max(...filteredRestaurants.map(r => new Date(r.episode_info?.analysis_date || 0).getTime()))
    };

    console.log(`📊 Timeline analytics: ${timeline.length} periods, ${filteredRestaurants.length} restaurants`);

    res.json({
      timeline,
      analytics,
      summary: {
        total_restaurants: filteredRestaurants.length,
        unique_episodes: Object.keys(episodeGroups).length,
        date_range: dateRange
      }
    });

  } catch (error) {
    console.error('Error in timeline analytics:', error);
    res.status(500).json({ error: 'Failed to generate timeline analytics' });
  }
});

// TRENDS ANALYTICS API ENDPOINT
app.get('/api/analytics/trends', async (req, res) => {
  try {
    const {
      period = '3months', // 1month, 3months, 6months, 1year
      trending_threshold = 3
    } = req.query;

    await fs.ensureDir(dataDir)
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    const restaurants = []
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(dataDir, file)
        const data = await fs.readJson(filePath)
        restaurants.push(data)
      } catch (err) {
        console.warn(`Warning: Failed to read ${file}:`, err.message)
      }
    }

    // Calculate period start date
    const now = new Date();
    const periodStartDate = new Date();
    switch (period) {
      case '1month':
        periodStartDate.setMonth(now.getMonth() - 1);
        break;
      case '6months':
        periodStartDate.setMonth(now.getMonth() - 6);
        break;
      case '1year':
        periodStartDate.setFullYear(now.getFullYear() - 1);
        break;
      case '3months':
      default:
        periodStartDate.setMonth(now.getMonth() - 3);
        break;
    }

    // Filter restaurants within period
    const periodRestaurants = restaurants.filter(restaurant => {
      if (restaurant.episode_info?.analysis_date) {
        const restaurantDate = new Date(restaurant.episode_info.analysis_date);
        return restaurantDate >= periodStartDate;
      }
      return false;
    });

    // Identify trending restaurants (multiple mentions or highly rated)
    const restaurantGroups = {};
    periodRestaurants.forEach(restaurant => {
      const name = restaurant.name_hebrew;
      if (!restaurantGroups[name]) {
        restaurantGroups[name] = [];
      }
      restaurantGroups[name].push(restaurant);
    });

    const trendingRestaurants = Object.entries(restaurantGroups)
      .filter(([name, mentions]) => mentions.length >= parseInt(trending_threshold))
      .map(([name, mentions]) => mentions[0]) // Take first mention as representative
      .slice(0, 10);

    // Regional patterns
    const regionalGroups = {
      'North': { cities: {}, total: 0, cuisines: {}, ratings: [] },
      'Center': { cities: {}, total: 0, cuisines: {}, ratings: [] },
      'South': { cities: {}, total: 0, cuisines: {}, ratings: [] }
    };

    periodRestaurants.forEach(restaurant => {
      const region = restaurant.location?.region || 'Center'; // Default to Center
      const city = restaurant.location?.city;
      const cuisine = restaurant.cuisine_type;
      const rating = restaurant.rating?.google_rating;

      if (regionalGroups[region]) {
        regionalGroups[region].total++;
        
        if (city) {
          regionalGroups[region].cities[city] = (regionalGroups[region].cities[city] || 0) + 1;
        }
        if (cuisine) {
          regionalGroups[region].cuisines[cuisine] = (regionalGroups[region].cuisines[cuisine] || 0) + 1;
        }
        if (rating) {
          regionalGroups[region].ratings.push(rating);
        }
      }
    });

    const regional_patterns = Object.entries(regionalGroups).map(([region, data]) => ({
      region,
      cities: data.cities,
      total: data.total,
      cuisines: data.cuisines,
      average_rating: data.ratings.length > 0 ? 
        data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length : 0,
      total_ratings: data.ratings.length,
      top_city: Object.entries(data.cities).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
      top_cuisine: Object.entries(data.cuisines).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
    }));

    // Cuisine trends by month
    const cuisineTrends = {};
    periodRestaurants.forEach(restaurant => {
      const cuisine = restaurant.cuisine_type;
      const date = new Date(restaurant.episode_info.analysis_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!cuisineTrends[cuisine]) {
        cuisineTrends[cuisine] = {
          cuisine,
          monthly_counts: {},
          total: 0,
          recent_mentions: 0
        };
      }

      cuisineTrends[cuisine].total++;
      cuisineTrends[cuisine].monthly_counts[monthKey] = 
        (cuisineTrends[cuisine].monthly_counts[monthKey] || 0) + 1;

      // Count recent mentions (last month)
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      if (date >= lastMonth) {
        cuisineTrends[cuisine].recent_mentions++;
      }
    });

    const cuisine_trends = Object.values(cuisineTrends)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Find most active region
    const most_active_region = regional_patterns
      .sort((a, b) => b.total - a.total)[0]?.region || '';

    console.log(`📈 Trends analysis: ${trendingRestaurants.length} trending, ${periodRestaurants.length} total in ${period}`);

    res.json({
      trending_restaurants: trendingRestaurants,
      regional_patterns,
      cuisine_trends,
      period_summary: {
        period,
        restaurants_discovered: periodRestaurants.length,
        most_active_region
      }
    });

  } catch (error) {
    console.error('Error in trends analytics:', error);
    res.status(500).json({ error: 'Failed to generate trends analytics' });
  }
});

app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params
    const filePath = path.join(dataDir, `${id}.json`)
    
    if (await fs.pathExists(filePath)) {
      const data = await fs.readJson(filePath)
      res.json(data)
    } else {
      res.status(404).json({ error: 'Restaurant not found' })
    }
  } catch (error) {
    console.error('Error loading restaurant:', error)
    res.status(500).json({ error: 'Failed to load restaurant' })
  }
})

app.post('/api/restaurants', async (req, res) => {
  try {
    const restaurant = req.body
    const id = restaurant.id || uuidv4()
    const filePath = path.join(dataDir, `${id}.json`)
    
    const restaurantWithId = { ...restaurant, id }
    await fs.ensureDir(dataDir)
    await fs.writeJson(filePath, restaurantWithId, { spaces: 2 })
    
    res.status(201).json(restaurantWithId)
  } catch (error) {
    console.error('Error saving restaurant:', error)
    res.status(500).json({ error: 'Failed to save restaurant' })
  }
})

app.put('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params
    const restaurant = req.body
    const filePath = path.join(dataDir, `${id}.json`)
    
    if (await fs.pathExists(filePath)) {
      const updatedRestaurant = { ...restaurant, id }
      await fs.writeJson(filePath, updatedRestaurant, { spaces: 2 })
      res.json(updatedRestaurant)
    } else {
      res.status(404).json({ error: 'Restaurant not found' })
    }
  } catch (error) {
    console.error('Error updating restaurant:', error)
    res.status(500).json({ error: 'Failed to update restaurant' })
  }
})

app.delete('/api/restaurants/:id', async (req, res) => {
  try {
    const { id } = req.params
    const filePath = path.join(dataDir, `${id}.json`)
    
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath)
      res.json({ message: 'Restaurant deleted successfully' })
    } else {
      res.status(404).json({ error: 'Restaurant not found' })
    }
  } catch (error) {
    console.error('Error deleting restaurant:', error)
    res.status(500).json({ error: 'Failed to delete restaurant' })
  }
})

app.get('/api/places/search', async (req, res) => {
  try {
    const { query, location } = req.query
    
    if (!query) {
      return res.status(400).json({ error: 'Search query required' })
    }
    
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Places API key not configured' })
    }
    
    // Use Google Places Text Search API
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    
    console.log(`🔍 Searching Google Places for: ${query}`)
    
    const fetch = (await import('node-fetch')).default
    const response = await fetch(searchUrl)
    const data = await response.json()
    
    if (data.status === 'OK') {
      console.log(`✅ Found ${data.results.length} places`)
      res.json({
        places: data.results.map(place => ({
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address,
          geometry: place.geometry,
          rating: place.rating,
          price_level: place.price_level,
          types: place.types,
          photos: place.photos ? place.photos.slice(0, 3) : []
        }))
      })
    } else {
      console.log(`❌ Google Places API error: ${data.status}`)
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

    console.log(`📍 Getting place details for: ${placeId}`)

    const fetch = (await import('node-fetch')).default
    const response = await fetch(detailsUrl)
    const data = await response.json()

    if (data.status === 'OK') {
      console.log(`✅ Retrieved details for: ${data.result.name}`)
      res.json({ place: data.result })
    } else {
      console.log(`❌ Google Places Details API error: ${data.status}`)
      res.status(400).json({ error: data.status, message: data.error_message })
    }

  } catch (error) {
    console.error('Error getting place details:', error)
    res.status(500).json({ error: 'Failed to get place details' })
  }
})

// RESTAURANT ENRICHMENT ENDPOINT - Enrich with Google Places data
app.post('/api/restaurants/:id/enrich', async (req, res) => {
  try {
    const { id } = req.params
    const filePath = path.join(dataDir, `${id}.json`)

    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Places API key not configured' })
    }

    // Read restaurant data
    const restaurant = await fs.readJson(filePath)

    // Skip if already enriched
    if (restaurant.google_places_enriched) {
      return res.json({
        message: 'Restaurant already enriched',
        restaurant,
        enriched: false
      })
    }

    console.log(`🔍 Enriching restaurant: ${restaurant.name_hebrew || restaurant.name_english}`)

    // Search for restaurant on Google Places
    const searchQueries = []
    const city = restaurant.location?.city || ''

    if (restaurant.name_english && city) {
      searchQueries.push(`${restaurant.name_english} ${city}`)
    }
    if (restaurant.name_hebrew && city) {
      searchQueries.push(`${restaurant.name_hebrew} ${city}`)
    }
    if (restaurant.name_english) {
      searchQueries.push(`${restaurant.name_english} restaurant ${city}`)
    }

    const fetch = (await import('node-fetch')).default
    let placeDetails = null

    for (const query of searchQueries) {
      if (placeDetails) break

      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=restaurant&key=${apiKey}`
      const searchResponse = await fetch(searchUrl)
      const searchData = await searchResponse.json()

      if (searchData.status === 'OK' && searchData.results.length > 0) {
        const placeId = searchData.results[0].place_id

        // Get detailed info
        const fields = 'place_id,name,formatted_address,geometry,rating,user_ratings_total,price_level,formatted_phone_number,website,opening_hours,photos'
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
        const detailsResponse = await fetch(detailsUrl)
        const detailsData = await detailsResponse.json()

        if (detailsData.status === 'OK') {
          placeDetails = detailsData.result
        }
      }
    }

    if (placeDetails) {
      // Merge Google Places data
      restaurant.google_places = {
        place_id: placeDetails.place_id,
        google_name: placeDetails.name,
        google_url: `https://www.google.com/maps/place/?q=place_id:${placeDetails.place_id}`,
        enriched_at: new Date().toISOString()
      }

      if (placeDetails.geometry?.location) {
        restaurant.location = restaurant.location || {}
        restaurant.location.coordinates = {
          latitude: placeDetails.geometry.location.lat,
          longitude: placeDetails.geometry.location.lng
        }
      }

      if (placeDetails.formatted_address) {
        restaurant.location = restaurant.location || {}
        restaurant.location.full_address = placeDetails.formatted_address
      }

      if (placeDetails.rating) {
        restaurant.rating = {
          google_rating: placeDetails.rating,
          total_reviews: placeDetails.user_ratings_total || 0,
          price_level: placeDetails.price_level
        }
      }

      if (placeDetails.formatted_phone_number) {
        restaurant.contact_info = restaurant.contact_info || {}
        restaurant.contact_info.phone = placeDetails.formatted_phone_number
      }

      if (placeDetails.website) {
        restaurant.contact_info = restaurant.contact_info || {}
        restaurant.contact_info.website = placeDetails.website
      }

      if (placeDetails.photos && placeDetails.photos.length > 0) {
        restaurant.photos = placeDetails.photos.slice(0, 3).map(photo => {
          const ref = photo.photo_reference
          const isNewApi = ref && ref.startsWith('places/') && ref.includes('/photos/')
          return {
            photo_reference: ref,
            photo_url: isNewApi
              ? `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=400&key=${apiKey}`
              : `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${ref}&key=${apiKey}`,
            width: photo.width,
            height: photo.height
          }
        })
      }

      if (placeDetails.opening_hours) {
        restaurant.business_hours = {
          open_now: placeDetails.opening_hours.open_now,
          weekday_text: placeDetails.opening_hours.weekday_text || []
        }
      }

      restaurant.google_places_enriched = true
      restaurant.google_places_attempted = true

      // Save enriched data
      await fs.writeJson(filePath, restaurant, { spaces: 2 })

      console.log(`✅ Successfully enriched ${restaurant.name_hebrew || restaurant.name_english}`)

      res.json({
        message: 'Restaurant enriched successfully',
        restaurant,
        enriched: true,
        google_places: restaurant.google_places
      })
    } else {
      restaurant.google_places_enriched = false
      restaurant.google_places_attempted = true
      await fs.writeJson(filePath, restaurant, { spaces: 2 })

      console.log(`❌ Could not find Google Places data for ${restaurant.name_hebrew || restaurant.name_english}`)

      res.json({
        message: 'No Google Places data found',
        restaurant,
        enriched: false
      })
    }

  } catch (error) {
    console.error('Error enriching restaurant:', error)
    res.status(500).json({ error: 'Failed to enrich restaurant' })
  }
})

// Batch enrich all restaurants
app.post('/api/restaurants/enrich-all', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Places API key not configured' })
    }

    await fs.ensureDir(dataDir)
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))

    const stats = {
      total: jsonFiles.length,
      enriched: 0,
      skipped: 0,
      failed: 0
    }

    console.log(`🚀 Starting batch enrichment of ${stats.total} restaurants`)

    // Start background enrichment process
    const { spawn } = require('child_process')
    const pythonPath = path.join(__dirname, '..', 'scripts', 'enrich_restaurants.py')
    const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python')

    const python = spawn(venvPython, [pythonPath], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '..'),
        GOOGLE_PLACES_API_KEY: apiKey
      }
    })

    python.stdout.on('data', (data) => {
      console.log('📤 ENRICHMENT:', data.toString().trim())
    })

    python.stderr.on('data', (data) => {
      console.log('🚨 ENRICHMENT ERROR:', data.toString().trim())
    })

    python.on('close', (code) => {
      console.log(`🏁 Batch enrichment completed with exit code: ${code}`)
    })

    res.status(202).json({
      message: 'Batch enrichment started',
      status: 'processing',
      total_restaurants: stats.total
    })

  } catch (error) {
    console.error('Error starting batch enrichment:', error)
    res.status(500).json({ error: 'Failed to start batch enrichment' })
  }
})

// CHANNEL PROCESSING API ENDPOINTS
app.post('/api/analyze/channel', async (req, res) => {
  try {
    const { channel_url, filters = {}, processing_options = {} } = req.body
    
    if (!channel_url || (!channel_url.includes('youtube.com/channel') && !channel_url.includes('youtube.com/c/') && !channel_url.includes('youtube.com/user/') && !channel_url.includes('youtube.com/@'))) {
      return res.status(400).json({ error: 'Valid YouTube channel URL required' })
    }
    
    console.log('🚀 STARTING YOUTUBE CHANNEL ANALYSIS PROCESS')
    console.log('=' * 50)
    console.log(`📺 Channel URL: ${channel_url}`)
    console.log(`🔧 Filters: ${JSON.stringify(filters)}`)
    console.log(`⚙️ Options: ${JSON.stringify(processing_options)}`)
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`)
    
    // Start the Python channel analysis in the background
    const { spawn } = require('child_process')
    const pythonPath = path.join(__dirname, '..', 'scripts', 'process_channel.py')
    const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python')
    
    console.log(`🐍 Python script path: ${pythonPath}`)
    console.log(`🐍 Using venv Python: ${venvPython}`)
    
    // Prepare arguments for Python script
    const args = [
      pythonPath,
      '--channel_url', channel_url,
      '--max_results', (filters.max_results || 50).toString(),
      '--batch_size', (processing_options.batch_size || 5).toString()
    ]
    
    if (filters.date_from) args.push('--date_from', filters.date_from)
    if (filters.date_to) args.push('--date_to', filters.date_to)
    if (filters.min_views) args.push('--min_views', filters.min_views.toString())
    if (filters.min_duration_seconds) args.push('--min_duration_seconds', filters.min_duration_seconds.toString())
    if (processing_options.skip_existing !== undefined) args.push('--skip_existing', processing_options.skip_existing.toString())
    
    // Use virtual environment Python with proper activation
    const python = spawn(venvPython, args, {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        PYTHONPATH: path.join(__dirname, '..'),
        VIRTUAL_ENV: path.join(__dirname, '..', 'venv'),
        PATH: `${path.join(__dirname, '..', 'venv', 'bin')}:${process.env.PATH}`
      }
    })
    
    let output = ''
    let errorOutput = ''
    
    python.stdout.on('data', (data) => {
      const text = data.toString()
      output += text
      console.log('📤 PYTHON STDOUT:', text.trim())
    })
    
    python.stderr.on('data', (data) => {
      const text = data.toString()
      errorOutput += text
      console.log('🚨 PYTHON STDERR:', text.trim())
    })
    
    python.on('close', (code) => {
      console.log('🏁 PYTHON CHANNEL PROCESS COMPLETE')
      console.log('=' * 50)
      console.log(`📊 Exit Code: ${code}`)
      console.log(`📝 Total Output Length: ${output.length}`)
      console.log(`⚠️  Total Error Length: ${errorOutput.length}`)
      
      if (code === 0) {
        console.log('✅ Channel analysis completed successfully!')
        console.log('📁 Check data/restaurants/ for new restaurant files')
      } else {
        console.log('❌ Channel analysis failed!')
        console.log('🔍 Error output:', errorOutput.slice(0, 500) + '...')
      }
    })
    
    python.on('error', (error) => {
      console.log('💥 PYTHON CHANNEL PROCESS ERROR:', error.message)
    })
    
    // Generate job ID for tracking
    const jobId = uuidv4()
    
    res.status(202).json({ 
      job_id: jobId,
      message: 'Channel analysis started successfully',
      status: 'started',
      channel_url,
      filters,
      processing_options,
      estimated_duration_minutes: Math.ceil((filters.max_results || 50) * 2 / (processing_options.batch_size || 5))
    })
    
  } catch (error) {
    console.error('Error starting channel analysis:', error)
    res.status(500).json({ error: 'Failed to start channel analysis' })
  }
})

// Get job status endpoint
app.get('/api/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params
    
    // For now, return a mock status since we don't have persistent job tracking yet
    // In full implementation, this would query the Python batch processor
    res.json({
      job_id: jobId,
      status: 'processing',
      progress: {
        videos_completed: 5,
        videos_total: 20,
        videos_failed: 1,
        restaurants_found: 12,
        current_video: {
          title: 'Processing video...',
          progress: 'analyzing_transcript'
        }
      },
      estimated_completion: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      started_at: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error getting job status:', error)
    res.status(500).json({ error: 'Failed to get job status' })
  }
})

// Get job results endpoint  
app.get('/api/jobs/:jobId/results', async (req, res) => {
  try {
    const { jobId } = req.params
    
    // Mock results for now
    res.json({
      job_id: jobId,
      status: 'completed',
      summary: {
        videos_processed: 18,
        videos_failed: 2,
        restaurants_found: 45,
        processing_duration_minutes: 87
      },
      statistics: {
        top_cuisines: [
          { cuisine: 'Mediterranean', count: 12 },
          { cuisine: 'Italian', count: 8 }
        ],
        top_cities: [
          { city: 'Tel Aviv', count: 20 },
          { city: 'Jerusalem', count: 15 }
        ]
      },
      failed_videos: [
        {
          video_id: 'abc123',
          title: 'Video Title',
          error: 'Transcript not available'
        }
      ]
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
    
    // Mock cancellation for now
    console.log(`🛑 Cancelling job: ${jobId}`)
    
    res.json({
      job_id: jobId,
      status: 'cancelled',
      message: 'Job cancelled successfully'
    })
    
  } catch (error) {
    console.error('Error cancelling job:', error)
    res.status(500).json({ error: 'Failed to cancel job' })
  }
})

// List active jobs endpoint
app.get('/api/jobs', async (req, res) => {
  try {
    const { status } = req.query
    
    // Mock active jobs for now
    const mockJobs = [
      {
        job_id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'processing',
        channel_info: {
          channel_title: 'Food Channel',
          channel_id: 'UCtest123'
        },
        progress: {
          videos_completed: 15,
          videos_total: 50,
          percentage: 30.0
        },
        started_at: new Date().toISOString()
      }
    ]
    
    // Filter by status if specified
    let filteredJobs = mockJobs
    if (status) {
      filteredJobs = mockJobs.filter(job => job.status === status)
    }
    
    res.json({
      jobs: filteredJobs,
      count: filteredJobs.length
    })
    
  } catch (error) {
    console.error('Error listing jobs:', error)
    res.status(500).json({ error: 'Failed to list jobs' })
  }
})

app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body
    
    if (!url || !url.includes('youtube.com')) {
      return res.status(400).json({ error: 'Valid YouTube URL required' })
    }
    
    console.log('🚀 STARTING YOUTUBE ANALYSIS PROCESS')
    console.log('=' * 50)
    console.log(`📺 YouTube URL: ${url}`)
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`)
    
    // Start the Python analysis in the background
    const { spawn } = require('child_process')
    const pythonPath = path.join(__dirname, '..', 'scripts', 'main.py')
    const venvPython = path.join(__dirname, '..', 'venv', 'bin', 'python')
    
    console.log(`🐍 Python script path: ${pythonPath}`)
    console.log(`🐍 Using venv Python: ${venvPython}`)
    
    // Use virtual environment Python with proper activation
    const python = spawn(venvPython, [pythonPath, url], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        PYTHONPATH: path.join(__dirname, '..'),
        VIRTUAL_ENV: path.join(__dirname, '..', 'venv'),
        PATH: `${path.join(__dirname, '..', 'venv', 'bin')}:${process.env.PATH}`
      }
    })
    
    let output = ''
    let errorOutput = ''
    
    python.stdout.on('data', (data) => {
      const text = data.toString()
      output += text
      console.log('📤 PYTHON STDOUT:', text.trim())
    })
    
    python.stderr.on('data', (data) => {
      const text = data.toString()
      errorOutput += text
      console.log('🚨 PYTHON STDERR:', text.trim())
    })
    
    python.on('close', (code) => {
      console.log('🏁 PYTHON PROCESS COMPLETE')
      console.log('=' * 50)
      console.log(`📊 Exit Code: ${code}`)
      console.log(`📝 Total Output Length: ${output.length}`)
      console.log(`⚠️  Total Error Length: ${errorOutput.length}`)
      
      if (code === 0) {
        console.log('✅ Analysis completed successfully!')
        console.log('📁 Check data/restaurants/ for new restaurant files')
      } else {
        console.log('❌ Analysis failed!')
        console.log('🔍 Error output:', errorOutput.slice(0, 500) + '...')
      }
    })
    
    python.on('error', (error) => {
      console.log('💥 PYTHON PROCESS ERROR:', error.message)
    })
    
    res.status(202).json({ 
      message: 'Analysis started successfully', 
      status: 'processing',
      url 
    })
    
  } catch (error) {
    console.error('Error starting analysis:', error)
    res.status(500).json({ error: 'Failed to start analysis' })
  }
})

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

app.use((error, req, res, next) => {
  console.error('Server error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`Where2Eat API server running on http://localhost:${port}`)
})