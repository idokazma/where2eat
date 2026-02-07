"""Initial database schema

Revision ID: 0001
Revises:
Create Date: 2026-02-05

Creates all tables for Where2Eat:
- episodes: YouTube video episodes
- restaurants: Restaurant entries
- jobs: Background processing jobs
- admin_users: Admin dashboard users
- articles: Blog/content articles
- restaurant_history: Audit trail
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Episodes table
    op.create_table(
        'episodes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('video_id', sa.String(20), nullable=False, unique=True),
        sa.Column('video_url', sa.String(255), nullable=False),
        sa.Column('channel_id', sa.String(50)),
        sa.Column('channel_name', sa.String(255)),
        sa.Column('title', sa.String(500)),
        sa.Column('language', sa.String(10), default='he'),
        sa.Column('analysis_date', sa.DateTime),
        sa.Column('transcript', sa.Text),
        sa.Column('food_trends', sa.JSON),
        sa.Column('episode_summary', sa.Text),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_episodes_video_id', 'episodes', ['video_id'])

    # Restaurants table
    op.create_table(
        'restaurants',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('episode_id', sa.String(36), sa.ForeignKey('episodes.id')),
        sa.Column('name_hebrew', sa.String(255), nullable=False),
        sa.Column('name_english', sa.String(255)),
        # Location
        sa.Column('city', sa.String(100)),
        sa.Column('neighborhood', sa.String(100)),
        sa.Column('address', sa.String(255)),
        sa.Column('region', sa.String(50), default='Center'),
        sa.Column('latitude', sa.Float),
        sa.Column('longitude', sa.Float),
        # Details
        sa.Column('cuisine_type', sa.String(100)),
        sa.Column('status', sa.String(20), default='open'),
        sa.Column('price_range', sa.String(20)),
        sa.Column('host_opinion', sa.String(50)),
        sa.Column('host_comments', sa.Text),
        # Structured data
        sa.Column('menu_items', sa.JSON),
        sa.Column('special_features', sa.JSON),
        # Contact
        sa.Column('contact_hours', sa.String(255)),
        sa.Column('contact_phone', sa.String(50)),
        sa.Column('contact_website', sa.String(255)),
        sa.Column('contact_social', sa.String(255)),
        # Additional
        sa.Column('business_news', sa.Text),
        sa.Column('mention_context', sa.Text),
        sa.Column('mention_timestamp', sa.Float),
        # Google Places
        sa.Column('google_place_id', sa.String(100)),
        sa.Column('google_name', sa.String(255)),
        sa.Column('google_url', sa.String(500)),
        sa.Column('google_rating', sa.Float),
        sa.Column('google_user_ratings_total', sa.Integer),
        sa.Column('enriched_at', sa.DateTime),
        # Photos
        sa.Column('photos', sa.JSON),
        sa.Column('image_url', sa.String(500)),
        # Timestamps
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_restaurants_city', 'restaurants', ['city'])
    op.create_index('ix_restaurants_cuisine_type', 'restaurants', ['cuisine_type'])
    op.create_index('ix_restaurants_city_cuisine', 'restaurants', ['city', 'cuisine_type'])
    op.create_index('ix_restaurants_location', 'restaurants', ['latitude', 'longitude'])

    # Jobs table
    op.create_table(
        'jobs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('job_type', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('channel_url', sa.String(255)),
        sa.Column('video_url', sa.String(255)),
        sa.Column('filters', sa.JSON),
        sa.Column('processing_options', sa.JSON),
        sa.Column('progress_videos_completed', sa.Integer, default=0),
        sa.Column('progress_videos_total', sa.Integer, default=0),
        sa.Column('progress_videos_failed', sa.Integer, default=0),
        sa.Column('progress_restaurants_found', sa.Integer, default=0),
        sa.Column('current_video_id', sa.String(20)),
        sa.Column('current_video_title', sa.String(500)),
        sa.Column('current_step', sa.String(100)),
        sa.Column('error_message', sa.Text),
        sa.Column('started_at', sa.DateTime),
        sa.Column('completed_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
    )
    op.create_index('ix_jobs_status', 'jobs', ['status'])

    # Admin users table
    op.create_table(
        'admin_users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('last_login', sa.DateTime),
    )
    op.create_index('ix_admin_users_email', 'admin_users', ['email'])

    # Articles table
    op.create_table(
        'articles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('slug', sa.String(500), nullable=False, unique=True),
        sa.Column('excerpt', sa.Text),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('featured_image', sa.String(500)),
        sa.Column('status', sa.String(20), default='draft'),
        sa.Column('author_id', sa.String(36), sa.ForeignKey('admin_users.id'), nullable=False),
        sa.Column('category', sa.String(100)),
        sa.Column('tags', sa.JSON),
        sa.Column('seo_title', sa.String(255)),
        sa.Column('seo_description', sa.Text),
        sa.Column('seo_keywords', sa.String(500)),
        sa.Column('published_at', sa.DateTime),
        sa.Column('scheduled_for', sa.DateTime),
        sa.Column('view_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_articles_slug', 'articles', ['slug'])
    op.create_index('ix_articles_status', 'articles', ['status'])
    op.create_index('ix_articles_published_at', 'articles', ['published_at'])

    # Restaurant history table
    op.create_table(
        'restaurant_history',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('restaurant_id', sa.String(36), sa.ForeignKey('restaurants.id'), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('changed_by', sa.String(36)),
        sa.Column('changes', sa.JSON),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
    )
    op.create_index('ix_restaurant_history_restaurant_created', 'restaurant_history', ['restaurant_id', 'created_at'])


def downgrade() -> None:
    op.drop_table('restaurant_history')
    op.drop_table('articles')
    op.drop_table('admin_users')
    op.drop_table('jobs')
    op.drop_table('restaurants')
    op.drop_table('episodes')
