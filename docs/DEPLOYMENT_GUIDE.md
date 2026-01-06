# Where2Eat Deployment Guide

This guide covers deploying the Where2Eat project using GitHub and various cloud platforms.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js       │────▶│   Express API   │────▶│  Python Backend │
│   Frontend      │     │   (Node.js)     │     │  (Scrapers/AI)  │
│   (Vercel)      │     │ (Railway/Render)│     │   (Railway)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │  SQLite / Data  │
                        │   (Persistent)  │
                        └─────────────────┘
```

---

## Prerequisites

- GitHub account
- Node.js 18+ (local development)
- Python 3.9+ (local development)
- API Keys:
  - Claude API key (Anthropic)
  - Google Places API key
  - OpenAI API key (optional)

---

## Step 1: Prepare Your Repository

### 1.1 Fork/Clone the Repository

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/where2eat.git
cd where2eat
```

### 1.2 Set Up GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

| Secret Name | Description |
|-------------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for restaurant analysis |
| `GOOGLE_PLACES_API_KEY` | Google Places API for location data |
| `OPENAI_API_KEY` | OpenAI API key (optional) |
| `VERCEL_TOKEN` | Vercel deployment token |
| `RAILWAY_TOKEN` | Railway deployment token |

---

## Step 2: Set Up GitHub Actions CI/CD

### 2.1 Create CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run tests with coverage
        run: |
          python -m pytest tests/ --cov=src --cov-report=xml --cov-fail-under=90
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GOOGLE_PLACES_API_KEY: ${{ secrets.GOOGLE_PLACES_API_KEY }}

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage.xml

  test-frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./web
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

  test-api:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./api
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: api/package-lock.json

      - name: Install dependencies
        run: npm ci
```

### 2.2 Create Deployment Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    needs: [test-python, test-frontend, test-api]
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./web

  deploy-api:
    runs-on: ubuntu-latest
    needs: [test-python, test-frontend, test-api]
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: where2eat-api
```

---

## Step 3: Deploy Frontend (Vercel)

### 3.1 Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `where2eat` repository
4. Configure the project:

```
Framework Preset: Next.js
Root Directory: web
Build Command: npm run build
Output Directory: .next
Install Command: npm ci
```

### 3.2 Set Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-api.railway.app` |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | Your Google API key |

### 3.3 Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from web directory
cd web
vercel --prod
```

---

## Step 4: Deploy API (Railway)

### 4.1 Set Up Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Configure root directory: `api`

### 4.2 Configure Railway

Create `api/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

### 4.3 Set Environment Variables

In Railway dashboard → Variables:

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `GOOGLE_PLACES_API_KEY` | Your Google API key |

### 4.4 Add Persistent Storage

For the SQLite database and restaurant data:

1. In Railway, add a **Volume**
2. Mount path: `/app/data`
3. Update `api/index.js` to use `/app/data` in production

---

## Step 5: Deploy Python Backend (Railway)

### 5.1 Create Python Service

1. In Railway, click **"New Service"** → **"Empty Service"**
2. Connect to your GitHub repo
3. Set root directory: `/` (project root)

### 5.2 Add Procfile

Create `Procfile` in project root:

```
worker: python scripts/cli.py health
```

### 5.3 Add runtime.txt

Create `runtime.txt`:

```
python-3.11.0
```

### 5.4 Set Environment Variables

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `GOOGLE_PLACES_API_KEY` | Your Google API key |

---

## Step 6: Alternative Deployment (Render)

### 6.1 Deploy API to Render

