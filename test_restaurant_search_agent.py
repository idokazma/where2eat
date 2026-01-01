"""Tests for Restaurant Search Agent

Comprehensive test suite for the RestaurantSearchAgent class.
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, mock_open

from restaurant_search_agent import RestaurantSearchAgent, RestaurantInfo, run_restaurant_search


class TestRestaurantInfo(unittest.TestCase):
    """Test cases for RestaurantInfo dataclass."""

    def test_restaurant_info_creation(self):
        """Test basic RestaurantInfo creation."""
        info = RestaurantInfo(
            name="Test Restaurant",
            location="Austin",
            cuisine_type="Italian"
        )
        self.assertEqual(info.name, "Test Restaurant")
        self.assertEqual(info.location, "Austin")
        self.assertEqual(info.cuisine_type, "Italian")
        self.assertEqual(info.images, [])  # Default empty list

    def test_restaurant_info_with_images(self):
        """Test RestaurantInfo with images."""
        images = ["http://example.com/img1.jpg", "http://example.com/img2.jpg"]
        info = RestaurantInfo(
            name="Test Restaurant",
            images=images
        )
        self.assertEqual(info.images, images)


class TestRestaurantSearchAgent(unittest.TestCase):
    """Test cases for RestaurantSearchAgent class."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.agent = RestaurantSearchAgent(results_dir=self.temp_dir)

    def test_init(self):
        """Test agent initialization."""
        self.assertIsInstance(self.agent.results_dir, Path)
        self.assertTrue(self.agent.results_dir.exists())
        self.assertIsNotNone(self.agent.logger)

    def test_sanitize_filename(self):
        """Test filename sanitization."""
        test_cases = [
            ("Simple Name", "Simple_Name"),
            ("Name with @#$% special chars!", "Name_with__special_chars"),
            ("   Spaces   ", "Spaces"),
            ("Very long restaurant name that should be truncated because it's too long for filesystem", 
             "Very_long_restaurant_name_that_should_be_truncated"),
        ]
        
        for input_name, expected in test_cases:
            with self.subTest(input_name=input_name):
                result = self.agent._sanitize_filename(input_name)
                self.assertEqual(result, expected)

    def test_search_restaurant_empty_name(self):
        """Test search with empty restaurant name."""
        with self.assertRaises(ValueError) as context:
            self.agent.search_restaurant("")
        self.assertIn("Restaurant name cannot be empty", str(context.exception))

        with self.assertRaises(ValueError) as context:
            self.agent.search_restaurant("   ")
        self.assertIn("Restaurant name cannot be empty", str(context.exception))

    @patch('builtins.open', new_callable=mock_open)
    @patch('restaurant_search_agent.datetime')
    def test_search_restaurant_success(self, mock_datetime, mock_file):
        """Test successful restaurant search."""
        mock_datetime.now.return_value.strftime.return_value = "20260101_120000"
        
        result = self.agent.search_restaurant("Test Restaurant", "Austin")
        
        self.assertIsInstance(result, RestaurantInfo)
        self.assertEqual(result.name, "Test Restaurant")
        mock_file.assert_called()

    def test_create_search_request(self):
        """Test search request creation."""
        request = self.agent._create_search_request("Test Restaurant", "Austin")
        
        self.assertIn("Test Restaurant", request)
        self.assertIn("in Austin", request)
        self.assertIn("TASK: Find and compile detailed restaurant information", request)
        self.assertIn("SEARCH STRATEGY:", request)
        self.assertIn("INFORMATION TO EXTRACT:", request)

    def test_create_search_request_no_city(self):
        """Test search request creation without city."""
        request = self.agent._create_search_request("Test Restaurant")
        
        self.assertIn("Test Restaurant", request)
        # Should not contain location context
        self.assertNotIn(" in Austin", request)
        self.assertNotIn(" in New York", request)

    @patch('builtins.open', new_callable=mock_open)
    @patch('restaurant_search_agent.datetime')
    def test_save_search_request(self, mock_datetime, mock_file):
        """Test saving search request to file."""
        mock_datetime.now.return_value.strftime.return_value = "20260101_120000"
        
        request_text = "Test search request"
        result = self.agent._save_search_request("Test Restaurant", request_text)
        
        self.assertIsInstance(result, Path)
        mock_file.assert_called_once()
        
        # Check that write was called with correct content
        handle = mock_file()
        written_content = ''.join(call.args[0] for call in handle.write.call_args_list)
        self.assertIn("Restaurant Search Request", written_content)
        self.assertIn("Test Restaurant", written_content)
        self.assertIn("Test search request", written_content)

    def test_save_restaurant_results_empty_name(self):
        """Test saving results with empty restaurant name."""
        info = RestaurantInfo(name="")
        
        with self.assertRaises(ValueError) as context:
            self.agent.save_restaurant_results(info)
        self.assertIn("Restaurant info must have a name", str(context.exception))

    @patch('builtins.open', new_callable=mock_open)
    @patch('restaurant_search_agent.datetime')
    def test_save_restaurant_results_success(self, mock_datetime, mock_file):
        """Test successful saving of restaurant results."""
        mock_datetime.now.return_value.strftime.return_value = "20260101_120000"
        mock_datetime.now.return_value.isoformat.return_value = "2026-01-01T12:00:00"
        
        info = RestaurantInfo(
            name="Test Restaurant",
            location="Austin",
            cuisine_type="Italian",
            images=["http://example.com/img1.jpg"]
        )
        
        result = self.agent.save_restaurant_results(info)
        
        self.assertIsInstance(result, Path)
        # Should be called twice - once for JSON, once for text
        self.assertEqual(mock_file.call_count, 2)

    def test_search_multiple_restaurants_empty_list(self):
        """Test batch search with empty restaurant list."""
        with self.assertRaises(ValueError) as context:
            self.agent.search_multiple_restaurants([])
        self.assertIn("Restaurant list cannot be empty", str(context.exception))

    @patch.object(RestaurantSearchAgent, 'search_restaurant')
    @patch.object(RestaurantSearchAgent, '_save_batch_results')
    def test_search_multiple_restaurants_success(self, mock_save_batch, mock_search):
        """Test successful batch restaurant search."""
        mock_info = RestaurantInfo(name="Test Restaurant")
        mock_search.return_value = mock_info
        
        restaurants = ["Restaurant 1", "Restaurant 2"]
        results = self.agent.search_multiple_restaurants(restaurants, "Austin")
        
        self.assertEqual(len(results), 2)
        self.assertEqual(mock_search.call_count, 2)
        mock_save_batch.assert_called_once()

    @patch.object(RestaurantSearchAgent, 'search_restaurant')
    @patch.object(RestaurantSearchAgent, '_save_batch_results')
    def test_search_multiple_restaurants_with_failures(self, mock_save_batch, mock_search):
        """Test batch search with some failures."""
        def side_effect(name, city):
            if name == "Bad Restaurant":
                raise Exception("Search failed")
            return RestaurantInfo(name=name)
        
        mock_search.side_effect = side_effect
        
        restaurants = ["Good Restaurant", "Bad Restaurant"]
        results = self.agent.search_multiple_restaurants(restaurants)
        
        self.assertEqual(len(results), 2)
        self.assertIsInstance(results["Good Restaurant"], RestaurantInfo)
        self.assertIsNone(results["Bad Restaurant"])

    @patch('builtins.open', new_callable=mock_open)
    @patch('restaurant_search_agent.datetime')
    def test_save_batch_results(self, mock_datetime, mock_file):
        """Test saving batch results."""
        mock_datetime.now.return_value.strftime.return_value = "20260101_120000"
        
        results = {
            "Restaurant 1": RestaurantInfo(name="Restaurant 1"),
            "Restaurant 2": None,
            "Restaurant 3": RestaurantInfo(name="Restaurant 3")
        }
        
        self.agent._save_batch_results(results, "Austin")
        
        mock_file.assert_called_once()
        handle = mock_file()
        written_content = ''.join(call.args[0] for call in handle.write.call_args_list)
        
        self.assertIn("Batch Restaurant Search Results", written_content)
        self.assertIn("Total Restaurants: 3", written_content)
        self.assertIn("Location: Austin", written_content)
        self.assertIn("SUCCESS RATE: 2/3 (66.7%)", written_content)


