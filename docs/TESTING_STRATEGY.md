# Testing Strategy
## Restaurant Trend Scout

**Document Version:** 1.0
**Last Updated:** 2026-01-01
**Owner:** QA & Engineering Team
**Status:** Draft

---

## Overview

This document outlines the comprehensive testing strategy for Restaurant Trend Scout, covering unit testing, integration testing, end-to-end testing, performance testing, and security testing. The strategy ensures high code quality, system reliability, and excellent user experience.

---

## Testing Principles

### Core Principles
1. **Test Early, Test Often**: Write tests alongside code
2. **Automation First**: Automated tests over manual where possible
3. **Test Pyramid**: More unit tests, fewer E2E tests
4. **Shift Left**: Catch bugs early in development
5. **Continuous Testing**: Tests run on every commit
6. **Quality Gates**: No deploy without passing tests

### Quality Targets
- **Code Coverage**: >80% backend, >70% frontend
- **Test Success Rate**: >99% (on main branch)
- **Test Execution Time**: <5 minutes (unit + integration)
- **Flaky Test Rate**: <1%
- **Bug Escape Rate**: <5% (bugs found in production)

---

## Test Pyramid

```
            E2E (5%)
         ┌──────────┐
         │  Cypress │
         │  10 tests│
         └──────────┘
      Integration (15%)
    ┌──────────────────┐
    │  pytest + API    │
    │  50 tests        │
    └──────────────────┘
    Unit Tests (80%)
┌────────────────────────┐
│  pytest + Jest         │
│  300+ tests            │
└────────────────────────┘
```

**Distribution**:
- **Unit Tests (80%)**: Fast, isolated, high volume
- **Integration Tests (15%)**: API, database, external services
- **E2E Tests (5%)**: Critical user flows, UI + API

---

## Unit Testing

### Backend Unit Testing (Python)

#### Framework & Tools
- **Framework**: pytest 7.4+
- **Mocking**: unittest.mock, pytest-mock
- **Coverage**: pytest-cov
- **Fixtures**: pytest fixtures
- **Assertions**: pytest assertions

#### Test Structure
```python
# tests/unit/test_trend_calculator.py
import pytest
from unittest.mock import Mock, MagicMock
from analytics.trend_calculator import TrendCalculator

class TestTrendCalculator:
    """Test suite for TrendCalculator."""

    @pytest.fixture
    def calculator(self, mock_db):
        """Fixture for TrendCalculator instance."""
        return TrendCalculator(mock_db)

    @pytest.fixture
    def mock_db(self):
        """Mock database connection."""
        db = Mock()
        db.execute = Mock(return_value=[])
        return db

    def test_calculate_mention_velocity_positive_growth(self, calculator):
        """Test mention velocity with positive growth."""
        recent = [Mock() for _ in range(20)]
        prior = [Mock() for _ in range(10)]

        velocity = calculator._calculate_mention_velocity(recent, prior)

        # 100% growth: (20-10)/10 = 1.0, normalized to 0.33
        assert velocity == pytest.approx(0.333, rel=0.01)

    def test_calculate_mention_velocity_new_restaurant(self, calculator):
        """Test mention velocity for new restaurant."""
        recent = [Mock() for _ in range(10)]
        prior = []

        velocity = calculator._calculate_mention_velocity(recent, prior)

        assert velocity == 1.0

    def test_calculate_mention_velocity_declining(self, calculator):
        """Test mention velocity with negative growth."""
        recent = [Mock() for _ in range(5)]
        prior = [Mock() for _ in range(10)]

        velocity = calculator._calculate_mention_velocity(recent, prior)

        assert velocity == 0.0  # Negative growth capped at 0

    def test_calculate_engagement_rate_typical(self, calculator):
        """Test engagement rate calculation."""
        mentions = [
            {
                'likes': 100,
                'comments': 50,
                'shares': 25,
                'user_followers': 10000
            },
            {
                'likes': 200,
                'comments': 100,
                'shares': 50,
                'user_followers': 20000
            }
        ]

        rate = calculator._calculate_engagement_rate(mentions)

        # (175 + 350) / 30000 = 0.0175
        # Normalized: 0.0175 / 0.10 = 0.175
        assert rate == pytest.approx(0.175, rel=0.01)

    def test_calculate_engagement_rate_no_followers(self, calculator):
        """Test engagement rate when no followers."""
        mentions = [
            {'likes': 100, 'comments': 50, 'shares': 25, 'user_followers': 0}
        ]

        rate = calculator._calculate_engagement_rate(mentions)

        assert rate == 0.0

    @pytest.mark.parametrize("sentiment,expected", [
        (1.0, 1.0),    # Perfect positive
        (0.0, 0.5),    # Neutral
        (-1.0, 0.0),   # Perfect negative
        (0.5, 0.75),   # Moderately positive
    ])
    def test_calculate_sentiment_score(self, calculator, sentiment, expected):
        """Test sentiment score normalization."""
        mentions = [{'sentiment_score': sentiment}]

        score = calculator._calculate_sentiment_score(mentions)

        assert score == pytest.approx(expected, abs=0.01)
```

