const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// Track connection status
let isConnected = false

// Log connection events
pool.on('connect', () => {
  if (!isConnected) {
    console.log('Database pool connected')
    isConnected = true
  }
})

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err)
  isConnected = false
})

/**
 * Test the database connection
 */
async function testConnection() {
  try {
    const client = await pool.connect()
    await client.query('SELECT 1')
    client.release()
    return true
  } catch (error) {
    console.error('Database connection test failed:', error.message)
    return false
  }
}

/**
 * Initialize the database schema
 */
async function initializeDatabase() {
  const client = await pool.connect()
  try {
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    await client.query(schema)
    console.log('Database schema initialized successfully')
    return true
  } catch (error) {
    console.error('Failed to initialize database schema:', error.message)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Execute a query with parameters
 */
async function query(text, params) {
  const start = Date.now()
  try {
    const result = await pool.query(text, params)
    const duration = Date.now() - start
    if (duration > 1000) {
      console.log('Slow query:', { text: text.substring(0, 100), duration, rows: result.rowCount })
    }
    return result
  } catch (error) {
    console.error('Query error:', { text: text.substring(0, 100), error: error.message })
    throw error
  }
}

/**
 * Get a client for transactions
 */
async function getClient() {
  const client = await pool.connect()
  return client
}

/**
 * Execute a transaction
 */
async function transaction(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Get database health info
 */
async function getHealth() {
  try {
    const result = await query('SELECT COUNT(*) as count FROM restaurants')
    const restaurantCount = parseInt(result.rows[0].count)

    const episodeResult = await query('SELECT COUNT(*) as count FROM episodes')
    const episodeCount = parseInt(episodeResult.rows[0].count)

    return {
      status: 'healthy',
      connected: true,
      restaurantCount,
      episodeCount,
      poolSize: pool.totalCount,
      poolIdle: pool.idleCount,
      poolWaiting: pool.waitingCount
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      connected: false,
      error: error.message
    }
  }
}

/**
 * Gracefully close the pool
 */
async function close() {
  await pool.end()
  console.log('Database pool closed')
}

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection,
  initializeDatabase,
  getHealth,
  close
}