1. Go to [render.com](https://render.com)
2. Create **"New Web Service"**
3. Connect GitHub repo

Create `api/render.yaml`:

```yaml
services:
  - type: web
    name: where2eat-api
    env: node
    rootDir: api
    buildCommand: npm ci
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: GOOGLE_PLACES_API_KEY
        sync: false
    healthCheckPath: /health
```

### 6.2 Deploy Frontend to Render

```yaml
services:
  - type: web
    name: where2eat-web
    env: static
    rootDir: web
    buildCommand: npm ci && npm run build
    staticPublishPath: .next
    envVars:
      - key: NEXT_PUBLIC_API_URL
        value: https://where2eat-api.onrender.com
```

---

## Step 7: Alternative Deployment (Fly.io)

### 7.1 Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Login
fly auth login
```

### 7.2 Deploy API

Create `api/fly.toml`:

```toml
app = "where2eat-api"
primary_region = "iad"

[build]
  [build.args]
    NODE_VERSION = "20"

[env]
  PORT = "3001"
  NODE_ENV = "production"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

Deploy:

```bash
cd api
fly launch
fly secrets set GOOGLE_PLACES_API_KEY=your_key
fly deploy
```

### 7.3 Deploy Frontend

Create `web/fly.toml`:

```toml
app = "where2eat-web"
primary_region = "iad"

[build]

[env]
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
```

Create `web/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Deploy:

```bash
cd web
fly launch
fly secrets set NEXT_PUBLIC_API_URL=https://where2eat-api.fly.dev
fly deploy
```

---

## Step 8: Domain Configuration

### 8.1 Custom Domain (Vercel)

1. Go to Vercel dashboard → Project → Settings → Domains
2. Add your domain (e.g., `where2eat.com`)
3. Configure DNS:
   - Add CNAME record: `www` → `cname.vercel-dns.com`
   - Add A record: `@` → `76.76.21.21`

### 8.2 Custom Domain (Railway)

1. Go to Railway → Service → Settings → Domains
2. Add custom domain
3. Configure DNS as instructed

---

## Step 9: Monitoring & Logging

### 9.1 Set Up Error Tracking (Sentry)

Install Sentry in frontend:

```bash
cd web
npm install @sentry/nextjs
```

### 9.2 Health Checks

The API has a built-in health endpoint:

```bash
curl https://your-api-url/health
# Response: {"status":"OK","timestamp":"2026-01-06T..."}
```

### 9.3 Logging

- **Vercel**: View logs in dashboard → Deployments → Logs
- **Railway**: View logs in dashboard → Deployments → Logs
- **Fly.io**: `fly logs -a where2eat-api`

---

## Environment Variables Summary

### Frontend (web/)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | No | Google Maps in frontend |

### API (api/)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Server port (default: 3001) |
| `NODE_ENV` | Yes | `production` or `development` |
| `GOOGLE_PLACES_API_KEY` | Yes | Google Places API |

### Python Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API for analysis |
| `OPENAI_API_KEY` | No | Alternative to Claude |
| `GOOGLE_PLACES_API_KEY` | Yes | Location enrichment |

---

## Troubleshooting

### Build Failures

```bash
# Check Node.js version
node --version  # Should be 18+

# Check Python version
python --version  # Should be 3.9+

# Clear caches
rm -rf node_modules .next
npm ci
npm run build
```

### API Connection Issues

1. Check CORS configuration in `api/index.js`
2. Verify `NEXT_PUBLIC_API_URL` is set correctly
3. Test API health: `curl $API_URL/health`

### Database Issues

1. Ensure data directory exists: `mkdir -p data/restaurants`
2. Check file permissions
3. For Railway/Render, use persistent volumes

---

## Quick Start Commands

```bash
# Local development
cd web && npm run dev &
cd api && npm run dev &

# Production build
cd web && npm run build
cd api && npm start

# Run tests
python -m pytest tests/ --cov=src
cd web && npm run lint
```

---

## Cost Estimates (Monthly)

| Platform | Free Tier | Paid |
|----------|-----------|------|
| Vercel | 100GB bandwidth | $20/mo |
| Railway | $5 credit | $5-20/mo |
| Render | 750 hours | $7/mo |
| Fly.io | 3 shared VMs | $5-15/mo |

---

## Next Steps

1. Set up monitoring with Sentry or LogRocket
2. Configure CDN for static assets
3. Set up database backups
4. Implement rate limiting
5. Add SSL certificates (automatic on most platforms)
