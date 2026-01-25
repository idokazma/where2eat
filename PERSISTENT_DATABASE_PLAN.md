# Persistent Database Plan for Where2Eat

## Executive Summary

The current system has a **critical data persistence issue**: all restaurant data is lost when the server restarts. This plan outlines how to implement a proper persistent database that survives deployments and restarts.

---

## Current State Analysis

### Problems Identified

| Issue | Severity | Current Behavior |
|-------|----------|------------------|
| No volume mount in Railway | **CRITICAL** | Container data lost on restart |
| SQLite database unused | **HIGH** | Full DB schema exists but API uses JSON files |
| Dual API servers | **HIGH** | Express.js (api/index.js) and FastAPI (api/main.py) coexist |
| JSON file-based storage | **HIGH** | Individual files in `data/restaurants/` are ephemeral |
| Mock job tracking | **MEDIUM** | Job progress not persisted |

### Current Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Express API    │────▶│  JSON Files     │
│   (Next.js)     │     │  (api/index.js)  │     │ data/restaurants│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        ⚠️ LOST ON RESTART

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Python CLI    │────▶│ Backend Service  │────▶│  SQLite DB      │
│  (scripts/cli)  │     │(backend_service) │     │ data/where2eat  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        ✓ NOT USED IN PROD
```

---

## Solution Architecture

### Target Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Express API    │────▶│  PostgreSQL     │
│   (Next.js)     │     │  (api/index.js)  │     │ (Railway Plugin)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │                        ▼                        │
        │               ┌──────────────────┐              │
        └──────────────▶│  Redis Cache     │◀─────────────┘
                        │ (Railway Plugin) │
                        └──────────────────┘
```

### Why PostgreSQL over SQLite?

| Factor | SQLite | PostgreSQL |
|--------|--------|------------|
| Railway support | Requires volume mount | Native plugin (free tier) |
| Concurrent connections | Limited | Excellent |
| Backup/restore | Manual | Automated |
| Scalability | Single file | Scales horizontally |
| Managed service | No | Yes (Railway provides) |

---

## Implementation Plan

### Phase 1: Database Setup (Priority: Critical)

#### Step 1.1: Add PostgreSQL to Railway

1. Open Railway dashboard
2. Click "New" → "Database" → "PostgreSQL"
3. Copy the `DATABASE_URL` connection string
4. Add to environment variables

**Expected environment variable:**
```
DATABASE_URL=postgresql://user:password@host:5432/railway
```

#### Step 1.2: Create Database Schema

Create new file: `api/db/schema.sql`

```sql
-- Episodes table (YouTube videos)
CREATE TABLE IF NOT EXISTS episodes (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(20) UNIQUE NOT NULL,
    title TEXT,
    channel_name TEXT,
    channel_id VARCHAR(30),
    published_at TIMESTAMP,
    transcript TEXT,
    transcript_language VARCHAR(10),
    duration_seconds INTEGER,
    view_count INTEGER,
    status VARCHAR(20) DEFAULT 'pending',
    analyzed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    cuisine_type VARCHAR(100),
    price_range VARCHAR(20),
    rating DECIMAL(2, 1),
    google_place_id VARCHAR(100),
    google_maps_url TEXT,
    phone VARCHAR(30),
    website TEXT,
    opening_hours JSONB,
    photos JSONB,
    source_episode_id INTEGER REFERENCES episodes(id),
    recommendation_context TEXT,
    recommendation_sentiment VARCHAR(20),
    mentioned_dishes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table (for tracking async operations)
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    input_data JSONB,
    result_data JSONB,
    error_message TEXT,
    progress INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine_type);
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_episodes_video_id ON episodes(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
```

#### Step 1.3: Install Node.js PostgreSQL Client

```bash
cd api
npm install pg
```

#### Step 1.4: Create Database Connection Module

Create new file: `api/db/index.js`

```javascript
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('Database connected');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

// Initialize schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    const fs = require('fs');
    const path = require('path');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Database schema initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };
```

---

### Phase 2: Data Access Layer

#### Step 2.1: Create Restaurant Repository

Create new file: `api/db/repositories/restaurantRepository.js`

