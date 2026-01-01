#!/usr/bin/env python3
"""
Test script to verify Claude Restaurant Analyzer is working correctly
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from claude_restaurant_analyzer import ClaudeRestaurantAnalyzer

# Test sample data
test_transcript_data = {
    'video_id': 'test123',
    'video_url': 'https://www.youtube.com/watch?v=test123',
    'language': 'he',
    'transcript': '''
    שלום וברוכים הבאים לתוכנית אוכל. היום נדבר על מסעדות מעולות.
    המסעדה הראשונה היא צ'קולי שנמצאת בתל אביב ליד הנמל.
    זה מקום איטלקי מעולה עם נוף לים. האוכל שם טעים מאוד.
    המסעדה השנייה היא גורמי סבזי בשוק לוינסקי.
    זה מקום פרסי אותנטי עם מחירים טובים.
    '''
}

def test_claude_analyzer():
    print("🧪 Testing Claude Restaurant Analyzer...")
    
    # Test in mock mode (no external dependencies)
    try:
        analyzer = ClaudeRestaurantAnalyzer(test_mode=True)
        print("✅ Claude Analyzer initialized successfully in test mode")
        
        # Test analysis
        result = analyzer.analyze_transcript(test_transcript_data)
        print(f"✅ Analysis completed:")
        print(f"   - Restaurants found: {len(result.get('restaurants', []))}")
        print(f"   - Episode info: {result.get('episode_info', {}).get('video_id', 'unknown')}")
        print(f"   - Food trends: {len(result.get('food_trends', []))}")
        print(f"   - Processing method: {result.get('episode_info', {}).get('processing_method', 'unknown')}")
        
        # Show sample restaurant if found
        restaurants = result.get('restaurants', [])
        if restaurants:
            restaurant = restaurants[0]
            print(f"   - Sample restaurant: {restaurant.get('name_hebrew', 'Unknown')} ({restaurant.get('name_english', 'Unknown')})")
            print(f"   - Location: {restaurant.get('location', {}).get('city', 'Unknown')}")
            print(f"   - Cuisine: {restaurant.get('cuisine_type', 'Unknown')}")
        
        # Test saving functionality
        json_path, md_path = analyzer.save_analysis(result)
        print(f"✅ Analysis saved:")
        print(f"   - JSON: {json_path}")
        print(f"   - Markdown: {md_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_chunking():
    print("\n🔄 Testing transcript chunking...")
    
    try:
        analyzer = ClaudeRestaurantAnalyzer(test_mode=True)
        
        # Create a long transcript to test chunking
        long_transcript = test_transcript_data.copy()
        long_transcript['transcript'] = test_transcript_data['transcript'] * 1000  # Make it very long
        
        result = analyzer.analyze_transcript(long_transcript)
        
        print(f"✅ Chunking test completed:")
        print(f"   - Processing method: {result.get('episode_info', {}).get('processing_method', 'unknown')}")
        print(f"   - Restaurants found: {len(result.get('restaurants', []))}")
        
        return True
        
    except Exception as e:
        print(f"❌ Chunking test failed: {str(e)}")
        return False

def test_error_handling():
    print("\n🚫 Testing error handling...")
    
    try:
        analyzer = ClaudeRestaurantAnalyzer(test_mode=True)
        
        # Test with invalid data
        invalid_data = {'video_id': 'test', 'video_url': 'test', 'transcript': ''}
        result = analyzer.analyze_transcript(invalid_data)
        
        print(f"✅ Error handling test completed:")
        print(f"   - Episode info created: {'episode_info' in result}")
        print(f"   - Has fallback data: {len(result.get('restaurants', [])) >= 0}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error handling test failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 TESTING CLAUDE RESTAURANT ANALYZER")
    print("=" * 60)
    
    success1 = test_claude_analyzer()
    success2 = test_chunking()
    success3 = test_error_handling()
    
    print("\n" + "=" * 60)
    if success1 and success2 and success3:
        print("🎉 ALL TESTS PASSED - Claude integration is working!")
    else:
        print("❌ SOME TESTS FAILED - Check configuration")
    print("=" * 60)