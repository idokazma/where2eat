FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY api/requirements.txt ./api-requirements.txt
RUN pip install --no-cache-dir -r api-requirements.txt

# Install src dependencies for transcript collector and analyzers
RUN pip install --no-cache-dir \
    youtube-transcript-api \
    anthropic \
    openai \
    google-api-python-client \
    python-dotenv \
    httpx \
    apscheduler \
    yt-dlp \
    sqlalchemy \
    psycopg2-binary

# Copy source code
COPY src ./src
COPY api ./api

# Copy restaurant backup data to a path OUTSIDE the /app/data volume mount
# so it's always available for seeding even when a Railway volume is mounted
COPY data/restaurants_backup ./seed/restaurants_backup

# Also copy to the default data path (works when no volume is mounted)
COPY data/restaurants_backup ./data/restaurants_backup

# Set PYTHONPATH to include src directory for imports
ENV PYTHONPATH="/app/src:${PYTHONPATH}"

# Set working directory to api
WORKDIR /app/api

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