```javascript
const { pool } = require('../index');

const restaurantRepository = {
  // Get all restaurants
  async findAll(filters = {}) {
    let query = 'SELECT * FROM restaurants WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.city) {
      query += ` AND city ILIKE $${paramIndex++}`;
      params.push(`%${filters.city}%`);
    }
    if (filters.cuisine) {
      query += ` AND cuisine_type ILIKE $${paramIndex++}`;
      params.push(`%${filters.cuisine}%`);
    }
    if (filters.minRating) {
      query += ` AND rating >= $${paramIndex++}`;
      params.push(filters.minRating);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get restaurant by ID
  async findById(id) {
    const result = await pool.query(
      'SELECT * FROM restaurants WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  // Create restaurant
  async create(restaurant) {
    const result = await pool.query(
      `INSERT INTO restaurants
       (name, address, city, latitude, longitude, cuisine_type,
        price_range, rating, google_place_id, google_maps_url,
        phone, website, opening_hours, photos, source_episode_id,
        recommendation_context, recommendation_sentiment, mentioned_dishes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        restaurant.name,
        restaurant.address,
        restaurant.city,
        restaurant.latitude,
        restaurant.longitude,
        restaurant.cuisine_type,
        restaurant.price_range,
        restaurant.rating,
        restaurant.google_place_id,
        restaurant.google_maps_url,
        restaurant.phone,
        restaurant.website,
        JSON.stringify(restaurant.opening_hours || {}),
        JSON.stringify(restaurant.photos || []),
        restaurant.source_episode_id,
        restaurant.recommendation_context,
        restaurant.recommendation_sentiment,
        JSON.stringify(restaurant.mentioned_dishes || [])
      ]
    );
    return result.rows[0];
  },

  // Update restaurant
  async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    const setClause = fields
      .map((field, i) => `${field} = $${i + 2}`)
      .join(', ');

    const result = await pool.query(
      `UPDATE restaurants SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  },

  // Delete restaurant
  async delete(id) {
    await pool.query('DELETE FROM restaurants WHERE id = $1', [id]);
  },

  // Search by location (geo query)
  async findNearby(lat, lng, radiusKm = 5) {
    const result = await pool.query(
      `SELECT *,
        (6371 * acos(cos(radians($1)) * cos(radians(latitude))
        * cos(radians(longitude) - radians($2))
        + sin(radians($1)) * sin(radians(latitude)))) AS distance
       FROM restaurants
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       HAVING distance < $3
       ORDER BY distance`,
      [lat, lng, radiusKm]
    );
    return result.rows;
  },

  // Bulk insert (for migration)
  async bulkCreate(restaurants) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const restaurant of restaurants) {
        await this.create(restaurant);
      }

      await client.query('COMMIT');
      return restaurants.length;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};

module.exports = restaurantRepository;
```

#### Step 2.2: Create Episode Repository

Create new file: `api/db/repositories/episodeRepository.js`

```javascript
const { pool } = require('../index');

const episodeRepository = {
  async findByVideoId(videoId) {
    const result = await pool.query(
      'SELECT * FROM episodes WHERE video_id = $1',
      [videoId]
    );
    return result.rows[0];
  },

  async create(episode) {
    const result = await pool.query(
      `INSERT INTO episodes
       (video_id, title, channel_name, channel_id, published_at,
        transcript, transcript_language, duration_seconds, view_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        episode.video_id,
        episode.title,
        episode.channel_name,
        episode.channel_id,
        episode.published_at,
        episode.transcript,
        episode.transcript_language,
        episode.duration_seconds,
        episode.view_count,
        episode.status || 'pending'
      ]
    );
    return result.rows[0];
  },

  async updateStatus(videoId, status) {
    const result = await pool.query(
      `UPDATE episodes SET status = $2, analyzed_at = CURRENT_TIMESTAMP
       WHERE video_id = $1 RETURNING *`,
      [videoId, status]
    );
    return result.rows[0];
  }
};

module.exports = episodeRepository;
```

#### Step 2.3: Create Job Repository

Create new file: `api/db/repositories/jobRepository.js`

```javascript
const { pool } = require('../index');