#### Coverage Requirements
**Minimum 80% overall**, with specific focus on:
- Business logic: >90%
- Trend algorithms: >95%
- Data processing: >85%
- API endpoints: >80%
- Utilities: >75%

**Run coverage**:
```bash
pytest --cov=. --cov-report=html --cov-report=term
```

---

### Frontend Unit Testing (TypeScript/React)

#### Framework & Tools
- **Framework**: Jest 29+
- **Component Testing**: React Testing Library
- **Mocking**: jest.mock
- **Coverage**: jest --coverage

#### Test Structure
```typescript
// tests/components/RestaurantCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RestaurantCard } from '@/components/RestaurantCard';
import { mockRestaurant, mockTrend } from '../mocks';

describe('RestaurantCard', () => {
  const defaultProps = {
    restaurant: mockRestaurant(),
    trend: mockTrend(),
    onBookmark: jest.fn(),
  };

  it('renders restaurant name and cuisine', () => {
    render(<RestaurantCard {...defaultProps} />);

    expect(screen.getByText(defaultProps.restaurant.name)).toBeInTheDocument();
    expect(screen.getByText('Japanese, Ramen')).toBeInTheDocument();
  });

  it('displays trend score with correct category', () => {
    const props = {
      ...defaultProps,
      trend: { ...mockTrend(), score: 0.85, category: 'hot' }
    };
    render(<RestaurantCard {...props} />);

    expect(screen.getByText(/0.85/)).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument(); // Hot indicator
  });

  it('calls onBookmark when bookmark button clicked', () => {
    const onBookmark = jest.fn();
    render(<RestaurantCard {...defaultProps} onBookmark={onBookmark} />);

    fireEvent.click(screen.getByLabelText('Bookmark'));

    expect(onBookmark).toHaveBeenCalledWith(defaultProps.restaurant.id);
  });

  it('shows loading state while data fetching', () => {
    const props = { ...defaultProps, isLoading: true };
    render(<RestaurantCard {...props} />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('handles missing data gracefully', () => {
    const props = {
      ...defaultProps,
      restaurant: { ...mockRestaurant(), phone: null, website: null }
    };
    render(<RestaurantCard {...props} />);

    expect(screen.queryByText(/\(\d{3}\)/)).not.toBeInTheDocument();
  });
});

// tests/hooks/useTrends.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useTrends } from '@/hooks/useTrends';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('useTrends', () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches trends successfully', async () => {
    const { result } = renderHook(
      () => useTrends({ latitude: 30.26, longitude: -97.74 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data.trends).toHaveLength(20);
  });

  it('handles fetch error', async () => {
    // Mock API error
    const { result } = renderHook(
      () => useTrends({ latitude: 999, longitude: 999 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error.message).toContain('Invalid location');
  });
});
```

#### Coverage Requirements
**Minimum 70% overall**:
- Components: >75%
- Hooks: >80%
- Utilities: >70%
- State management: >75%

---

## Integration Testing

### Backend Integration Tests

