/**
 * Migration script to move JSON data to PostgreSQL database
 */
const fs = require('fs-extra')
const path = require('path')
const { initializeDatabase, query, close } = require('./index')
const restaurantRepository = require('./repositories/restaurantRepository')
const episodeRepository = require('./repositories/episodeRepository')

const DATA_DIR = path.join(__dirname, '../../data/restaurants')
const BACKUP_DIR = path.join(__dirname, '../../data/restaurants_backup')

/**
 * Check if database already has data
 */
async function hasExistingData() {
  try {
    const result = await query('SELECT COUNT(*) as count FROM restaurants')
    return parseInt(result.rows[0].count) > 0
  } catch (error) {
    return false
  }
}

/**
 * Read all JSON restaurant files from a directory
 */
async function readJsonFiles(directory) {
  if (!await fs.pathExists(directory)) {
    return []
  }

  const files = await fs.readdir(directory)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  const restaurants = []
  for (const file of jsonFiles) {
    try {
      const data = await fs.readJson(path.join(directory, file))
      restaurants.push(data)
    } catch (error) {
      console.warn(`Warning: Failed to read ${file}: ${error.message}`)
    }
  }

  return restaurants
}

/**
 * Extract unique episodes from restaurant data
 */
function extractEpisodes(restaurants) {
  const episodeMap = new Map()

  for (const restaurant of restaurants) {
    if (restaurant.episode_info?.video_id) {
      const videoId = restaurant.episode_info.video_id
      if (!episodeMap.has(videoId)) {
        episodeMap.set(videoId, {
          video_id: videoId,
          title: restaurant.episode_info.title || `Episode ${videoId}`,
          channel_name: restaurant.episode_info.channel_name,
          channel_id: restaurant.episode_info.channel_id,
          video_url: restaurant.episode_info.video_url || `https://www.youtube.com/watch?v=${videoId}`,
          published_at: restaurant.episode_info.published_at,
          status: 'analyzed'
        })
      }
    }
  }

  return Array.from(episodeMap.values())
}

/**
 * Run the migration
 */
async function migrate(options = {}) {
  const { force = false, verbose = true } = options

  const log = verbose ? console.log : () => {}

  log('=' .repeat(60))
  log('JSON to PostgreSQL Migration')
  log('=' .repeat(60))

  try {
    // Initialize database schema
    log('\n1. Initializing database schema...')
    await initializeDatabase()
    log('   Schema initialized successfully')

    // Check for existing data
    log('\n2. Checking for existing data...')
    const hasData = await hasExistingData()

    if (hasData && !force) {
      log('   Database already has data. Use --force to overwrite.')
      log('   Skipping migration.')
      return { skipped: true, reason: 'existing_data' }
    }

    if (hasData && force) {
      log('   Force mode: will add to existing data')
    }

    // Find source data
    log('\n3. Looking for source data...')
    let sourceDir = DATA_DIR
    let restaurants = await readJsonFiles(DATA_DIR)

    if (restaurants.length === 0) {
      log(`   No data in ${DATA_DIR}, checking backup...`)
      restaurants = await readJsonFiles(BACKUP_DIR)
      sourceDir = BACKUP_DIR
    }

    if (restaurants.length === 0) {
      log('   No JSON data found to migrate.')
      return { skipped: true, reason: 'no_data' }
    }

    log(`   Found ${restaurants.length} restaurants in ${sourceDir}`)

    // Extract and migrate episodes first
    log('\n4. Migrating episodes...')
    const episodes = extractEpisodes(restaurants)
    log(`   Found ${episodes.length} unique episodes`)

    let episodesCreated = 0
    for (const episode of episodes) {
      try {
        await episodeRepository.create(episode)
        episodesCreated++
      } catch (error) {
        if (!error.message.includes('duplicate')) {
          console.warn(`   Warning: Failed to create episode ${episode.video_id}: ${error.message}`)
        }
      }
    }
    log(`   Created ${episodesCreated} episodes`)

    // Migrate restaurants
    log('\n5. Migrating restaurants...')
    let restaurantsCreated = 0
    let restaurantsFailed = 0

    for (const restaurant of restaurants) {
      try {
        await restaurantRepository.create(restaurant)
        restaurantsCreated++
        if (verbose && restaurantsCreated % 10 === 0) {
          log(`   Progress: ${restaurantsCreated}/${restaurants.length}`)
        }
      } catch (error) {
        restaurantsFailed++
        console.warn(`   Warning: Failed to create restaurant "${restaurant.name_hebrew || restaurant.name}": ${error.message}`)
      }
    }

    log(`\n   Created ${restaurantsCreated} restaurants`)
    if (restaurantsFailed > 0) {
      log(`   Failed: ${restaurantsFailed} restaurants`)
    }

    // Verify migration
    log('\n6. Verifying migration...')
    const dbCount = await restaurantRepository.count()
    log(`   Database now has ${dbCount} restaurants`)

    log('\n' + '=' .repeat(60))
    log('Migration completed successfully!')
    log('=' .repeat(60))

    return {
      success: true,
      episodesCreated,
      restaurantsCreated,
      restaurantsFailed,
      totalInDatabase: dbCount
    }

  } catch (error) {
    console.error('\nMigration failed:', error.message)
    throw error
  }
}

/**
 * Run migration on startup if needed
 */
async function migrateOnStartup() {
  try {
    const hasData = await hasExistingData()

    if (!hasData) {
      console.log('Database is empty, running initial migration...')
      await migrate({ verbose: true })
    } else {
      console.log('Database already has data, skipping migration')
    }
  } catch (error) {
    console.error('Startup migration failed:', error.message)
    // Don't throw - let the server continue even if migration fails
  }
}

// Run if called directly
if (require.main === module) {
  const force = process.argv.includes('--force')

  migrate({ force, verbose: true })
    .then(result => {
      console.log('\nResult:', result)
      return close()
    })
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error)
      process.exit(1)
    })
}

module.exports = { migrate, migrateOnStartup, hasExistingData }