const jobRepository = {
  async create(jobType, inputData) {
    const result = await pool.query(
      `INSERT INTO jobs (job_type, input_data, status, started_at)
       VALUES ($1, $2, 'running', CURRENT_TIMESTAMP)
       RETURNING *`,
      [jobType, JSON.stringify(inputData)]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await pool.query(
      'SELECT * FROM jobs WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async updateProgress(id, progress) {
    await pool.query(
      'UPDATE jobs SET progress = $2 WHERE id = $1',
      [id, progress]
    );
  },

  async complete(id, resultData) {
    await pool.query(
      `UPDATE jobs SET status = 'completed', result_data = $2,
       completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id, JSON.stringify(resultData)]
    );
  },

  async fail(id, errorMessage) {
    await pool.query(
      `UPDATE jobs SET status = 'failed', error_message = $2,
       completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id, errorMessage]
    );
  }
};

module.exports = jobRepository;
```

---

### Phase 3: API Integration

#### Step 3.1: Update API Server Initialization

Update `api/index.js` to use PostgreSQL:

```javascript
// Add at top of file
const { pool, initializeDatabase } = require('./db');
const restaurantRepository = require('./db/repositories/restaurantRepository');
const episodeRepository = require('./db/repositories/episodeRepository');
const jobRepository = require('./db/repositories/jobRepository');

// Replace app.listen with:
async function startServer() {
  try {
    // Initialize database schema
    await initializeDatabase();

    // Migrate existing JSON data if needed
    await migrateJsonToDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

#### Step 3.2: Create Migration Script

Create new file: `api/db/migrate-json.js`

```javascript
const fs = require('fs');
const path = require('path');
const restaurantRepository = require('./repositories/restaurantRepository');
const { pool } = require('./index');

async function migrateJsonToDatabase() {
  const restaurantsDir = path.join(__dirname, '../../data/restaurants');
  const backupDir = path.join(__dirname, '../../data/restaurants_backup');

  // Check if we have restaurants in DB already
  const existing = await pool.query('SELECT COUNT(*) FROM restaurants');
  if (parseInt(existing.rows[0].count) > 0) {
    console.log('Database already has restaurants, skipping migration');
    return;
  }

  // Try backup dir first, then main dir
  const sourceDir = fs.existsSync(backupDir) &&
    fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).length > 0
      ? backupDir
      : restaurantsDir;

  if (!fs.existsSync(sourceDir)) {
    console.log('No JSON data to migrate');
    return;
  }

  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'));
  console.log(`Migrating ${files.length} restaurants from ${sourceDir}`);

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(sourceDir, file), 'utf8'));
      await restaurantRepository.create({
        name: data.name,
        address: data.address,
        city: data.city || extractCity(data.address),
        latitude: data.location?.lat,
        longitude: data.location?.lng,
        cuisine_type: data.cuisine_type,
        price_range: data.price_range,
        rating: data.rating,
        google_place_id: data.google_place_id,
        google_maps_url: data.google_maps_url,
        phone: data.phone,
        website: data.website,
        opening_hours: data.opening_hours,
        photos: data.photos,
        recommendation_context: data.recommendation_context,
        recommendation_sentiment: data.recommendation_sentiment,
        mentioned_dishes: data.mentioned_dishes
      });
    } catch (error) {
      console.error(`Failed to migrate ${file}:`, error.message);
    }
  }

  console.log('Migration complete');
}

function extractCity(address) {
  if (!address) return null;
  // Simple extraction - can be improved
  const parts = address.split(',');
  return parts.length > 1 ? parts[parts.length - 2].trim() : null;
}

module.exports = { migrateJsonToDatabase };
```

#### Step 3.3: Update API Endpoints

Replace JSON file operations with database calls in `api/index.js`:

```javascript
// GET /api/restaurants
app.get('/api/restaurants', async (req, res) => {
  try {
    const { city, cuisine, minRating, lat, lng, radius } = req.query;

    let restaurants;
    if (lat && lng) {
      restaurants = await restaurantRepository.findNearby(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(radius) || 5
      );
    } else {
      restaurants = await restaurantRepository.findAll({
        city,
        cuisine,
        minRating: minRating ? parseFloat(minRating) : null
      });
    }

    res.json(restaurants);
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

// GET /api/restaurants/:id
app.get('/api/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await restaurantRepository.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

// POST /api/analyze
app.post('/api/analyze', async (req, res) => {
  try {
    const { url } = req.body;

    // Create job in database
    const job = await jobRepository.create('video_analysis', { url });

    // Start async processing
    processVideoAsync(job.id, url);

    res.json({
      jobId: job.id,
      status: 'processing',
      message: 'Analysis started'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start analysis' });
  }
});

// GET /api/jobs/:id
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await jobRepository.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});
```

---

### Phase 4: Railway Deployment Configuration

#### Step 4.1: Update railway.json

```json
{
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

#### Step 4.2: Update Dockerfile for Node.js API

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY api/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy API code
COPY api/ ./

# Copy data directory structure (for initial migration)
COPY data/restaurants_backup ./data/restaurants_backup

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# Start server
CMD ["node", "index.js"]
```

#### Step 4.3: Add PostgreSQL Service in Railway

1. Go to Railway dashboard
2. Select your project
3. Click "New" → "Database" → "PostgreSQL"
4. Railway will automatically inject `DATABASE_URL` environment variable

#### Step 4.4: Environment Variables

Set in Railway dashboard:

```
DATABASE_URL=postgresql://... (auto-injected by Railway)
NODE_ENV=production
PORT=3001
```

---

### Phase 5: Testing and Validation

#### Step 5.1: Local Testing

```bash
# Start PostgreSQL locally (using Docker)
docker run --name where2eat-postgres \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=where2eat \
  -p 5432:5432 \
  -d postgres:15

# Set environment variable
export DATABASE_URL="postgresql://postgres:devpassword@localhost:5432/where2eat"

# Start API
cd api
npm run dev
```

#### Step 5.2: Test Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Get all restaurants
curl http://localhost:3001/api/restaurants

# Search by city
curl "http://localhost:3001/api/restaurants?city=Tel%20Aviv"

# Nearby restaurants
curl "http://localhost:3001/api/restaurants?lat=32.0853&lng=34.7818&radius=2"
```

#### Step 5.3: Restart Test

```bash
# Stop server
# Start server again
# Verify data persists
curl http://localhost:3001/api/restaurants
# Should return same data as before restart
```

---

### Phase 6: Optional Enhancements

#### 6.1: Add Redis Cache (Optional)

For improved performance, add Redis caching:

```bash
cd api
npm install redis
```

```javascript
// api/cache.js
const Redis = require('redis');

const redis = Redis.createClient({
  url: process.env.REDIS_URL
});

redis.on('error', (err) => console.log('Redis error:', err));
redis.connect();

async function getCached(key, fetchFn, ttlSeconds = 300) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fetchFn();
  await redis.setEx(key, ttlSeconds, JSON.stringify(data));
  return data;
}

module.exports = { redis, getCached };
```

#### 6.2: Add Database Backup Script

```bash
#!/bin/bash
# scripts/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backups/where2eat_$DATE.sql
echo "Backup created: backups/where2eat_$DATE.sql"
```

#### 6.3: Add Health Check Endpoint

```javascript
// In api/index.js
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');

    const restaurantCount = await pool.query('SELECT COUNT(*) FROM restaurants');

    res.json({
      status: 'healthy',
      database: 'connected',
      restaurantCount: parseInt(restaurantCount.rows[0].count),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});
```

---

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Add PostgreSQL to Railway
- [ ] Create database schema file
- [ ] Install `pg` npm package
- [ ] Create database connection module

### Phase 2: Data Access Layer
- [ ] Create restaurant repository
- [ ] Create episode repository
- [ ] Create job repository
- [ ] Test repositories locally

### Phase 3: API Integration
- [ ] Update API server initialization
- [ ] Create JSON to PostgreSQL migration script
- [ ] Update all API endpoints to use repositories
- [ ] Remove JSON file operations

### Phase 4: Deployment
- [ ] Update railway.json
- [ ] Update Dockerfile
- [ ] Configure environment variables
- [ ] Deploy and verify

### Phase 5: Testing
- [ ] Test locally with Docker PostgreSQL
- [ ] Test all endpoints
- [ ] Verify data persists after restart
- [ ] Load test with realistic traffic

### Phase 6: Optional
- [ ] Add Redis cache
- [ ] Set up automated backups
- [ ] Add monitoring/alerting

---

## Estimated File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/package.json` | Modify | Add `pg` dependency |
| `api/db/schema.sql` | Create | Database schema |
| `api/db/index.js` | Create | Connection pool |
| `api/db/repositories/restaurantRepository.js` | Create | Restaurant CRUD |
| `api/db/repositories/episodeRepository.js` | Create | Episode CRUD |
| `api/db/repositories/jobRepository.js` | Create | Job tracking |
| `api/db/migrate-json.js` | Create | Migration script |
| `api/index.js` | Modify | Use database instead of JSON |
| `Dockerfile` | Modify | Update for Node.js API |
| `railway.json` | Modify | Add health check |

---

## Rollback Plan

If issues occur after deployment:

1. Railway allows instant rollback to previous deployment
2. JSON backup files remain in `data/restaurants_backup/`
3. Database can be dropped and recreated with migration script

---

## Summary

This plan converts Where2Eat from ephemeral JSON file storage to a persistent PostgreSQL database. The key benefits are:

1. **Data survives restarts** - PostgreSQL is managed by Railway
2. **Better performance** - Connection pooling and indexing
3. **Real job tracking** - Jobs persisted in database
4. **Scalability** - PostgreSQL handles concurrent connections
5. **Backup/restore** - Railway provides automated backups

Total estimated effort: Medium (can be completed incrementally)