#### Database Integration
```python
# tests/integration/test_database.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Restaurant, SocialPost

@pytest.fixture(scope="function")
def db_session():
    """Create test database session."""
    engine = create_engine("postgresql://localhost/test_db")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    Base.metadata.drop_all(engine)

def test_create_restaurant(db_session):
    """Test creating a restaurant record."""
    restaurant = Restaurant(
        name="Test Ramen",
        city="Austin",
        state="TX",
        latitude=30.26,
        longitude=-97.74
    )
    db_session.add(restaurant)
    db_session.commit()

    retrieved = db_session.query(Restaurant).filter_by(name="Test Ramen").first()
    assert retrieved is not None
    assert retrieved.city == "Austin"

def test_geospatial_query(db_session):
    """Test geospatial distance query."""
    # Create test restaurants
    r1 = Restaurant(name="Close", latitude=30.26, longitude=-97.74)
    r2 = Restaurant(name="Far", latitude=40.71, longitude=-74.00)
    db_session.add_all([r1, r2])
    db_session.commit()

    # Query within 10 miles of Austin
    results = db_session.query(Restaurant).filter(
        func.earth_distance(
            func.ll_to_earth(30.26, -97.74),
            func.ll_to_earth(Restaurant.latitude, Restaurant.longitude)
        ) < 16093  # 10 miles in meters
    ).all()

    assert len(results) == 1
    assert results[0].name == "Close"

def test_restaurant_mentions_relationship(db_session):
    """Test restaurant-post relationship."""
    restaurant = Restaurant(name="Test", city="Austin", state="TX")
    post = SocialPost(platform="instagram", post_id="123", content="Great food!")
    mention = RestaurantMention(restaurant=restaurant, post=post, confidence=0.95)

    db_session.add_all([restaurant, post, mention])
    db_session.commit()

    # Query mentions for restaurant
    mentions = db_session.query(RestaurantMention).filter_by(
        restaurant_id=restaurant.id
    ).all()

    assert len(mentions) == 1
    assert mentions[0].post.content == "Great food!"
```

#### API Integration Tests
```python
# tests/integration/test_api.py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_get_trends_success():
    """Test successful trends retrieval."""
    response = client.get(
        "/v1/trends",
        params={
            "latitude": 30.26,
            "longitude": -97.74,
            "radius_miles": 10
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "trends" in data
    assert len(data["trends"]) > 0
    assert data["total"] > 0

def test_get_trends_missing_location():
    """Test trends endpoint with missing location."""
    response = client.get("/v1/trends")

    assert response.status_code == 400
    assert "location" in response.json()["message"].lower()

def test_get_restaurant_detail():
    """Test restaurant detail retrieval."""
    response = client.get("/v1/restaurants/1")

    assert response.status_code == 200
    data = response.json()
    assert "restaurant" in data
    assert "trend_history" in data
    assert "recent_posts" in data

def test_authentication_required():
    """Test protected endpoint requires authentication."""
    response = client.get("/v1/users/me")

    assert response.status_code == 401

def test_register_and_login():
    """Test user registration and login flow."""
    # Register
    register_response = client.post(
        "/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "password123",
            "name": "Test User"
        }
    )
    assert register_response.status_code == 201
    assert "access_token" in register_response.json()

    # Login
    login_response = client.post(
        "/v1/auth/login",
        json={
            "email": "test@example.com",
            "password": "password123"
        }
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    # Access protected endpoint
    me_response = client.get(
        "/v1/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "test@example.com"
```

