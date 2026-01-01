#!/usr/bin/env python3
"""
Test script to verify OpenAI Restaurant Analyzer is working correctly
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from openai_restaurant_analyzer import OpenAIRestaurantAnalyzer

# Test sample data
test_transcript_data = {
    'video_id': 'test123',
    'video_url': 'https://www.youtube.com/watch?v=test123',
    'language': 'he',
    'transcript': '''
    שלום וברוכים הבאים לתוכנית אוכל. היום נדבר על מסעדות מעולות.
    המסעדה הראשונה היא צ'קולי שנמצאת בתל אביב ליד הנמל.
    זה מקום ספרדי מעולה עם נוף לים. האוכל שם טעים מאוד.
    המסעדה השנייה היא גורמי סבזי בשוק לוינסקי.
    זה מקום פרסי אותנטי עם מחירים טובים.
    '''
}

def test_openai_analyzer():
    print("🧪 Testing OpenAI Restaurant Analyzer...")
    
    # Test in mock mode first (no API key needed)
    try:
        analyzer = OpenAIRestaurantAnalyzer(test_mode=True)
        print("✅ OpenAI Analyzer initialized successfully in test mode")
        
        # Test analysis
        result = analyzer.analyze_transcript(test_transcript_data)
        print(f"✅ Analysis completed:")
        print(f"   - Restaurants found: {len(result.get('restaurants', []))}")
        print(f"   - Episode info: {result.get('episode_info', {}).get('video_id', 'unknown')}")
        print(f"   - Food trends: {len(result.get('food_trends', []))}")
        
        # Show sample restaurant if found
        restaurants = result.get('restaurants', [])
        if restaurants:
            restaurant = restaurants[0]
            print(f"   - Sample restaurant: {restaurant.get('name_hebrew', 'Unknown')} ({restaurant.get('name_english', 'Unknown')})")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False

def test_with_real_api():
    print("\n🔑 Testing with real OpenAI API (if API key available)...")
    
    try:
        # Check if API key is available
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            print("⚠️  No OPENAI_API_KEY found in environment - skipping real API test")
            return True
        
        analyzer = OpenAIRestaurantAnalyzer(test_mode=False)
        print("✅ Real OpenAI Analyzer initialized successfully")
        
        # Test with shorter transcript to save costs
        short_transcript_data = test_transcript_data.copy()
        short_transcript_data['transcript'] = 'המסעדה צ\'קולי בתל אביב היא מקום איטלקי מעולה.'
        
        result = analyzer.analyze_transcript(short_transcript_data)
        print(f"✅ Real API analysis completed:")
        print(f"   - Restaurants found: {len(result.get('restaurants', []))}")
        print(f"   - Model used: {analyzer.model}")
        
        return True
        
    except Exception as e:
        print(f"❌ Real API test failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 TESTING OPENAI RESTAURANT ANALYZER")
    print("=" * 60)
    
    success1 = test_openai_analyzer()
    success2 = test_with_real_api()
    
    print("\n" + "=" * 60)
    if success1 and success2:
        print("🎉 ALL TESTS PASSED - OpenAI integration is working!")
    else:
        print("❌ SOME TESTS FAILED - Check configuration")
    print("=" * 60)