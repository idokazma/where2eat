"""
Restaurant Analysis Pipeline
Automatically fetches YouTube transcripts and summarizes restaurant mentions
"""

import os
import json
import sys
from datetime import datetime
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


def analyze_restaurants(transcript_data):
    """
    Analyze transcript to extract restaurant information using Claude Code's Task agent
    
    Args:
        transcript_data (dict): Transcript data
        
    Returns:
        str: Restaurant analysis summary
    """
    print("🍽️  Analyzing restaurants mentioned in transcript...")
    
    # Prepare the transcript text for analysis
    transcript_text = transcript_data['transcript']
    video_info = f"Video: {transcript_data['video_url']} (Language: {transcript_data['language']})"
    
    # This will be handled by calling the Task agent
    # For now, return a placeholder that indicates where the analysis should happen
    analysis_prompt = f"""
Please analyze this Hebrew food podcast transcript and create a comprehensive summary of all restaurants mentioned.

{video_info}

For each restaurant mentioned, provide:
1. Restaurant name
2. Location (city, neighborhood, address if mentioned)
3. Type of cuisine/food
4. What the hosts said about it (positive/negative opinions)
5. Specific dishes or menu items mentioned
6. Price range if mentioned
7. Any other relevant details (atmosphere, service, etc.)

Also include:
- Overall themes discussed in the episode
- Any food trends mentioned
- Notable quotes about specific restaurants

Format the output as a structured summary that would be useful for a "where to eat" guide.

Transcript:
{transcript_text}
"""
    
    return analysis_prompt


def run_pipeline(video_url):
    """
    Run the complete restaurant analysis pipeline
    
    Args:
        video_url (str): YouTube video URL
        
    Returns:
        dict: Pipeline results
    """
    print("🚀 Starting Restaurant Analysis Pipeline")
    print("=" * 50)
    
    # Step 1: Fetch transcript
    transcript_data = fetch_transcript(video_url)
    if not transcript_data:
        return {"success": False, "error": "Failed to fetch transcript"}
    
    print()
    
    # Step 2: Save transcript
    text_file, json_file = save_transcript(transcript_data)
    
    print()
    
    # Step 3: Analyze restaurants
    analysis_prompt = analyze_restaurants(transcript_data)
    
    results = {
        "success": True,
        "video_url": video_url,
        "video_id": transcript_data['video_id'],
        "language": transcript_data['language'],
        "transcript_files": {
            "text": text_file,
            "json": json_file
        },
        "analysis_prompt": analysis_prompt,
        "timestamp": datetime.now().isoformat()
    }
    
    print("✅ Pipeline completed successfully!")
    print(f"📁 Files saved in transcripts/ directory")
    print(f"🎯 Ready for restaurant analysis")
    
    return results


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python restaurant_pipeline.py <youtube_url>")
        print("Example: python restaurant_pipeline.py 'https://www.youtube.com/watch?v=rGS7OCpZ8J4'")
        sys.exit(1)
    
    video_url = sys.argv[1]
    results = run_pipeline(video_url)
    
    if results["success"]:
        print("\n" + "=" * 50)
        print("📊 PIPELINE RESULTS")
        print("=" * 50)
        print(f"Video ID: {results['video_id']}")
        print(f"Language: {results['language']}")
        print(f"Transcript files: {results['transcript_files']['text']}")
        print(f"Ready for analysis: ✅")
    else:
        print(f"\n❌ Pipeline failed: {results['error']}")
        sys.exit(1)