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
    httpx

# Copy source code
COPY src ./src
COPY api ./api

# Set working directory to api
WORKDIR /app/api

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
