# Where2Eat - Restaurant Discovery System

Intelligent web scraping system using autonomous agents to discover trending restaurants from YouTube, Instagram & Facebook. Analyzes social buzz, delivers location-based recommendations with details.

## 🚀 Features

- **🎥 YouTube Podcast Analysis**: Extracts restaurant mentions from Hebrew food podcasts
- **🗺️ Location Intelligence**: Precise coordinates and Google Business integration  
- **📸 Visual Content**: Automated collection of restaurant logos and dish photos
- **🗂️ Structured Data**: Individual JSON files for each restaurant with rich metadata
- **📍 Map Integration**: Ready-to-use map visualizations (Google Maps, Leaflet)
- **🔍 Search Capabilities**: Advanced restaurant search and discovery
- **🌐 Web Interface**: Modern React dashboard for browsing results
- **🧪 Test-Driven Development**: 100% TDD compliance for all new features

## 📁 Project Structure

```
where2eat/
├── src/                          # Core Python modules
│   ├── __init__.py              # Package initialization  
│   ├── youtube_transcript_collector.py    # YouTube transcript fetching
│   ├── restaurant_analyzer.py             # Restaurant analysis pipeline
│   ├── restaurant_search_agent.py         # Enhanced search capabilities
│   ├── restaurant_location_collector.py   # Location & Google Business data
│   ├── restaurant_image_collector.py      # Image collection system
│   ├── map_integration.py                 # Map visualization system
│   └── restaurant_pipeline.py             # Basic pipeline utilities
├── scripts/                     # Entry points and utilities
│   └── main.py                 # Main demo script
├── tests/                      # All test files
│   ├── test_transcript_collector.py
│   ├── test_restaurant_search_agent.py
│   └── test_with_mock.py
├── data/                       # Generated and processed data
│   ├── restaurants/            # Individual restaurant JSON files
│   ├── transcripts/            # Raw YouTube transcript data
│   └── analyses/               # Processed restaurant analysis
├── web/                        # Frontend Next.js application
│   ├── src/                    # React components and pages
│   ├── public/                 # Static assets
│   └── package.json            # Frontend dependencies
├── docs/                       # Project documentation
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT_PLAN.md
│   ├── PRD.md
│   └── TECH_SPECS.md
├── restaurant_images/          # Generated image search data
├── restaurant_locations/       # Generated location search data
├── map_integration/            # Map integration outputs
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+ (for web interface)
- Virtual environment (recommended)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd where2eat
   ```

2. **Set up Python environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Install web dependencies**:
   ```bash
   cd web
   npm install
   cd ..
   ```

### Usage

#### 🎯 Analyze YouTube Podcasts

```bash
# Single podcast analysis
python scripts/main.py 'https://www.youtube.com/watch?v=VIDEO_ID'

# Multiple podcasts
python scripts/main.py 'URL1' 'URL2' 'URL3'
```

#### 📍 Collect Restaurant Locations

```bash
# Batch location collection for all restaurants
python src/restaurant_location_collector.py --batch data/restaurants/

# Single restaurant location
python src/restaurant_location_collector.py 'Restaurant Name' 'City' 'Hebrew Name'
```

#### 📸 Gather Restaurant Images

```bash
# Batch image collection
python src/restaurant_image_collector.py --batch data/restaurants/

# Single restaurant images
python src/restaurant_image_collector.py 'Restaurant Name' 'City' 'Hebrew Name'
```

#### 🗺️ Create Map Integration

```bash
# Generate map-ready files
python src/map_integration.py data/restaurants/ restaurant_locations/results/
```

#### 🌐 Launch Web Interface

```bash
cd web
npm run dev
```

Visit `http://localhost:3000` to view the restaurant dashboard.

## 📊 Output Files

### Restaurant Data (`data/restaurants/`)
Individual JSON files for each restaurant:
```json
{
  "name_hebrew": "מרי פוסה",
  "name_english": "Mary Posa", 
  "location": "Caesarea, Golf area",
  "cuisine_type": "Thai-Mediterranean fusion",
  "description": "...",
  "hosts_opinions": "...",
  "dishes_mentioned": ["pad thai", "shakshuka fusion"],
  "chef": "Chef Name",
  "special_features": ["outdoor seating", "sea view"],
  "source": "YouTube video ID",
  "transcript_timestamp": "2026-01-01"
}
```

