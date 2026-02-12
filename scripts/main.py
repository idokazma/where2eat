"""
Demo Main - YouTube Podcast Restaurant Analyzer
Given links to YouTube podcasts, returns detailed summaries of all restaurants mentioned.
All agent calls are logged for tracking.
"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import List, Dict, Any
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.youtube_transcript_collector import YouTubeTranscriptCollector
from src.restaurant_analyzer import create_analysis_request, save_transcript
from src.restaurant_search_agent import RestaurantSearchAgent
from src.unified_restaurant_analyzer import UnifiedRestaurantAnalyzer


# Configure logging
def setup_logging():
    """Set up comprehensive logging for all operations"""
    os.makedirs("logs", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = f"logs/demo_main_{timestamp}.log"
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    return logging.getLogger(__name__)


class RestaurantPodcastAnalyzer:
    """Main class for analyzing restaurants from YouTube podcasts"""
    
    def __init__(self):
        self.logger = setup_logging()
        self.transcript_collector = YouTubeTranscriptCollector()
        self.search_agent = RestaurantSearchAgent()
        
        # Initialize unified restaurant analyzer
        self.restaurant_analyzer = None
        try:
            self.restaurant_analyzer = UnifiedRestaurantAnalyzer()
            self.logger.info(f"✅ Initialized {self.restaurant_analyzer.config.provider.upper()} analyzer")
        except Exception as e:
            self.logger.warning(f"⚠️ Failed to initialize restaurant analyzer: {str(e)}")
            self.logger.warning("⚠️ LLM analysis will be skipped - only transcript collection will work")
            self.logger.warning("⚠️ Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env file to enable analysis")
        
        self.results = {}
        
        # Create output directories
        os.makedirs("demo_results", exist_ok=True)
        os.makedirs("transcripts", exist_ok=True)
        os.makedirs("analyses", exist_ok=True)
        os.makedirs("logs", exist_ok=True)
        
        self.logger.info("🚀 RestaurantPodcastAnalyzer initialized")
    
    def log_agent_call(self, agent_type: str, action: str, details: Dict = None):
        """Log all agent calls with details"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "agent_type": agent_type,
            "action": action,
            "details": details or {}
        }
        
        self.logger.info(f"AGENT_CALL: {agent_type} - {action}")
        if details:
            self.logger.info(f"AGENT_DETAILS: {json.dumps(details, indent=2)}")
        
        # Save to agent calls log
        agent_log_file = f"logs/agent_calls_{datetime.now().strftime('%Y%m%d')}.json"
        
        # Read existing log or create new
        agent_calls = []
        if os.path.exists(agent_log_file):
            try:
                with open(agent_log_file, 'r', encoding='utf-8') as f:
                    agent_calls = json.load(f)
            except:
                agent_calls = []
        
        agent_calls.append(log_entry)
        
        # Save updated log
        with open(agent_log_file, 'w', encoding='utf-8') as f:
            json.dump(agent_calls, f, ensure_ascii=False, indent=2)
    
    def fetch_transcript(self, video_url: str) -> Dict:
        """Fetch transcript from YouTube video with logging"""
        self.log_agent_call("YouTubeTranscriptCollector", "fetch_transcript", {
            "video_url": video_url
        })
        
        self.logger.info(f"🎥 Fetching transcript from: {video_url}")
        
        # Try Hebrew first, then auto-detect
        result = self.transcript_collector.get_transcript(video_url, languages=['he', 'iw'])
        if not result:
            self.logger.info("Hebrew transcript not found, trying auto-detect...")
            self.log_agent_call("YouTubeTranscriptCollector", "get_transcript_auto", {
                "video_url": video_url,
                "fallback": "auto_detect"
            })
            result = self.transcript_collector.get_transcript_auto(video_url)
        
        if result:
            self.logger.info(f"✅ Successfully fetched transcript")
            self.logger.info(f"   - Language: {result['language']}")
            self.logger.info(f"   - Segments: {result['segment_count']}")
            self.logger.info(f"   - Characters: {len(result['transcript'])}")
            
            self.log_agent_call("YouTubeTranscriptCollector", "fetch_success", {
                "video_id": result['video_id'],
                "language": result['language'],
                "segment_count": result['segment_count'],
                "character_count": len(result['transcript'])
            })
        else:
            self.logger.error("❌ Failed to fetch transcript")
            self.log_agent_call("YouTubeTranscriptCollector", "fetch_failed", {
                "video_url": video_url
            })
        
        return result
    
    def analyze_restaurants_in_transcript(self, transcript_data: Dict) -> str:
        """Create analysis request for Claude agent"""
        self.log_agent_call("RestaurantAnalyzer", "create_analysis_request", {
            "video_id": transcript_data['video_id'],
            "language": transcript_data['language'],
            "transcript_length": len(transcript_data['transcript'])
        })
        
        self.logger.info("🤖 Creating restaurant analysis request for Claude...")
        
        # Create analysis request using existing function
        analysis_request = create_analysis_request(transcript_data)
        
        # Save the analysis request
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        request_file = f"analyses/{transcript_data['video_id']}_{timestamp}_analysis_request.txt"
        
        with open(request_file, 'w', encoding='utf-8') as f:
            f.write(analysis_request)
        
        self.logger.info(f"✅ Analysis request saved: {request_file}")
        
        self.log_agent_call("RestaurantAnalyzer", "analysis_request_saved", {
            "video_id": transcript_data['video_id'],
            "request_file": request_file,
            "request_length": len(analysis_request)
        })
        
        return request_file
    
    def search_restaurant_details(self, restaurant_name: str, city: str = None) -> str:
        """Search for detailed restaurant information using search agent"""
        self.log_agent_call("RestaurantSearchAgent", "search_restaurant", {
            "restaurant_name": restaurant_name,
            "city": city
        })
        
        self.logger.info(f"🔍 Searching for restaurant details: {restaurant_name}")
        if city:
            self.logger.info(f"📍 Location: {city}")
        
        # Use existing search agent
        restaurant_info = self.search_agent.search_restaurant(restaurant_name, city)
        
        # Save the search results
        results_file = self.search_agent.save_restaurant_results(restaurant_info)
        
        self.log_agent_call("RestaurantSearchAgent", "search_completed", {
            "restaurant_name": restaurant_name,
            "city": city,
            "results_file": results_file
        })
        
        return results_file
    
    def process_single_podcast(self, video_url: str) -> Dict:
        """Process a single YouTube podcast for restaurant analysis"""
        self.logger.info("=" * 80)
        self.logger.info(f"🎯 PROCESSING PODCAST: {video_url}")
        self.logger.info("=" * 80)
        
        result = {
            "video_url": video_url,
            "success": False,
            "timestamp": datetime.now().isoformat(),
            "files_generated": []
        }
        
        try:
            # Step 1: Fetch transcript
            transcript_data = self.fetch_transcript(video_url)
            if not transcript_data:
                result["error"] = "Failed to fetch transcript"
                return result
            
            result["video_id"] = transcript_data['video_id']
            result["language"] = transcript_data['language']
            
            # Step 2: Save transcript
            self.logger.info("💾 Saving transcript files...")
            text_file, json_file = save_transcript(transcript_data)
            result["files_generated"].extend([text_file, json_file])
            
            # Step 3: Create restaurant analysis request
            analysis_request_file = self.analyze_restaurants_in_transcript(transcript_data)
            result["files_generated"].append(analysis_request_file)
            result["analysis_request_file"] = analysis_request_file
            
            # Step 4: Process with LLM to extract restaurants and save to API format
            try:
                self.logger.info(f"🤖 Analyzing transcript with {self.restaurant_analyzer.config.provider.upper()} to extract restaurants...")
                restaurants_data = self.extract_restaurants_with_llm(transcript_data)
                if restaurants_data and restaurants_data.get('restaurants'):
                    api_file = self.save_restaurants_for_api(restaurants_data, transcript_data)
                    result["files_generated"].append(api_file)
                    result["api_data_file"] = api_file
                    self.logger.info(f"✅ Restaurant data saved for API: {api_file}")
                else:
                    self.logger.warning("⚠️ LLM analysis returned no restaurants")
            except Exception as llm_error:
                self.logger.error(f"⚠️ LLM analysis failed: {str(llm_error)}")
                self.logger.error("⚠️ Check that OPENAI_API_KEY or ANTHROPIC_API_KEY is set in .env file")
                # Save transcript info even if LLM fails
                self.save_transcript_metadata(transcript_data)
                result["llm_error"] = str(llm_error)
            
            # Step 5: Mark as ready for Claude analysis
            result["success"] = True
            result["ready_for_analysis"] = True
            
            self.logger.info("✅ Podcast processing completed successfully!")
            self.logger.info(f"📁 Files generated: {len(result['files_generated'])}")
            
        except Exception as e:
            self.logger.error(f"❌ Error processing podcast: {str(e)}")
            result["error"] = str(e)
            self.log_agent_call("RestaurantPodcastAnalyzer", "process_error", {
                "video_url": video_url,
                "error": str(e)
            })
        
        return result
    
    def extract_restaurants_with_llm(self, transcript_data: Dict) -> Dict:
        """Extract restaurant information from transcript using LLM analysis"""
        if self.restaurant_analyzer is None:
            raise ValueError("LLM analyzer not initialized - missing API key. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env file.")

        provider = self.restaurant_analyzer.config.provider
        self.logger.info(f"🤖 Extracting restaurants from transcript using {provider.upper()} analysis...")
        
        try:
            # Use configured LLM to analyze the transcript
            analysis_results = self.restaurant_analyzer.analyze_transcript(transcript_data)
            
            # Save the analysis results
            self.restaurant_analyzer.save_analysis(analysis_results)
            
            # Log the analysis
            self.log_agent_call("UnifiedRestaurantAnalyzer", "analyze_transcript", {
                "video_id": transcript_data['video_id'],
                "llm_provider": provider,
                "restaurants_found": len(analysis_results.get('restaurants', [])),
                "processing_method": analysis_results.get('episode_info', {}).get('processing_method', provider)
            })
            
            return analysis_results
            
        except Exception as e:
            self.logger.error(f"❌ {provider.upper()} analysis failed: {str(e)}")
            self.log_agent_call("UnifiedRestaurantAnalyzer", "analysis_error", {
                "video_id": transcript_data['video_id'],
                "llm_provider": provider,
                "error": str(e)
            })
            
            # Return error instead of fallback
            raise e
    
    def save_transcript_metadata(self, transcript_data: Dict) -> str:
        """Save basic transcript metadata when LLM analysis fails"""
        transcripts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "transcripts")
        os.makedirs(transcripts_dir, exist_ok=True)

        metadata = {
            "video_id": transcript_data.get('video_id'),
            "video_url": transcript_data.get('video_url'),
            "language": transcript_data.get('language'),
            "segment_count": transcript_data.get('segment_count'),
            "transcript_length": len(transcript_data.get('transcript', '')),
            "fetched_at": datetime.now().isoformat(),
            "status": "transcript_only",
            "note": "LLM analysis failed - transcript saved for manual processing"
        }

        filename = f"{transcript_data['video_id']}_metadata.json"
        filepath = os.path.join(transcripts_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        self.logger.info(f"📝 Saved transcript metadata: {filepath}")
        return filepath

    def save_restaurants_for_api(self, restaurants_data: Dict, transcript_data: Dict) -> str:
        """Save restaurant data in the format expected by the API"""
        # Create data/restaurants directory if it doesn't exist
        restaurants_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "restaurants")
        os.makedirs(restaurants_dir, exist_ok=True)
        
        # Save each restaurant as a separate file
        files_created = []
        for i, restaurant in enumerate(restaurants_data["restaurants"]):
            # Add episode info to each restaurant
            restaurant_with_episode = {
                **restaurant,
                "episode_info": restaurants_data["episode_info"],
                "food_trends": restaurants_data["food_trends"],
                "episode_summary": restaurants_data["episode_summary"]
            }
            
            # Generate filename
            restaurant_id = f"{transcript_data['video_id']}_{i+1}"
            filename = f"{restaurant_id}.json"
            filepath = os.path.join(restaurants_dir, filename)
            
            # Save to file
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(restaurant_with_episode, f, ensure_ascii=False, indent=2)
            
            files_created.append(filepath)
            self.logger.info(f"✅ Saved restaurant data: {filepath}")
        
        return f"Saved {len(files_created)} restaurant files to {restaurants_dir}"
    
    def process_multiple_podcasts(self, video_urls: List[str]) -> Dict:
        """Process multiple YouTube podcasts"""
        self.logger.info("🚀 STARTING BATCH PODCAST ANALYSIS")
        self.logger.info(f"📺 Processing {len(video_urls)} podcasts")
        self.logger.info("=" * 80)
        
        batch_results = {
            "total_podcasts": len(video_urls),
            "successful": 0,
            "failed": 0,
            "results": [],
            "timestamp": datetime.now().isoformat()
        }
        
        for i, video_url in enumerate(video_urls, 1):
            self.logger.info(f"\n[{i}/{len(video_urls)}] Processing: {video_url}")
            
            try:
                result = self.process_single_podcast(video_url)
                batch_results["results"].append(result)
                
                if result["success"]:
                    batch_results["successful"] += 1
                    self.logger.info(f"✅ [{i}/{len(video_urls)}] Success: {video_url}")
                else:
                    batch_results["failed"] += 1
                    self.logger.error(f"❌ [{i}/{len(video_urls)}] Failed: {video_url}")
                    
            except Exception as e:
                self.logger.error(f"❌ [{i}/{len(video_urls)}] Exception: {str(e)}")
                batch_results["failed"] += 1
                batch_results["results"].append({
                    "video_url": video_url,
                    "success": False,
                    "error": str(e)
                })
        
        # Save batch results
        self.save_batch_results(batch_results)
        
        self.logger.info("\n" + "=" * 80)
        self.logger.info("📊 BATCH ANALYSIS COMPLETE")
        self.logger.info("=" * 80)
        self.logger.info(f"✅ Successful: {batch_results['successful']}")
        self.logger.info(f"❌ Failed: {batch_results['failed']}")
        self.logger.info(f"📈 Success Rate: {batch_results['successful']/len(video_urls)*100:.1f}%")
        
        return batch_results
    
    def save_batch_results(self, batch_results: Dict):
        """Save batch processing results to files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save JSON results
        json_file = f"demo_results/batch_analysis_{timestamp}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(batch_results, f, ensure_ascii=False, indent=2)
        
        # Save human-readable summary
        summary_file = f"demo_results/batch_summary_{timestamp}.md"
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(f"# YouTube Podcast Restaurant Analysis Summary\n\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"## Overview\n")
            f.write(f"- **Total Podcasts:** {batch_results['total_podcasts']}\n")
            f.write(f"- **Successful:** {batch_results['successful']}\n")
            f.write(f"- **Failed:** {batch_results['failed']}\n")
            f.write(f"- **Success Rate:** {batch_results['successful']/batch_results['total_podcasts']*100:.1f}%\n\n")
            
            f.write(f"## Results Details\n\n")
            for i, result in enumerate(batch_results['results'], 1):
                f.write(f"### {i}. {result['video_url']}\n")
                if result['success']:
                    f.write(f"- ✅ **Status:** Success\n")
                    f.write(f"- **Video ID:** {result.get('video_id', 'N/A')}\n")
                    f.write(f"- **Language:** {result.get('language', 'N/A')}\n")
                    f.write(f"- **Files Generated:** {len(result.get('files_generated', []))}\n")
                    f.write(f"- **Analysis Request:** {result.get('analysis_request_file', 'N/A')}\n")
                else:
                    f.write(f"- ❌ **Status:** Failed\n")
                    f.write(f"- **Error:** {result.get('error', 'Unknown error')}\n")
                f.write("\n")
        
        self.logger.info(f"📊 Batch results saved:")
        self.logger.info(f"   JSON: {json_file}")
        self.logger.info(f"   Summary: {summary_file}")
    
    def display_next_steps(self, batch_results: Dict):
        """Display next steps for using the generated analysis requests"""
        self.logger.info("\n🎯 NEXT STEPS FOR RESTAURANT ANALYSIS:")
        self.logger.info("=" * 60)
        
        successful_results = [r for r in batch_results['results'] if r['success']]
        
        if successful_results:
            self.logger.info("📋 Analysis requests have been prepared for Claude Code's Task agent:")
            self.logger.info("")
            
            for i, result in enumerate(successful_results, 1):
                self.logger.info(f"{i}. Video: {result['video_id']}")
                self.logger.info(f"   Analysis Request: {result['analysis_request_file']}")
                self.logger.info("")
            
            self.logger.info("🤖 To complete the restaurant analysis:")
            self.logger.info("1. Use Claude Code's Task agent with each analysis request file")
            self.logger.info("2. The Task agent will analyze the transcripts and extract restaurant information")
            self.logger.info("3. For detailed restaurant searches, use the restaurant search agent requests")
            self.logger.info("")
            self.logger.info("💡 All agent calls have been logged in the logs/ directory")
        else:
            self.logger.info("❌ No successful podcast processing. Check the logs for errors.")


def main():
    """Main function to run the restaurant podcast analyzer"""
    if len(sys.argv) < 2:
        print("Usage: python demo_main.py <youtube_url1> [youtube_url2] [youtube_url3] ...")
        print("")
        print("Examples:")
        print("  Single podcast:")
        print("    python demo_main.py 'https://www.youtube.com/watch?v=VIDEO_ID'")
        print("")
        print("  Multiple podcasts:")
        print("    python demo_main.py 'https://www.youtube.com/watch?v=VIDEO1' 'https://www.youtube.com/watch?v=VIDEO2'")
        print("")
        print("Features:")
        print("  - Fetches YouTube podcast transcripts")
        print("  - Creates detailed restaurant analysis requests")
        print("  - Logs all agent calls for tracking")
        print("  - Generates files ready for Claude Code analysis")
        sys.exit(1)
    
    # Get video URLs from command line arguments
    video_urls = sys.argv[1:]
    
    # Initialize analyzer
    analyzer = RestaurantPodcastAnalyzer()
    
    # Process podcasts
    if len(video_urls) == 1:
        # Single podcast
        result = analyzer.process_single_podcast(video_urls[0])
        if result["success"]:
            analyzer.logger.info("\n🎯 SINGLE PODCAST ANALYSIS COMPLETE")
            analyzer.logger.info(f"✅ Video ID: {result['video_id']}")
            analyzer.logger.info(f"✅ Language: {result['language']}")
            analyzer.logger.info(f"✅ Analysis Request: {result['analysis_request_file']}")
            analyzer.logger.info("\n🤖 Ready for Claude Code Task agent analysis!")
        else:
            analyzer.logger.error(f"❌ Failed to process podcast: {result.get('error', 'Unknown error')}")
            sys.exit(1)
    else:
        # Multiple podcasts
        batch_results = analyzer.process_multiple_podcasts(video_urls)
        analyzer.display_next_steps(batch_results)


if __name__ == "__main__":
    main()