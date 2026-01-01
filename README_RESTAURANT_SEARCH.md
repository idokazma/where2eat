# Restaurant Search Agent

A professional Python agent that prepares comprehensive web search requests for finding restaurant information including location, images, descriptions, and reviews.

## Overview

The Restaurant Search Agent integrates with Claude Code's Task agent to systematically search the internet for detailed restaurant information. It creates structured search requests and manages results in both JSON and human-readable formats.

## Features

- **Comprehensive Search Strategy**: Searches official websites, review platforms, social media, and news sources
- **Structured Data Model**: Uses type-safe dataclasses for restaurant information
- **Professional Logging**: Structured logging with configurable levels
- **Error Handling**: Robust error handling with detailed exception messages
- **Batch Processing**: Search multiple restaurants with progress tracking
- **File Management**: Automatic file sanitization and organized results storage

## Quick Start

### Single Restaurant Search

```python
from restaurant_search_agent import RestaurantSearchAgent

# Initialize the agent
agent = RestaurantSearchAgent()

# Search for a restaurant
restaurant_info = agent.search_restaurant("Ramen Heaven", "Austin")

# Save results
agent.save_restaurant_results(restaurant_info)
```

### Command Line Usage

```bash
# Search with city filter
python restaurant_search_agent.py "Ramen Heaven" "Austin"

# Search without city
python restaurant_search_agent.py "Joe Allen Restaurant"
```

### Batch Search

```python
restaurants = ["Restaurant A", "Restaurant B", "Restaurant C"]
results = agent.search_multiple_restaurants(restaurants, "Austin")

for name, info in results.items():
    if info:
        print(f"✅ Found: {name}")
    else:
        print(f"❌ Failed: {name}")
```

## Integration with Claude Code

The agent is designed to work with Claude Code's Task agent:

1. **Prepare Search Request**: The agent creates a detailed search prompt
2. **Execute with Task Agent**: Use Claude Code's Task tool with `general-purpose` subagent
3. **Process Results**: Parse and structure the findings

### Example Claude Code Workflow

```python
# 1. Prepare the search
agent = RestaurantSearchAgent()
restaurant_info = agent.search_restaurant("Restaurant Name", "City")

# 2. Use Claude Code Task agent with the prepared request file
# (The request file contains the detailed search instructions)

# 3. Parse agent results and update RestaurantInfo object
# 4. Save final results
agent.save_restaurant_results(updated_restaurant_info)
```

## Data Model

### RestaurantInfo

```python
@dataclass
class RestaurantInfo:
    name: str                           # Required
    location: Optional[str] = None      # City/area
    address: Optional[str] = None       # Full address
    cuisine_type: Optional[str] = None  # e.g., "Italian", "Asian Fusion"
    description: Optional[str] = None   # Restaurant description
    phone: Optional[str] = None         # Phone number
    website: Optional[str] = None       # Official website
    hours: Optional[str] = None         # Operating hours
    price_range: Optional[str] = None   # e.g., "$$", "$$$"
    images: List[str] = []             # Image URLs
    rating: Optional[str] = None        # Average rating
    reviews_summary: Optional[str] = None  # Review summary
```

## Search Strategy

The agent creates comprehensive search requests that include:

### 1. Basic Information
- Full restaurant name
- Complete address with zip code
- Phone number and website
- Hours of operation

### 2. Location Details
- Neighborhood/area information
- Nearby landmarks
- Parking and transportation info

### 3. Restaurant Details
- Cuisine type and dining style
- Price range and special features
- Notable menu items and chef info

### 4. Reviews & Ratings
- Ratings from multiple platforms
- Review summaries and trends
- Common praise and criticisms

### 5. Visual Content
- High-quality food photos
- Interior/exterior photos
- Menu and branding images

### 6. Additional Information
- Reservation requirements
- Delivery options
- Dietary accommodations
- Recent news and awards

## File Organization

```
restaurant_searches/
├── Restaurant_Name_20260101_120000_search_request.txt
├── Restaurant_Name_20260101_120000_results.json
├── Restaurant_Name_20260101_120000_summary.txt
└── batch_search_Austin_20260101_120000_summary.txt
```

### File Types

- **`*_search_request.txt`**: Detailed search prompt for Claude Code Task agent
- **`*_results.json`**: Structured JSON data with all restaurant information
- **`*_summary.txt`**: Human-readable summary of results
- **`batch_search_*.txt`**: Summary of batch operation results

## Configuration

### Logging

```python
# Set logging level
import logging
logging.getLogger('RestaurantSearchAgent').setLevel(logging.DEBUG)

# Custom results directory
agent = RestaurantSearchAgent(results_dir="my_custom_directory")
```

### Search Customization

The search request template can be customized by modifying the `_create_search_request` method to include:

- Specific platforms to prioritize
- Additional information fields
- Custom search queries
- Region-specific requirements

## Error Handling

The agent includes comprehensive error handling:

```python
try:
    restaurant_info = agent.search_restaurant("Restaurant Name")
except ValueError as e:
    print(f"Invalid input: {e}")
except OSError as e:
    print(f"File operation failed: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Testing

Run the comprehensive test suite:

```bash
python -m pytest test_restaurant_search_agent.py -v
```

### Test Coverage

- Unit tests for all public methods
- Integration tests for full workflows
- Error condition testing
- File operation testing
- Batch processing validation

## Performance Considerations

- **File I/O**: Results are written incrementally to avoid memory issues
- **Logging**: Structured logging with appropriate levels for production
- **Error Recovery**: Batch operations continue on individual failures
- **Memory Usage**: Minimal memory footprint for large batch operations

## Dependencies

- Python 3.8+
- `pathlib` (built-in)
- `logging` (built-in)
- `json` (built-in)
- `datetime` (built-in)
- `typing` (built-in)

No external dependencies required.

## Contributing

When contributing to the restaurant search agent:

1. **Follow PEP 8** style guidelines
2. **Add type hints** for all function parameters and returns
3. **Include docstrings** using Google style
4. **Write tests** for new functionality
5. **Update logging** with appropriate levels

### Code Style

```python
def method_name(self, param: str, optional_param: Optional[str] = None) -> ReturnType:
    """Brief description of what this method does.
    
    Args:
        param: Description of required parameter
        optional_param: Description of optional parameter
        
    Returns:
        Description of return value
        
    Raises:
        ExceptionType: When this exception is raised
    """
    pass
```

## License

This code is part of the Where2Eat project and follows the project's licensing terms.

## Troubleshooting

### Common Issues

**"Restaurant name cannot be empty"**
- Ensure the restaurant name is not an empty string or whitespace

**File permission errors**
- Check write permissions for the results directory
- Ensure the directory path is valid

**Search request not detailed enough**
- Review the `_create_search_request` method
- Add more specific search queries for your use case

**Batch operations failing**
- Check individual restaurant name validity
- Review disk space for results storage
- Monitor memory usage for large batches

### Debug Mode

Enable debug logging to troubleshoot issues:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

agent = RestaurantSearchAgent()
# Debug messages will now be displayed
```

## Future Enhancements

Planned improvements for the restaurant search agent:

- **Auto-retry logic** for failed searches
- **Caching mechanism** to avoid duplicate searches
- **Result validation** against known restaurant databases
- **Multi-language support** for international restaurants
- **API integration** with restaurant databases
- **Machine learning** for improved result parsing