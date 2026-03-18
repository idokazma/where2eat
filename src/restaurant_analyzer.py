"""
Restaurant Analysis Pipeline with Claude Agent
Automatically fetches YouTube transcripts and uses Claude to analyze restaurant mentions
"""

import os
import json
import sys
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(__file__))
from youtube_transcript_collector import YouTubeTranscriptCollector


def fetch_transcript(video_url):
    """
    Fetch transcript from YouTube video
    
    Args:
        video_url (str): YouTube video URL
        
    Returns:
        dict: Transcript data or None if failed
    """
    print(f"🎥 Fetching transcript from: {video_url}")
    
    collector = YouTubeTranscriptCollector()
    
    # Try Hebrew first, then auto-detect
    result = collector.get_transcript(video_url, languages=['iw', 'he'])
    if not result:
        print("Hebrew transcript not found, trying auto-detect...")
        result = collector.get_transcript_auto(video_url)
    
    if result:
        print(f"✅ Successfully fetched transcript")
        print(f"   - Language: {result['language']}")
        print(f"   - Segments: {result['segment_count']}")
        print(f"   - Characters: {len(result['transcript'])}")
        return result
    else:
        print("❌ Failed to fetch transcript")
        return None


def save_transcript(transcript_data):
    """
    Save transcript data to files
    
    Args:
        transcript_data (dict): Transcript data
        
    Returns:
        tuple: (text_file_path, json_file_path)
    """
    print("💾 Saving transcript files...")
    
    # Create transcripts directory if it doesn't exist
    os.makedirs("transcripts", exist_ok=True)
    
    video_id = transcript_data['video_id']
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Save text file
    text_filename = f"transcripts/{video_id}_{timestamp}.txt"
    with open(text_filename, 'w', encoding='utf-8') as f:
        f.write(f"YouTube Video: {transcript_data['video_url']}\n")
        f.write(f"Video ID: {transcript_data['video_id']}\n")
        f.write(f"Language: {transcript_data['language']}\n")
        f.write(f"Fetched: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total Segments: {transcript_data['segment_count']}\n")
        f.write(f"Total Characters: {len(transcript_data['transcript'])}\n")
        f.write("=" * 80 + "\n\n")
        f.write(transcript_data['transcript'])
    
    # Save JSON file
    json_filename = f"transcripts/{video_id}_{timestamp}.json"
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(transcript_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Saved transcript as: {text_filename}")
    print(f"✅ Saved detailed data as: {json_filename}")
    
    return text_filename, json_filename


def create_analysis_request(transcript_data):
    """
    Create the analysis request that will be sent to Claude via the Task agent

    Args:
        transcript_data (dict): Transcript data

    Returns:
        str: Formatted analysis request
    """

    # Truncate transcript if it's too long (keep first 15000 chars to stay within limits)
    transcript_text = transcript_data['transcript']
    if len(transcript_text) > 15000:
        transcript_text = transcript_text[:15000] + "\n\n[TRANSCRIPT TRUNCATED - SHOWING FIRST PORTION ONLY]"

    video_info = f"Video: {transcript_data['video_url']} (Language: {transcript_data['language']})"

    analysis_request = f"""Analyze this Hebrew food podcast transcript and extract ALL restaurants mentioned by name.

{video_info}

TASK: Extract and summarize all restaurant information from this Hebrew food podcast transcript.

EXTRACTION GUIDELINES:
1. Look for Hebrew patterns: "במסעדת X", "מסעדת X", "ביסטרו X", "בית קפה X", "של X", "אצל X"
2. Look for location patterns: "[name] בתל אביב", "[name] ברחוב X"
3. Include chef-owned restaurants: "המסעדה של [שף]"

DO NOT EXTRACT:
- Generic food terms: "חומוס", "שווארמה", "פיצה" (unless part of restaurant name)
- Food brands: "אסם", "תנובה", "שטראוס"
- Dish names that are not restaurant names
- Vague references: "מסעדה אחת", "מקום מסוים", "בית קפה ליד"

FOR EACH RESTAURANT, PROVIDE:
1. Restaurant name (in Hebrew and accurate English transliteration)
2. Confidence level: high/medium/low
3. Location (city, neighborhood, specific address if mentioned)
4. Type of cuisine/food and establishment type (מסעדה/ביסטרו/בית קפה/פוד טראק/מאפייה/בר)
5. Host opinion (חיובית מאוד/חיובית/ניטרלית/שלילית/מעורבת)
6. Whether the host recommends it (yes/no)
7. Direct quotes or paraphrases from the hosts
8. Signature dishes and other menu items mentioned
9. Chef name if mentioned
10. Price range if mentioned (זול/בינוני/יקר/יוקרתי)
11. Special features (atmosphere, service, location features)
12. Any business news (openings, closings, changes)

CONFIDENCE LEVELS:
- "high": שם מפורש עם הקשר ברור (e.g., "הלכנו למסעדת צ'קולי בנמל")
- "medium": שם מוזכר אך הקשר חלקי
- "low": שם לא ברור או נשמע חלקית

ALSO INCLUDE:
- Overall themes and food trends discussed in the episode
- Notable quotes about specific restaurants
- Any news about restaurant openings, closings, or changes

FORMAT: Structure the output as a clear, organized summary with bullet points and headings.

TRANSCRIPT TEXT:
{transcript_text}

Be thorough but precise. Extract ALL valid restaurants, skip generic food terms and vague references."""

    return analysis_request


def save_analysis_result(analysis_result, video_id):
    """
    Save the analysis result to a file
    
    Args:
        analysis_result (str): The analysis result from Claude
        video_id (str): Video ID for filename
        
    Returns:
        str: Analysis file path
    """
    os.makedirs("analyses", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    analysis_filename = f"analyses/{video_id}_{timestamp}_analysis.md"
    
    with open(analysis_filename, 'w', encoding='utf-8') as f:
        f.write(f"# Restaurant Analysis\n\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Video ID:** {video_id}\n\n")
        f.write("---\n\n")
        f.write(analysis_result)
    
    return analysis_filename


def run_complete_pipeline(video_url):
    """
    Run the complete restaurant analysis pipeline including Claude analysis
    
    Args:
        video_url (str): YouTube video URL
        
    Returns:
        dict: Complete pipeline results
    """
    print("🚀 Starting Complete Restaurant Analysis Pipeline")
    print("=" * 60)
    
    # Step 1: Fetch transcript
    transcript_data = fetch_transcript(video_url)
    if not transcript_data:
        return {"success": False, "error": "Failed to fetch transcript"}
    
    print()
    
    # Step 2: Save transcript
    text_file, json_file = save_transcript(transcript_data)
    
    print()
    
    # Step 3: Prepare analysis request
    print("🤖 Preparing analysis request for Claude...")
    analysis_request = create_analysis_request(transcript_data)
    
    # Save the analysis request for reference
    request_filename = f"analyses/{transcript_data['video_id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_request.txt"
    os.makedirs("analyses", exist_ok=True)
    with open(request_filename, 'w', encoding='utf-8') as f:
        f.write(analysis_request)
    
    print(f"✅ Analysis request prepared and saved: {request_filename}")
    
    results = {
        "success": True,
        "video_url": video_url,
        "video_id": transcript_data['video_id'],
        "language": transcript_data['language'],
        "transcript_files": {
            "text": text_file,
            "json": json_file
        },
        "analysis_request_file": request_filename,
        "analysis_request": analysis_request,
        "timestamp": datetime.now().isoformat()
    }
    
    print("\n✅ Pipeline preparation completed!")
    print(f"📁 Transcript files: transcripts/ directory")
    print(f"📋 Analysis request: {request_filename}")
    print("\n🤖 Ready to send to Claude for restaurant analysis")
    print("💡 The analysis request has been prepared and saved.")
    print("💡 You can now use Claude Code's Task agent to process this request.")
    
    return results


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python restaurant_analyzer.py <youtube_url>")
        print("Example: python restaurant_analyzer.py 'https://www.youtube.com/watch?v=rGS7OCpZ8J4'")
        sys.exit(1)
    
    video_url = sys.argv[1]
    results = run_complete_pipeline(video_url)
    
    if results["success"]:
        print("\n" + "=" * 60)
        print("📊 COMPLETE PIPELINE RESULTS")
        print("=" * 60)
        print(f"✅ Video ID: {results['video_id']}")
        print(f"✅ Language: {results['language']}")
        print(f"✅ Transcript: {results['transcript_files']['text']}")
        print(f"✅ Analysis Request: {results['analysis_request_file']}")
        print(f"✅ Ready for Claude analysis")
        
        # Show a preview of the analysis request
        print(f"\n📋 Analysis Request Preview (first 200 chars):")
        print("-" * 40)
        print(results['analysis_request'][:200] + "...")
        
    else:
        print(f"\n❌ Pipeline failed: {results['error']}")
        sys.exit(1)