### Location Data (`restaurant_locations/results/`)
Precise coordinates and Google Business info:
```json
{
  "restaurant_name": "Mary Posa",
  "coordinates": {"latitude": 32.5, "longitude": 34.9},
  "google_business": {
    "place_id": "ChIJ...",
    "maps_url": "https://maps.google.com/...",
    "rating": 4.5,
    "review_count": 127
  }
}
```

### Map Integration (`map_integration/`)
- **GeoJSON files** for any mapping library
- **HTML demos** for Google Maps and Leaflet
- **Interactive maps** with restaurant popups

## 🛠️ Development

### 🧪 Test-Driven Development (TDD)

**🚨 MANDATORY: All development must follow TDD principles**

#### TDD Workflow (Red-Green-Refactor):
1. **🔴 Red**: Write a failing test that describes desired functionality
2. **🟢 Green**: Write minimal code to make the test pass  
3. **🔵 Refactor**: Improve code while keeping all tests passing

#### TDD Requirements:
- **Write tests FIRST** for all new features and bug fixes
- **No code without tests** - commits rejected without corresponding tests
- **Maintain >90% test coverage** for all new code
- **Test edge cases and error conditions** comprehensively

#### TDD Example:
```python
# Step 1: Write failing test first
def test_validate_restaurant_name_rejects_empty():
    validator = RestaurantValidator()
    with pytest.raises(ValueError):
        validator.validate_name("")

# Step 2: Make test pass
class RestaurantValidator:
    def validate_name(self, name: str) -> bool:
        if not name:
            raise ValueError("Name cannot be empty")
        return True

# Step 3: Refactor while tests pass
```

### Running Tests

```bash
# Run all tests
python -m pytest tests/

# Run with coverage (minimum 90%)
python -m pytest tests/ --cov=src --cov-report=html --cov-fail-under=90

# TDD watch mode (re-run tests on file changes)
python -m pytest tests/ --looponfail
```

### Code Style

The project follows PEP 8 and uses:
- **TDD**: Test-Driven Development (mandatory)
- **Formatting**: Black
- **Linting**: Ruff
- **Type hints**: Required for all functions
- **Test Coverage**: >90% for all new code

### Adding New Features (TDD Process)

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Write failing tests first**: Follow Red-Green-Refactor cycle
3. **Implement minimal code**: Make tests pass
4. **Refactor**: Improve code while maintaining test coverage
5. **Verify TDD compliance**: All tests pass, >90% coverage
6. **Update documentation**: Include TDD examples
7. **Submit pull request**: Evidence of TDD process required

### Documentation

- **📚 [TDD Guidelines](docs/TDD_GUIDELINES.md)**: Comprehensive TDD requirements
- **🏗️ [Development Plan](docs/DEVELOPMENT_PLAN.md)**: Sprint structure and TDD mandate
- **🧪 [Testing Strategy](docs/TESTING_STRATEGY.md)**: Testing principles and TDD enforcement

## 🏗️ Architecture

### Core Components

1. **YouTube Transcript Collector**: Fetches and processes video transcripts
2. **Restaurant Analyzer**: Extracts restaurant information using AI
3. **Location Collector**: Gathers precise coordinates and business data
4. **Image Collector**: Finds restaurant photos and logos
5. **Map Integration**: Creates interactive map visualizations
6. **Web Interface**: React dashboard for browsing results

### Data Flow

```
YouTube URL → Transcript → AI Analysis → Restaurant Data → Location/Images → Map Integration → Web UI
```

### Technology Stack

**Backend**: Python 3.9+, YouTube Transcript API, Google Places API  
**AI/ML**: Claude API for restaurant extraction and analysis  
**Frontend**: Next.js, React, TypeScript, Tailwind CSS  
**Maps**: Google Maps API, Leaflet/OpenStreetMap  
**Data**: JSON files, structured restaurant database  

## 📝 API Reference

### YouTube Transcript Collector

```python
from src import YouTubeTranscriptCollector

collector = YouTubeTranscriptCollector()
result = collector.get_transcript(video_url, languages=['he', 'en'])
```

### Restaurant Search Agent

```python  
from src import RestaurantSearchAgent

agent = RestaurantSearchAgent()
info = agent.search_restaurant("Restaurant Name", "City")
```

### Map Integration

```python
from src import MapIntegration

integrator = MapIntegration()
results = integrator.create_complete_integration_package(
    restaurant_data_dir, location_data_dir
)
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- YouTube Transcript API for transcript access
- Google Maps Platform for location services
- Claude AI for restaurant analysis
- OpenStreetMap for open map data

## 📧 Contact

For questions or support, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for discovering great restaurants through podcast analysis**