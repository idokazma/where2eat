#!/usr/bin/env python3
"""
Bridge script for article database operations called from Node.js.
Usage: python articles_db_bridge.py <method> <json_args>
"""

import sys
import json
import os

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from src.database import Database

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Method required'}))
        sys.exit(1)

    method = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    db = Database()

    try:
        if method == 'create_article':
            article_id = db.create_article(
                title=args['title'],
                slug=args['slug'],
                content=args['content'],
                author_id=args['author_id'],
                excerpt=args.get('excerpt'),
                featured_image=args.get('featured_image'),
                status=args.get('status', 'draft'),
                category=args.get('category'),
                tags=args.get('tags', []),
                seo_title=args.get('seo_title'),
                seo_description=args.get('seo_description'),
                seo_keywords=args.get('seo_keywords'),
                published_at=args.get('published_at'),
                scheduled_for=args.get('scheduled_for')
            )
            print(json.dumps({'article_id': article_id}))

        elif method == 'get_article':
            article = db.get_article(
                article_id=args.get('article_id'),
                slug=args.get('slug')
            )
            print(json.dumps({'article': article}))

        elif method == 'list_articles':
            articles = db.list_articles(
                status=args.get('status'),
                author_id=args.get('author_id'),
                limit=args.get('limit', 50),
                offset=args.get('offset', 0)
            )
            print(json.dumps({'articles': articles}))

        elif method == 'update_article':
            article_id = args.pop('article_id')
            success = db.update_article(article_id, **args)
            print(json.dumps({'success': success}))

        elif method == 'delete_article':
            success = db.delete_article(args['article_id'])
            print(json.dumps({'success': success}))

        elif method == 'count_articles':
            count = db.count_articles(status=args.get('status'))
            print(json.dumps({'count': count}))

        else:
            print(json.dumps({'error': f'Unknown method: {method}'}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
