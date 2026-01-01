#!/usr/bin/env python3
"""
Test script for OpenAI integration
"""

import sys
import os
import json
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from openai_restaurant_analyzer import OpenAIRestaurantAnalyzer

def test_openai_analyzer():
    """Test the OpenAI restaurant analyzer with sample data"""
    print("🧪 Testing OpenAI Restaurant Analyzer Integration")
    print("=" * 60)
    
    # Sample transcript data for testing
    test_transcript = {
        "video_id": "test123",
        "video_url": "https://www.youtube.com/watch?v=test123",
        "language": "he",
        "transcript": """
        היום נדבר על מסעדה מעולה שנקראת 'טוסקנה' בתל אביב.
        המסעדה הזאת מגישה אוכל איטלקי מעולה, במיוחד הפסטה שלהם.
        המחירים קצת יקרים אבל זה שווה את זה.
        גם ביקרנו בבית קפה 'אלגרה' ברמת גן שמגיש קפה מעולה.
        המקום הוא בשכונת רמת אביב והאווירה שם מעולה.
        """
    }
    
    try:
        # Initialize analyzer in test mode
        print("🤖 Initializing OpenAI analyzer in test mode...")
        analyzer = OpenAIRestaurantAnalyzer(test_mode=True)
        
        # Test analysis
        print("🔍 Running analysis on test transcript...")
        results = analyzer.analyze_transcript(test_transcript)
        
        # Display results
        print("\n✅ Analysis completed successfully!")
        print(f"📊 Results:")
        print(f"   - Restaurants found: {len(results.get('restaurants', []))}")
        print(f"   - Food trends: {len(results.get('food_trends', []))}")
        print(f"   - Episode summary: {results.get('episode_summary', 'No summary')[:100]}...")
        
        # Show restaurants
        if results.get('restaurants'):
            print("\n🍽️  Restaurants found:")
            for i, restaurant in enumerate(results['restaurants'], 1):
                print(f"   {i}. {restaurant.get('name_hebrew', 'Unknown')} ({restaurant.get('name_english', 'Unknown')})")
                print(f"      Location: {restaurant.get('location', {}).get('city', 'Unknown')}")
                print(f"      Cuisine: {restaurant.get('cuisine_type', 'Unknown')}")
                print(f"      Opinion: {restaurant.get('host_opinion', 'Unknown')}")
        
        # Save test results
        print("\n💾 Saving test results...")
        output_file = analyzer.save_analysis_results(results, "test_results")
        print(f"   Saved to: {output_file}")
        
        print("\n🎉 OpenAI integration test completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        print(f"   Error details: {type(e).__name__}: {str(e)}")
        
        # Check if it's an API key issue
        if "api key" in str(e).lower():
            print("\n💡 Troubleshooting:")
            print("   1. Make sure OPENAI_API_KEY is set in your .env file")
            print("   2. Verify your OpenAI API key is valid and has credits")
            print("   3. Check if you have the correct API permissions")
        
        return False

if __name__ == "__main__":
    success = test_openai_analyzer()
    sys.exit(0 if success else 1)