class TestRunRestaurantSearch(unittest.TestCase):
    """Test cases for the run_restaurant_search function."""

    def test_run_restaurant_search_empty_name(self):
        """Test run_restaurant_search with empty name."""
        with self.assertRaises(ValueError):
            run_restaurant_search("")

    @patch.object(RestaurantSearchAgent, 'search_restaurant')
    @patch.object(RestaurantSearchAgent, 'save_restaurant_results')
    @patch('builtins.print')
    def test_run_restaurant_search_success(self, mock_print, mock_save, mock_search):
        """Test successful restaurant search run."""
        mock_search.return_value = RestaurantInfo(name="Test Restaurant")
        mock_save.return_value = Path("/fake/path/results.json")
        
        result = run_restaurant_search("Test Restaurant", "Austin")
        
        self.assertTrue(result["success"])
        self.assertEqual(result["restaurant_name"], "Test Restaurant")
        self.assertEqual(result["city"], "Austin")
        self.assertTrue(result["search_request_prepared"])

    @patch.object(RestaurantSearchAgent, 'search_restaurant')
    @patch('builtins.print')
    def test_run_restaurant_search_failure(self, mock_print, mock_search):
        """Test restaurant search run with failure."""
        mock_search.side_effect = Exception("Search failed")
        
        result = run_restaurant_search("Test Restaurant")
        
        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Search failed")
        self.assertEqual(result["restaurant_name"], "Test Restaurant")


class TestIntegration(unittest.TestCase):
    """Integration tests for the restaurant search agent."""

    def setUp(self):
        """Set up integration test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.agent = RestaurantSearchAgent(results_dir=self.temp_dir)

    def test_full_search_workflow(self):
        """Test the complete search workflow."""
        # Search for a restaurant
        result = self.agent.search_restaurant("Integration Test Restaurant", "Austin")
        
        # Verify the result
        self.assertIsInstance(result, RestaurantInfo)
        self.assertEqual(result.name, "Integration Test Restaurant")
        
        # Save the results
        saved_file = self.agent.save_restaurant_results(result)
        
        # Verify files were created
        self.assertTrue(saved_file.exists())
        
        # Verify JSON content
        with open(saved_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.assertEqual(data["restaurant_name"], "Integration Test Restaurant")
        self.assertIn("basic_info", data)
        self.assertIn("details", data)
        self.assertIn("content", data)

    def test_batch_search_workflow(self):
        """Test batch search workflow."""
        restaurants = ["Restaurant A", "Restaurant B", "Restaurant C"]
        
        results = self.agent.search_multiple_restaurants(restaurants, "Austin")
        
        self.assertEqual(len(results), 3)
        for name in restaurants:
            self.assertIn(name, results)
            self.assertIsInstance(results[name], RestaurantInfo)


if __name__ == '__main__':
    unittest.main()