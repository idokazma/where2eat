# Multi-stage build for Where2Eat API with Node.js and Python support
FROM node:20-alpine AS base

# Install Python for transcript collection and analysis
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files for Node.js dependencies
COPY api/package*.json ./api/

# Install Node.js dependencies
WORKDIR /app/api
RUN npm ci --only=production

# Go back to app root
WORKDIR /app

# Install Python dependencies for transcript collection
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages \
    youtube-transcript-api \
    anthropic \
    openai \
    google-api-python-client \
    python-dotenv \
    httpx

# Copy source code
COPY api ./api
COPY src ./src
COPY scripts ./scripts
COPY data/restaurants_backup ./data/restaurants_backup

# Set environment variables
ENV PYTHONPATH="/app/src:${PYTHONPATH}"
ENV NODE_ENV=production
ENV PORT=3001

# Set working directory to api
WORKDIR /app/api

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

# Start the Node.js server
CMD ["node", "index.js"]