#### External Service Integration Tests
```python
# tests/integration/test_youtube_scraper.py
import pytest
from scrapers.youtube_scraper import YouTubeScraper

@pytest.mark.integration
@pytest.mark.slow
def test_youtube_scraper_real_api():
    """Test YouTube scraper with real API (skip in CI)."""
    scraper = YouTubeScraper(
        api_key=os.getenv("YOUTUBE_API_KEY"),
        gemini_api_key=os.getenv("GEMINI_API_KEY")
    )

    videos = scraper.scrape_channel_videos(
        channel_id="UCpko_-a4wgz2u_DgDgd9fqA",  # Hot Ones
        location="New York"
    )

    assert len(videos) > 0
    assert videos[0]["channel_id"] == "UCpko_-a4wgz2u_DgDgd9fqA"
    assert "restaurant_mentions" in videos[0]

@pytest.mark.integration
def test_gemini_restaurant_extraction():
    """Test Gemini API for restaurant extraction."""
    scraper = YouTubeScraper(
        api_key=os.getenv("YOUTUBE_API_KEY"),
        gemini_api_key=os.getenv("GEMINI_API_KEY")
    )

    transcript = "We visited Ramen Heaven in Austin and it was amazing!"
    mentions = scraper.extract_restaurants_with_gemini(
        transcript=transcript,
        title="Best Ramen in Austin",
        description="Food review",
        location="Austin"
    )

    assert len(mentions) > 0
    assert mentions[0]["name"].lower() == "ramen heaven"
    assert mentions[0]["sentiment"] == "positive"
```

---

## End-to-End Testing

### E2E Framework & Tools
- **Framework**: Cypress 13+
- **Focus**: Critical user journeys
- **Run Frequency**: Before each release

### Critical E2E Test Cases

#### Test 1: View Trending Restaurants
```typescript
// cypress/e2e/view-trends.cy.ts
describe('View Trending Restaurants', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000');
  });

  it('should display trending restaurants for Austin', () => {
    // Set location
    cy.get('[data-testid="location-input"]').type('Austin, TX');
    cy.get('[data-testid="location-submit"]').click();

    // Wait for trends to load
    cy.get('[data-testid="restaurant-card"]').should('have.length.greaterThan', 0);

    // Verify first restaurant has required fields
    cy.get('[data-testid="restaurant-card"]').first().within(() => {
      cy.get('[data-testid="restaurant-name"]').should('exist');
      cy.get('[data-testid="cuisine-type"]').should('exist');
      cy.get('[data-testid="trend-score"]').should('exist');
      cy.get('[data-testid="trend-category"]').should('exist');
    });
  });

  it('should filter by cuisine', () => {
    cy.get('[data-testid="location-input"]').type('Austin, TX');
    cy.get('[data-testid="location-submit"]').click();

    // Apply Japanese filter
    cy.get('[data-testid="cuisine-filter"]').click();
    cy.get('[data-testid="cuisine-option-japanese"]').click();

    // Verify all results are Japanese
    cy.get('[data-testid="restaurant-card"]').each(($card) => {
      cy.wrap($card).find('[data-testid="cuisine-type"]')
        .should('contain', 'Japanese');
    });
  });

  it('should sort by trend score', () => {
    cy.get('[data-testid="location-input"]').type('Austin, TX');
    cy.get('[data-testid="location-submit"]').click();

    // Sort by score
    cy.get('[data-testid="sort-select"]').select('trend_score');

    // Verify descending order
    cy.get('[data-testid="trend-score"]').then(($scores) => {
      const scores = [...$scores].map(el => parseFloat(el.textContent));
      const sorted = [...scores].sort((a, b) => b - a);
      expect(scores).to.deep.equal(sorted);
    });
  });
});
```

#### Test 2: Restaurant Detail Page
```typescript
// cypress/e2e/restaurant-detail.cy.ts
describe('Restaurant Detail Page', () => {
  it('should display full restaurant information', () => {
    cy.visit('http://localhost:3000');
    cy.get('[data-testid="location-input"]').type('Austin, TX');
    cy.get('[data-testid="location-submit"]').click();

    // Click first restaurant
    cy.get('[data-testid="restaurant-card"]').first().click();

    // Verify detail page
    cy.url().should('include', '/restaurants/');
    cy.get('[data-testid="restaurant-name"]').should('exist');
    cy.get('[data-testid="restaurant-address"]').should('exist');
    cy.get('[data-testid="restaurant-phone"]').should('exist');
    cy.get('[data-testid="trend-chart"]').should('exist');
    cy.get('[data-testid="social-proof"]').should('exist');
    cy.get('[data-testid="recent-posts"]').should('have.length.greaterThan', 0);
  });

  it('should show trend history chart', () => {
    cy.visit('http://localhost:3000/restaurants/1');

    cy.get('[data-testid="trend-chart"]').within(() => {
      cy.get('.recharts-line').should('exist');
      cy.get('.recharts-xAxis').should('exist');
      cy.get('.recharts-yAxis').should('exist');
    });
  });
});
```

