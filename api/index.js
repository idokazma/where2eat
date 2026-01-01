const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const fs = require('fs-extra')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 3001

app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json())

const dataDir = path.join(__dirname, '..', 'data', 'restaurants')

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.get('/api/restaurants', async (req, res) => {
  try {
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
    
    res.json({ restaurants, count: restaurants.length })
  } catch (error) {
    console.error('Error loading restaurants:', error)
    res.status(500).json({ error: 'Failed to load restaurants' })
  }
})

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