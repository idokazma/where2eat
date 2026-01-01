# Test-Driven Development (TDD) Guidelines
## Where2Eat Project

**Document Version:** 1.0  
**Last Updated:** 2026-01-01  
**Owner:** Engineering Team  
**Status:** MANDATORY

---

## Overview

This document establishes mandatory Test-Driven Development (TDD) practices for the Where2Eat project. **Effective immediately, ALL development must follow TDD principles.**

---

## TDD Mandate

### 🚨 **CRITICAL REQUIREMENT**
- **No code may be written** without tests being written first
- **No pull requests will be approved** without evidence of TDD process
- **No features may be deployed** without comprehensive test coverage

---

## TDD Workflow (Red-Green-Refactor)

### 1. 🔴 **Red Phase** - Write Failing Tests
```python
# Write test FIRST - it should FAIL
def test_calculate_restaurant_rating():
    """Test rating calculation with valid reviews."""
    calculator = RatingCalculator()
    reviews = [5, 4, 3, 5, 4]
    
    # This should fail because calculate_average doesn't exist yet
    result = calculator.calculate_average(reviews)
    
    assert result == 4.2
```

**Red Phase Requirements:**
- Test **must fail initially** (proves it's testing the right thing)
- Test name describes **expected behavior**
- Test is **specific and focused** (one behavior per test)
- Test includes **edge cases and error conditions**

### 2. 🟢 **Green Phase** - Make Tests Pass
```python
# Write MINIMAL code to make test pass
class RatingCalculator:
    def calculate_average(self, reviews: List[int]) -> float:
        if not reviews:
            return 0.0
        return sum(reviews) / len(reviews)
```

**Green Phase Requirements:**
- Write **minimal code** to make test pass
- **Don't over-engineer** - just make it work
- **Run test frequently** to verify progress
- **All existing tests** must still pass

### 3. 🔵 **Refactor Phase** - Improve Code
```python
# Refactor while keeping tests passing
class RatingCalculator:
    def calculate_average(self, reviews: List[int]) -> float:
        """Calculate average rating from list of reviews.
        
        Args:
            reviews: List of integer ratings (1-5)
            
        Returns:
            Average rating as float, 0.0 if no reviews
            
        Raises:
            ValueError: If any review is outside 1-5 range
        """
        if not reviews:
            return 0.0
            
        # Validate ratings
        for review in reviews:
            if not 1 <= review <= 5:
                raise ValueError(f"Rating {review} must be between 1-5")
                
        return round(sum(reviews) / len(reviews), 1)
```

**Refactor Phase Requirements:**
- **Improve code quality** without changing behavior
- **All tests must pass** throughout refactoring
- **Add documentation** and error handling
- **Extract methods** if code becomes complex

---

## TDD Best Practices

### Test Structure (Arrange-Act-Assert)
```python
def test_search_restaurant_with_invalid_name():
    # Arrange - Set up test data
    agent = RestaurantSearchAgent()
    invalid_name = ""
    
    # Act & Assert - Execute and verify
    with pytest.raises(ValueError, match="Restaurant name cannot be empty"):
        agent.search_restaurant(invalid_name)
```

### Test Naming Conventions
- **Use descriptive names** that explain the behavior
- **Follow pattern**: `test_[method]_[scenario]_[expected_result]`
- **Examples**:
  - `test_search_restaurant_with_valid_name_returns_info`
  - `test_calculate_trend_score_with_no_data_returns_zero`
  - `test_save_results_with_invalid_path_raises_error`

### Test Categories

#### 1. **Unit Tests** (80% of tests)
```python
def test_sanitize_filename_removes_special_characters():
    agent = RestaurantSearchAgent()
    result = agent._sanitize_filename("Restaurant@#$%Name!")
    assert result == "RestaurantName"
```

#### 2. **Integration Tests** (15% of tests)
```python
def test_full_restaurant_search_workflow():
    agent = RestaurantSearchAgent()
    
    # Test complete workflow
    info = agent.search_restaurant("Test Restaurant", "Austin")
    file_path = agent.save_restaurant_results(info)
    
    # Verify file was created and contains expected data
    assert file_path.exists()
    with open(file_path) as f:
        data = json.load(f)
    assert data["restaurant_name"] == "Test Restaurant"
```

#### 3. **End-to-End Tests** (5% of tests)
```python
def test_command_line_interface():
    result = subprocess.run([
        "python", "restaurant_search_agent.py", 
        "Test Restaurant", "Austin"
    ], capture_output=True, text=True)
    
    assert result.returncode == 0
    assert "Search request prepared" in result.stdout
```

---

## TDD Rules and Enforcement

### Mandatory Rules
1. **Write test first** - No exceptions
2. **Test must fail initially** - Proves it tests the right thing
3. **Write minimal code** to pass test
4. **Refactor only while tests pass**
5. **All tests must pass** before committing
6. **No code without tests** - 100% enforcement

### Code Review Checklist
- [ ] Tests written before implementation?
- [ ] Tests fail initially then pass after implementation?
- [ ] Edge cases and error conditions tested?
- [ ] Test names are descriptive and clear?
- [ ] Code coverage >90% for new code?
- [ ] All existing tests still pass?

### Git Commit Guidelines
```bash
# Good TDD commit messages
git commit -m "Add failing test for restaurant name validation"
git commit -m "Implement restaurant name validation to pass tests"
git commit -m "Refactor validation logic while maintaining test coverage"

# Bad - implementation before tests
git commit -m "Add restaurant search feature" # Missing tests
```

---

## TDD Examples by Component

### Example 1: New Feature - Restaurant Validation
```python
# Step 1: Write failing test
def test_validate_restaurant_name_rejects_empty_string():
    validator = RestaurantValidator()
    with pytest.raises(ValueError):
        validator.validate_name("")

# Step 2: Make test pass
class RestaurantValidator:
    def validate_name(self, name: str) -> bool:
        if not name:
            raise ValueError("Name cannot be empty")
        return True

# Step 3: Add more test cases
def test_validate_restaurant_name_rejects_none():
    validator = RestaurantValidator()
    with pytest.raises(ValueError):
        validator.validate_name(None)

def test_validate_restaurant_name_accepts_valid_string():
    validator = RestaurantValidator()
    assert validator.validate_name("Valid Restaurant") is True
```

### Example 2: Bug Fix - File Path Handling
```python
# Step 1: Write test that reproduces the bug
def test_save_results_handles_special_characters_in_name():
    agent = RestaurantSearchAgent()
    info = RestaurantInfo(name="Restaurant/With\\Special:Chars")
    
    # This should not raise an exception
    file_path = agent.save_restaurant_results(info)
    assert file_path.exists()

# Step 2: Fix the bug to make test pass
def _sanitize_filename(self, name: str) -> str:
    # Remove file system illegal characters
    illegal_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
    safe_name = name
    for char in illegal_chars:
        safe_name = safe_name.replace(char, '_')
    return safe_name
```

---

## Testing Tools and Setup

### Required Testing Tools
```bash
# Install testing dependencies
pip install pytest pytest-cov pytest-mock

# Coverage configuration in pytest.ini
[tool:pytest]
testpaths = tests/
addopts = --cov=src --cov-report=html --cov-fail-under=90
```

### Test File Organization
```
tests/
├── unit/
│   ├── test_restaurant_search_agent.py
│   ├── test_restaurant_validator.py
│   └── test_file_utils.py
├── integration/
│   ├── test_search_workflow.py
│   └── test_api_integration.py
└── e2e/
    ├── test_cli_interface.py
    └── test_full_pipeline.py
```

### Running Tests
```bash
# Run all tests with coverage
pytest

# Run specific test category
pytest tests/unit/
pytest tests/integration/

# Run tests in TDD watch mode
pytest --looponfail

# Generate coverage report
pytest --cov-report=html
open htmlcov/index.html
```

---

## TDD Anti-Patterns to Avoid

### ❌ **Writing Tests After Code**
```python
# WRONG - Implementation first
def calculate_average(reviews):
    return sum(reviews) / len(reviews)

# Then writing test
def test_calculate_average():  # Too late!
    assert calculate_average([1,2,3]) == 2
```

### ❌ **Testing Implementation Details**
```python
# WRONG - Testing internal method calls
def test_search_calls_internal_methods(mocker):
    mock_validate = mocker.patch('agent._validate_input')
    mock_process = mocker.patch('agent._process_request')
    
    agent.search_restaurant("Test")
    
    mock_validate.assert_called_once()  # Testing implementation
```

### ❌ **Overly Complex Tests**
```python
# WRONG - Testing multiple behaviors
def test_restaurant_search_complex_scenario():
    # This test does too many things
    assert agent.validate_name("Test") is True
    assert agent.search("Test") is not None
    assert agent.save_results(result) == "saved"
    assert len(agent.get_history()) == 1
```

---

## Success Metrics

### TDD Compliance Tracking
- **TDD Process Compliance**: 100% (tracked in code reviews)
- **Test Coverage**: >90% (automated measurement)
- **Test Success Rate**: >99% (CI/CD tracking)
- **Bug Escape Rate**: <5% (production monitoring)

### Weekly TDD Metrics
- Number of features developed with TDD
- Average time from red to green phase
- Number of refactoring cycles per feature
- Test coverage improvement

---

## TDD Training and Support

### Resources
- **Internal TDD Workshops**: Monthly team sessions
- **Pair Programming**: TDD mentoring for new developers
- **Code Review Focus**: TDD process verification
- **Documentation**: This guide and examples

### Getting Help
- **TDD Questions**: #engineering-help Slack channel
- **Pair Programming**: Request TDD pairing sessions
- **Code Reviews**: Focus on TDD process feedback

---

## Consequences for Non-Compliance

### Process Enforcement
1. **Pull Request Rejection**: PRs without TDD evidence rejected
2. **Code Review Delays**: Non-TDD code gets lower priority
3. **Quality Gate Blocks**: Deployment blocked without tests
4. **Team Discussion**: Persistent non-compliance addressed in retrospectives

### Support for Adoption
- **Training**: Additional TDD workshops if needed
- **Mentoring**: Pair programming sessions
- **Tools**: Better testing infrastructure if required
- **Process Improvement**: Adjust process based on team feedback

---

**Remember: TDD is not just about testing - it's about better design, cleaner code, and higher confidence in our software. Tests written first lead to better architecture and fewer bugs.**

---

**Document Status**: ACTIVE - MANDATORY COMPLIANCE  
**Next Review**: 2026-02-01  
**Contact**: Engineering Team Lead