#### Test 3: User Authentication Flow
```typescript
// cypress/e2e/authentication.cy.ts
describe('User Authentication', () => {
  it('should register, login, and bookmark restaurant', () => {
    cy.visit('http://localhost:3000');

    // Register
    cy.get('[data-testid="register-button"]').click();
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="name-input"]').type('Test User');
    cy.get('[data-testid="register-submit"]').click();

    // Verify logged in
    cy.get('[data-testid="user-menu"]').should('contain', 'Test User');

    // Bookmark a restaurant
    cy.get('[data-testid="location-input"]').type('Austin, TX');
    cy.get('[data-testid="location-submit"]').click();
    cy.get('[data-testid="bookmark-button"]').first().click();

    // Verify bookmarked
    cy.get('[data-testid="bookmark-button"]').first()
      .should('have.class', 'bookmarked');

    // View bookmarks page
    cy.get('[data-testid="user-menu"]').click();
    cy.get('[data-testid="bookmarks-link"]').click();
    cy.get('[data-testid="restaurant-card"]').should('have.length', 1);
  });

  it('should logout successfully', () => {
    cy.login('test@example.com', 'password123');
    cy.visit('http://localhost:3000');

    cy.get('[data-testid="user-menu"]').click();
    cy.get('[data-testid="logout-button"]').click();

    cy.get('[data-testid="login-button"]').should('exist');
  });
});
```

### E2E Test Coverage
**Required Flows**:
1. ✅ View trends by location
2. ✅ Filter and sort trends
3. ✅ View restaurant detail
4. ✅ User registration
5. ✅ User login
6. ✅ Bookmark restaurant
7. ✅ View bookmarks
8. ✅ Search restaurants
9. ✅ Map view
10. ✅ Responsive mobile layout

---

## Performance Testing

### Load Testing

#### Framework & Tools
- **Tool**: Locust (Python-based load testing)
- **Scenarios**: API endpoint load

#### Load Test Configuration
```python
# tests/load/locustfile.py
from locust import HttpUser, task, between

class TrendScoutUser(HttpUser):
    wait_time = between(1, 3)
    host = "https://api.restauranttrendscout.com"

    @task(3)  # 60% of requests
    def get_trends(self):
        """Simulate user fetching trends."""
        self.client.get(
            "/v1/trends",
            params={
                "latitude": 30.26,
                "longitude": -97.74,
                "radius_miles": 15
            }
        )

    @task(1)  # 20% of requests
    def get_restaurant_detail(self):
        """Simulate user viewing restaurant detail."""
        self.client.get(f"/v1/restaurants/{self.random_restaurant_id()}")

    @task(1)  # 20% of requests
    def search_restaurants(self):
        """Simulate user searching."""
        self.client.get(
            "/v1/search",
            params={"q": "ramen", "location": "Austin, TX"}
        )

    def random_restaurant_id(self):
        """Get random restaurant ID."""
        import random
        return random.randint(1, 1000)
```

**Run Load Test**:
```bash
# Start with 100 users, spawn 10 per second
locust -f tests/load/locustfile.py --users 100 --spawn-rate 10

# Target: 1000 requests/second
# p95 latency < 500ms
# p99 latency < 1000ms
# 0% error rate
```

### Performance Benchmarks

| Endpoint | Target p50 | Target p95 | Target p99 |
|----------|-----------|-----------|-----------|
| GET /v1/trends | <100ms | <300ms | <500ms |
| GET /v1/restaurants/{id} | <80ms | <200ms | <400ms |
| GET /v1/search | <150ms | <400ms | <800ms |
| POST /v1/auth/login | <200ms | <500ms | <1000ms |

---

## Security Testing

### Security Test Categories

