#!/usr/bin/env python3
"""
Bridge script for Node.js API to call Python Database methods.
Usage: python api_db_bridge.py <method> <json_args>

This bridges the Express API to the SQLite database, replacing JSON file reads.
Supports WHERE2EAT_DB_PATH environment variable for testing.
"""

import sys
import json
import os
import importlib.util

# Add parent directory to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Import Database directly to avoid module init issues
spec = importlib.util.spec_from_file_location("database", os.path.join(project_root, "src", "database.py"))
database_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(database_module)
Database = database_module.Database


def get_database():
    """Get database instance, using test path if specified."""
    db_path = os.environ.get('WHERE2EAT_DB_PATH')
    return Database(db_path) if db_path else Database()


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Method name required"}))
        sys.exit(1)

    method_name = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    db = get_database()

    try:
        # ==================== Restaurant Operations ====================

        if method_name == 'get_all_restaurants':
            restaurants = db.get_all_restaurants(include_episode_info=True)
            print(json.dumps({
                "success": True,
                "restaurants": restaurants,
                "count": len(restaurants)
            }))

        elif method_name == 'search_restaurants':
            result = db.search_restaurants(
                location=args.get('location'),
                cuisine=args.get('cuisine'),
                price_range=args.get('price_range'),
                status=args.get('status'),
                host_opinion=args.get('host_opinion'),
                date_start=args.get('date_start'),
                date_end=args.get('date_end'),
                episode_id=args.get('episode_id'),
                sort_by=args.get('sort_by', 'analysis_date'),
                sort_direction=args.get('sort_direction', 'desc'),
                page=int(args.get('page', 1)),
                limit=int(args.get('limit', 20))
            )
            print(json.dumps({
                "success": True,
                **result
            }))

        elif method_name == 'get_restaurant':
            restaurant_id = args.get('restaurant_id')
            if not restaurant_id:
                print(json.dumps({
                    "success": False,
                    "error": "restaurant_id is required"
                }))
                sys.exit(1)

            restaurant = db.get_restaurant(restaurant_id)

            if restaurant:
                print(json.dumps({
                    "success": True,
                    "restaurant": restaurant
                }))
            else:
                print(json.dumps({
                    "success": False,
                    "error": "Restaurant not found"
                }))

        elif method_name == 'create_restaurant':
            name_hebrew = args.pop('name_hebrew', args.pop('name', 'Unknown'))
            episode_id = args.pop('episode_id', None)
            restaurant_id = db.create_restaurant(name_hebrew, episode_id, **args)
            print(json.dumps({
                "success": True,
                "restaurant_id": restaurant_id
            }))

        elif method_name == 'update_restaurant':
            restaurant_id = args.pop('restaurant_id')
            success = db.update_restaurant(restaurant_id, **args)
            print(json.dumps({
                "success": success
            }))

        elif method_name == 'delete_restaurant':
            restaurant_id = args.get('restaurant_id')
            success = db.delete_restaurant(restaurant_id)
            print(json.dumps({
                "success": success
            }))

        # ==================== Episode Operations ====================

        elif method_name == 'get_all_episodes':
            episodes = db.get_all_episodes()
            print(json.dumps({
                "success": True,
                "episodes": episodes,
                "count": len(episodes)
            }))

        elif method_name == 'get_episode':
            episode = db.get_episode(
                episode_id=args.get('episode_id'),
                video_id=args.get('video_id')
            )
            if episode:
                print(json.dumps({
                    "success": True,
                    "episode": episode
                }))
            else:
                print(json.dumps({
                    "success": False,
                    "error": "Episode not found"
                }))

        elif method_name == 'search_episodes':
            # Search episodes with optional filters
            episodes = db.get_all_episodes()

            # Apply filters
            query = args.get('query', '').lower()
            channel = args.get('channel', '').lower()

            filtered = []
            for ep in episodes:
                if query and query not in (ep.get('title') or '').lower():
                    continue
                if channel and channel not in (ep.get('channel_name') or '').lower():
                    continue
                filtered.append(ep)

            # Group restaurants by episode
            for ep in filtered:
                ep['restaurants'] = []
                result = db.search_restaurants(episode_id=ep.get('video_id'), limit=100)
                ep['restaurants'] = result.get('restaurants', [])

            print(json.dumps({
                "success": True,
                "episodes": filtered,
                "count": len(filtered)
            }))

        # ==================== Job Operations ====================

        elif method_name == 'create_job':
            job_id = db.create_job(
                job_type=args.get('job_type', 'video'),
                channel_url=args.get('channel_url'),
                video_url=args.get('video_url'),
                filters=args.get('filters', {}),
                processing_options=args.get('processing_options', {})
            )
            print(json.dumps({
                "success": True,
                "job_id": job_id
            }))

        elif method_name == 'get_job':
            job_id = args.get('job_id')
            if not job_id:
                print(json.dumps({
                    "success": False,
                    "error": "job_id is required"
                }))
                sys.exit(1)

            job = db.get_job(job_id)

            if job:
                # Format job for API response
                print(json.dumps({
                    "success": True,
                    "job": {
                        "id": job['id'],
                        "type": job['job_type'],
                        "status": job['status'],
                        "channelUrl": job.get('channel_url'),
                        "videoUrl": job.get('video_url'),
                        "progress": {
                            "videosCompleted": job.get('progress_videos_completed', 0),
                            "videosTotal": job.get('progress_videos_total', 0),
                            "videosFailed": job.get('progress_videos_failed', 0),
                            "restaurantsFound": job.get('progress_restaurants_found', 0)
                        },
                        "currentVideo": {
                            "id": job.get('current_video_id'),
                            "title": job.get('current_video_title'),
                            "step": job.get('current_step')
                        },
                        "error": job.get('error_message'),
                        "startedAt": job.get('started_at'),
                        "completedAt": job.get('completed_at'),
                        "createdAt": job.get('created_at')
                    }
                }))
            else:
                print(json.dumps({
                    "success": False,
                    "error": "Job not found"
                }))

        elif method_name == 'update_job_status':
            job_id = args.pop('job_id')
            status = args.pop('status')
            success = db.update_job_status(job_id, status, **args)
            print(json.dumps({
                "success": success
            }))

        elif method_name == 'update_job_progress':
            job_id = args.pop('job_id')
            success = db.update_job_progress(
                job_id,
                videos_completed=args.get('videos_completed'),
                videos_total=args.get('videos_total'),
                videos_failed=args.get('videos_failed'),
                restaurants_found=args.get('restaurants_found'),
                current_video_id=args.get('current_video_id'),
                current_video_title=args.get('current_video_title'),
                current_step=args.get('current_step')
            )
            print(json.dumps({
                "success": success
            }))

        elif method_name == 'list_jobs':
            status_filter = args.get('status')
            jobs = db.get_jobs(status=status_filter)

            # Format jobs for API response
            formatted_jobs = []
            for job in jobs:
                formatted_jobs.append({
                    "id": job['id'],
                    "type": job['job_type'],
                    "status": job['status'],
                    "channelUrl": job.get('channel_url'),
                    "videoUrl": job.get('video_url'),
                    "progress": {
                        "videosCompleted": job.get('progress_videos_completed', 0),
                        "videosTotal": job.get('progress_videos_total', 0),
                        "videosFailed": job.get('progress_videos_failed', 0),
                        "restaurantsFound": job.get('progress_restaurants_found', 0)
                    },
                    "startedAt": job.get('started_at'),
                    "completedAt": job.get('completed_at'),
                    "createdAt": job.get('created_at')
                })

            print(json.dumps({
                "success": True,
                "jobs": formatted_jobs,
                "count": len(formatted_jobs)
            }))

        elif method_name == 'cancel_job':
            job_id = args.get('job_id')
            success = db.update_job_status(job_id, 'cancelled')
            print(json.dumps({
                "success": success
            }))

        # ==================== Analytics Operations ====================

        elif method_name == 'get_timeline_analytics':
            # Get restaurants grouped by date
            result = db.search_restaurants(
                date_start=args.get('date_start'),
                date_end=args.get('date_end'),
                limit=1000  # Get all for analytics
            )

            # Group by date
            timeline = {}
            for restaurant in result.get('restaurants', []):
                date = restaurant.get('episode_info', {}).get('analysis_date', '')[:10]
                if date:
                    if date not in timeline:
                        timeline[date] = []
                    timeline[date].append(restaurant)

            # Convert to sorted list
            timeline_list = [
                {"date": date, "restaurants": restaurants, "count": len(restaurants)}
                for date, restaurants in sorted(timeline.items(), reverse=True)
            ]

            print(json.dumps({
                "success": True,
                "timeline": timeline_list,
                "total_restaurants": result['analytics']['total_count']
            }))

        elif method_name == 'get_trends_analytics':
            # Get aggregate analytics
            result = db.search_restaurants(limit=1000)
            analytics = result.get('analytics', {})

            # Calculate trends
            cuisine_trends = sorted(
                [{"cuisine": k, "count": v} for k, v in analytics.get('filter_counts', {}).get('cuisine', {}).items()],
                key=lambda x: x['count'],
                reverse=True
            )[:10]

            location_trends = sorted(
                [{"location": k, "count": v} for k, v in analytics.get('filter_counts', {}).get('location', {}).items()],
                key=lambda x: x['count'],
                reverse=True
            )[:10]

            opinion_distribution = analytics.get('filter_counts', {}).get('host_opinion', {})
            price_distribution = analytics.get('filter_counts', {}).get('price_range', {})

            print(json.dumps({
                "success": True,
                "trends": {
                    "top_cuisines": cuisine_trends,
                    "top_locations": location_trends,
                    "opinion_distribution": opinion_distribution,
                    "price_distribution": price_distribution,
                    "total_restaurants": analytics.get('total_count', 0)
                }
            }))

        elif method_name == 'get_stats':
            stats = db.get_stats()
            print(json.dumps({
                "success": True,
                "stats": stats
            }))

        # ==================== Edit History Operations ====================

        elif method_name == 'log_edit':
            log_id = db.log_restaurant_edit(
                restaurant_id=args.get('restaurant_id'),
                restaurant_name=args.get('restaurant_name'),
                admin_user_id=args.get('admin_user_id'),
                edit_type=args.get('edit_type'),
                changes=args.get('changes')
            )
            print(json.dumps({
                "success": True,
                "log_id": log_id
            }))

        elif method_name == 'get_edit_history':
            history = db.get_restaurant_edit_history(
                restaurant_id=args.get('restaurant_id'),
                admin_user_id=args.get('admin_user_id'),
                limit=args.get('limit', 100)
            )
            print(json.dumps({
                "success": True,
                "history": history
            }))

        # ==================== Import Operations ====================

        elif method_name == 'import_from_json':
            data_dir = args.get('data_dir', os.path.join(project_root, 'data', 'restaurants'))
            result = db.import_from_json_files(data_dir)
            print(json.dumps({
                "success": True,
                **result
            }))

        else:
            print(json.dumps({
                "success": False,
                "error": f"Unknown method: {method_name}"
            }))
            sys.exit(1)

    except Exception as e:
        import traceback
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