#### 1. Authentication & Authorization Tests
```python
# tests/security/test_auth_security.py
def test_weak_password_rejected():
    """Test that weak passwords are rejected."""
    response = client.post(
        "/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "123",  # Too short
            "name": "Test"
        }
    )
    assert response.status_code == 400
    assert "password" in response.json()["message"].lower()

def test_sql_injection_in_search():
    """Test SQL injection protection."""
    response = client.get(
        "/v1/search",
        params={"q": "'; DROP TABLE restaurants; --"}
    )
    # Should not crash, should escape properly
    assert response.status_code in [200, 400]

def test_jwt_token_expiration():
    """Test expired JWT token is rejected."""
    # Create token that expired 1 hour ago
    expired_token = create_token(user_id=1, expires_delta=-3600)

    response = client.get(
        "/v1/users/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401

def test_rate_limiting():
    """Test API rate limiting."""
    # Make 101 requests (limit is 100/hour for free tier)
    for i in range(101):
        response = client.get("/v1/trends?latitude=30&longitude=-97")

    assert response.status_code == 429  # Too Many Requests
```

#### 2. Input Validation Tests
```python
def test_xss_in_search():
    """Test XSS attack protection."""
    response = client.get(
        "/v1/search",
        params={"q": "<script>alert('XSS')</script>"}
    )
    data = response.json()
    # Should escape HTML
    assert "<script>" not in str(data)

def test_path_traversal():
    """Test path traversal protection."""
    response = client.get("/v1/../../etc/passwd")
    assert response.status_code == 404
```

#### 3. Dependency Vulnerability Scanning
```bash
# Python dependencies
pip-audit

# npm dependencies
npm audit

# Run in CI pipeline
```

---

## Test Automation & CI/CD

### GitHub Actions Test Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install -r requirements-dev.txt
      - name: Run unit tests
        run: pytest tests/unit/ --cov --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
      - name: Run integration tests
        run: pytest tests/integration/

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm ci
      - name: Run E2E tests
        run: npm run test:e2e

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security audit
        run: |
          pip-audit
          npm audit
```

---

## Manual Testing

### Manual Test Cases (Pre-Release)

#### Functional Testing Checklist
- [ ] User can view trends for their location
- [ ] Filters work correctly (cuisine, price, distance)
- [ ] Sorting works (score, distance, mentions)
- [ ] Restaurant detail page shows all information
- [ ] Trend chart displays correctly
- [ ] Social proof section shows posts
- [ ] User can register with valid email
- [ ] User can login with correct credentials
- [ ] User can bookmark restaurants
- [ ] Bookmarks persist after logout/login
- [ ] Search returns relevant results
- [ ] Map view shows restaurant markers
- [ ] Mobile responsive on iPhone, Android
- [ ] Pagination works correctly

#### Browser Compatibility
- [ ] Chrome (latest 2 versions)
- [ ] Safari (latest 2 versions)
- [ ] Firefox (latest 2 versions)
- [ ] Edge (latest 2 versions)

#### Device Testing
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (iPad, 768x1024)
- [ ] Mobile (iPhone 14, 390x844)
- [ ] Mobile (Android, 360x800)

---

## Test Data Management

### Test Data Strategy

#### Unit Tests
- **Mock Data**: Use fixtures and mocks
- **No Real Data**: Completely isolated

#### Integration Tests
- **Test Database**: Separate PostgreSQL instance
- **Seed Data**: Controlled seed scripts
- **Cleanup**: Teardown after each test

#### E2E Tests
- **Staging Environment**: Mirror of production
- **Realistic Data**: Scraped sample data
- **Reset**: Database reset before each run

### Test Data Generator
```python
# tests/factories.py
import factory
from models import Restaurant, SocialPost

class RestaurantFactory(factory.Factory):
    class Meta:
        model = Restaurant

    name = factory.Faker('company')
    city = "Austin"
    state = "TX"
    latitude = factory.Faker('latitude')
    longitude = factory.Faker('longitude')
    cuisine_types = ["Japanese", "Ramen"]
    price_level = 2

class SocialPostFactory(factory.Factory):
    class Meta:
        model = SocialPost

    platform = "instagram"
    post_id = factory.Faker('uuid4')
    user_handle = factory.Faker('user_name')
    content = factory.Faker('text')
    likes = factory.Faker('random_int', min=10, max=10000)
```

---

## Defect Management

### Bug Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **Critical** | System down, data loss | Immediate | API completely down, database corruption |
| **High** | Major feature broken | <4 hours | Trends not displaying, login broken |
| **Medium** | Feature partially broken | <24 hours | Filter not working, slow performance |
| **Low** | Minor issue, cosmetic | <1 week | Typo, alignment issue |

### Bug Report Template
```markdown
## Bug Report

**Title**: [Clear, concise title]

**Severity**: Critical | High | Medium | Low

**Environment**:
- Browser: Chrome 120
- OS: macOS 14
- URL: https://app.restauranttrendscout.com/trends

**Steps to Reproduce**:
1. Go to dashboard
2. Click filter button
3. Select "Japanese" cuisine

**Expected Result**:
Only Japanese restaurants displayed

**Actual Result**:
All restaurants still showing

**Screenshots**:
[Attach screenshots]

**Additional Context**:
Reproducible 100% of the time on Chrome, works on Safari
```

---

## Test Metrics & Reporting

### Key Metrics to Track

| Metric | Target | How Measured |
|--------|--------|--------------|
| Code Coverage | >80% backend, >70% frontend | pytest-cov, jest --coverage |
| Test Success Rate | >99% | CI/CD pipeline |
| Test Execution Time | <5 min (unit+integration) | CI logs |
| Flaky Test Rate | <1% | Test retry analysis |
| Bug Density | <5 bugs per 1000 LOC | Defect tracking |
| Bug Escape Rate | <5% | Production bugs vs total |

### Weekly Test Report Template
```markdown
# Test Report: Week of [Date]

## Summary
- Tests Run: 350
- Tests Passed: 348
- Tests Failed: 2
- Code Coverage: 82%

## Test Execution
- Unit Tests: 280 (100% pass)
- Integration Tests: 60 (97% pass)
- E2E Tests: 10 (100% pass)

## Failures
1. test_trend_calculation_edge_case - Fixed
2. test_api_rate_limiting - Flaky, investigating

## Coverage Changes
- Trend Calculator: 88% → 92% (+4%)
- API Endpoints: 75% → 78% (+3%)

## Action Items
- [ ] Fix flaky rate limiting test
- [ ] Increase scraper test coverage (currently 65%)
```

---

## Continuous Improvement

### Test Review Cadence
- **Daily**: Review test failures in CI
- **Weekly**: Review test metrics, coverage trends
- **Monthly**: Review test strategy, identify gaps
- **Quarterly**: Major test infrastructure improvements

### Test Maintenance
- Remove obsolete tests
- Update tests for refactored code
- Fix flaky tests within 24 hours
- Keep test execution time under threshold

---

## Appendix

### Useful Commands

```bash
# Backend Testing
pytest                              # Run all tests
pytest tests/unit/                  # Unit tests only
pytest tests/integration/           # Integration tests only
pytest -v                           # Verbose output
pytest --cov=. --cov-report=html    # Coverage report
pytest -k "test_trend"              # Run specific tests
pytest --maxfail=1                  # Stop after first failure

# Frontend Testing
npm test                            # Run all tests
npm test -- --coverage              # With coverage
npm test -- --watch                 # Watch mode
npm run test:e2e                    # E2E tests

# Load Testing
locust -f tests/load/locustfile.py  # Start load test

# Security Testing
pip-audit                           # Python dependencies
npm audit                           # npm dependencies
```

### Test Best Practices
1. **AAA Pattern**: Arrange, Act, Assert
2. **One Assertion**: One logical assertion per test
3. **Descriptive Names**: test_should_xxx_when_yyy
4. **Fast Tests**: Unit tests < 100ms each
5. **Isolated**: No dependencies between tests
6. **Deterministic**: Same input = same output
7. **Clean Up**: Proper teardown/cleanup

---

**Document Status**: Ready for implementation
**Next Steps**: Set up test infrastructure, begin writing tests in Sprint 1
