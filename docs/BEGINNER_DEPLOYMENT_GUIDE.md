# From Code to Live Website: A Complete Beginner's Guide

This guide will take you from having code on your computer to having a live website anyone can visit. No prior deployment experience needed.

---

## Table of Contents

1. [What Are We Building?](#1-what-are-we-building)
2. [Prerequisites](#2-prerequisites)
3. [Part 1: Understanding the Basics](#part-1-understanding-the-basics)
4. [Part 2: Setting Up Your GitHub Repository](#part-2-setting-up-your-github-repository)
5. [Part 3: Deploying the Frontend (Vercel)](#part-3-deploying-the-frontend-vercel)
6. [Part 4: Deploying the Backend API (Railway)](#part-4-deploying-the-backend-api-railway)
7. [Part 5: Connecting Frontend to Backend](#part-5-connecting-frontend-to-backend)
8. [Part 6: Setting Up Automatic Deployments (CI/CD)](#part-6-setting-up-automatic-deployments-cicd)
9. [Part 7: Adding a Custom Domain](#part-7-adding-a-custom-domain)
10. [Troubleshooting](#troubleshooting)
11. [Glossary](#glossary)

---

## 1. What Are We Building?

Where2Eat is a restaurant discovery app with three parts:

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR WEBAPP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │   FRONTEND   │    │   BACKEND    │    │   WORKERS    │     │
│   │              │    │     API      │    │              │     │
│   │  What users  │───▶│  Processes   │◀───│   Scrapes    │     │
│   │     see      │    │   requests   │    │   YouTube    │     │
│   │              │    │              │    │              │     │
│   │  (Next.js)   │    │  (Express)   │    │  (Python)    │     │
│   └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**By the end of this guide, you'll have:**
- A live website at `https://your-app.vercel.app`
- An API at `https://your-api.railway.app`
- Automatic updates when you push code
- (Optional) Your own domain like `https://where2eat.com`

---

## 2. Prerequisites

### Things You Need (Free)

| Item | What It Is | Where to Get It |
|------|------------|-----------------|
| GitHub account | Stores your code online | [github.com](https://github.com) |
| Vercel account | Hosts your frontend | [vercel.com](https://vercel.com) |
| Railway account | Hosts your backend | [railway.app](https://railway.app) |
| Git installed | Tracks code changes | [git-scm.com](https://git-scm.com) |
| Node.js installed | Runs JavaScript | [nodejs.org](https://nodejs.org) |

### API Keys You'll Need

| Key | What It's For | Where to Get It |
|-----|---------------|-----------------|
| Google Places API | Restaurant locations | [Google Cloud Console](https://console.cloud.google.com) |
| Anthropic API | AI analysis | [console.anthropic.com](https://console.anthropic.com) |

---

## Part 1: Understanding the Basics

### What is "Deployment"?

**Deployment** = Making your code accessible on the internet

```
YOUR COMPUTER                         THE INTERNET
┌─────────────┐                      ┌─────────────┐
│             │     "Deploy"         │             │
│  Your Code  │  ───────────────▶   │ Live Website│
│             │                      │             │
│ Only you    │                      │ Anyone can  │
│ can see it  │                      │ visit it    │
└─────────────┘                      └─────────────┘
```

### What is "Hosting"?

**Hosting** = Renting a computer that's always on and connected to the internet

- **Vercel** hosts our frontend (the website users see)
- **Railway** hosts our backend (the server that processes data)

### What is "CI/CD"?

**CI/CD** = Automatic testing and deployment

```
You push code to GitHub
         │
         ▼
┌─────────────────┐
│  CI: Tests run  │  ← "Is this code broken?"
│  automatically  │
└────────┬────────┘
         │ Tests pass ✓
         ▼
┌─────────────────┐
│  CD: Deploys    │  ← "Put this live!"
│  automatically  │
└─────────────────┘
```

**Without CI/CD:** You manually upload files every time you make changes
**With CI/CD:** Push code → Tests run → Deploys automatically

---

## Part 2: Setting Up Your GitHub Repository

### Step 2.1: Create a GitHub Account

1. Go to [github.com](https://github.com)
2. Click **"Sign up"**
3. Follow the prompts to create your account
4. Verify your email

### Step 2.2: Upload Your Code to GitHub

**If you don't have the code yet:**
```bash
# Open Terminal (Mac/Linux) or Command Prompt (Windows)

# Clone the repository
git clone https://github.com/idokazma/where2eat.git

# Enter the directory
cd where2eat
```

**If you have the code locally:**
```bash
# Create a new repository on GitHub first (github.com → New repository)
# Then connect your local code:

cd where2eat
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/where2eat.git
git push -u origin main
```

### Step 2.3: Verify Your Repository

1. Go to `github.com/YOUR_USERNAME/where2eat`
2. You should see all your files:

```
where2eat/
├── web/           ← Frontend code
├── api/           ← Backend code
├── src/           ← Python code
├── scripts/
├── data/
└── README.md
```

---

## Part 3: Deploying the Frontend (Vercel)

### What is Vercel?

Vercel is a platform that hosts websites. It's made by the same people who created Next.js (our frontend framework), so they work perfectly together.

**Free tier includes:**
- Unlimited websites
- 100GB bandwidth/month
- Automatic HTTPS (secure connection)
- Global CDN (fast loading worldwide)

### Step 3.1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub

```
┌─────────────────────────────────────────┐
│                                         │
│   Authorize Vercel?                     │
│                                         │
│   Vercel wants to access your           │
│   GitHub account to:                    │
│                                         │
│   ✓ Read your repositories             │
│   ✓ Deploy from your code              │
│                                         │
│   [Authorize vercel]                    │
│                                         │
└─────────────────────────────────────────┘
```

### Step 3.2: Import Your Project

1. On Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find `where2eat` in the list → Click **"Import"**

### Step 3.3: Configure the Project

This is important! We need to tell Vercel where our frontend code is:

```
┌─────────────────────────────────────────────────────────────┐
│  Configure Project                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Project Name                                               │
│  ┌─────────────────────────────────────────────┐           │
│  │ where2eat                                    │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
│  Framework Preset                                           │
│  ┌─────────────────────────────────────────────┐           │
│  │ Next.js                    (auto-detected)  │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
│  Root Directory        ⚠️ IMPORTANT - CLICK "Edit"         │
│  ┌─────────────────────────────────────────────┐           │
│  │ web                                    [Edit]│           │
│  └─────────────────────────────────────────────┘           │
│  Our frontend is in the "web" folder, not the root!        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 3.4: Add Environment Variables

Scroll down to **"Environment Variables"** and add:

| NAME | VALUE |
|------|-------|
| `NEXT_PUBLIC_API_URL` | (leave empty for now) |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | your-google-api-key |

### Step 3.5: Deploy

Click **"Deploy"** and wait 1-2 minutes.

```
Building...
├── Installing dependencies...
├── Building Next.js app...
├── Generating static pages...
└── Deploying to edge network...

✓ Deployed!
```

### Step 3.6: View Your Live Site

You'll get a URL like: `https://where2eat-abc123.vercel.app`

Click it! Your frontend is now live on the internet!

```
┌──────────────────────────────────────────┐
│  Congratulations!                         │
│                                          │
│  Your site is live at:                   │
│  https://where2eat-abc123.vercel.app     │
│                                          │
│  [Visit Site]  [Dashboard]               │
└──────────────────────────────────────────┘
```

> ⚠️ **Note:** The site might show errors because we haven't deployed the API yet. That's next!

---

## Part 4: Deploying the Backend API (Railway)

### What is Railway?

Railway is a platform that runs your backend servers. Think of it as a computer in the cloud that's always on.

**Free tier includes:**
- $5 credit per month
- Automatic deployments
- Free database options

### Step 4.1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click **"Login"**
3. Choose **"Login with GitHub"**
4. Authorize Railway

### Step 4.2: Create New Project

1. Click **"New Project"**
2. Choose **"Deploy from GitHub repo"**
3. Find and select `where2eat`

### Step 4.3: Configure the Service

Railway will create a service. Click on it, then:

1. Go to **"Settings"** tab
2. Find **"Root Directory"** and set it to: `api`

```
┌─────────────────────────────────────────────────────────────┐
│  Service Settings                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Root Directory                                             │
│  ┌─────────────────────────────────────────────┐           │
│  │ api                                          │           │
│  └─────────────────────────────────────────────┘           │
│  👆 This tells Railway our backend is in the api/ folder   │
│                                                             │
│  Start Command                                              │
│  ┌─────────────────────────────────────────────┐           │
│  │ npm start                                    │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 4.4: Add Environment Variables

1. Click **"Variables"** tab
2. Click **"+ New Variable"** for each:

| Variable | Value |
|----------|-------|
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `GOOGLE_PLACES_API_KEY` | your-google-api-key |
| `ALLOWED_ORIGINS` | `https://where2eat-abc123.vercel.app` |

Replace the Vercel URL with your actual URL from Step 3.6!

### Step 4.5: Generate a Public URL

1. Go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**

You'll get a URL like: `where2eat-api-production.up.railway.app`

### Step 4.6: Test Your API

Open a new browser tab and visit:
```
https://where2eat-api-production.up.railway.app/health
```

You should see:
```json
{"status":"OK","timestamp":"2026-01-09T12:00:00.000Z"}
```

If you see this, your API is working!

---

## Part 5: Connecting Frontend to Backend

Now we need to tell the frontend where to find the API.

### Step 5.1: Update Vercel Environment Variable

1. Go to Vercel dashboard → Your project → **"Settings"**
2. Click **"Environment Variables"**
3. Find `NEXT_PUBLIC_API_URL` and update it:

| NAME | VALUE |
|------|-------|
| `NEXT_PUBLIC_API_URL` | `https://where2eat-api-production.up.railway.app` |

(Use your Railway URL from Step 4.5)

### Step 5.2: Redeploy the Frontend

1. Go to **"Deployments"** tab
2. Find the latest deployment
3. Click **"..."** → **"Redeploy"**

Wait 1-2 minutes for it to finish.

### Step 5.3: Test Everything

1. Visit your Vercel URL
2. The frontend should now load data from the API
3. Try searching for restaurants!

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🎉 Congratulations! Your full app is now live!           │
│                                                             │
│   Frontend: https://where2eat-abc123.vercel.app            │
│   Backend:  https://where2eat-api-production.up.railway.app│
│                                                             │
│   Anyone in the world can now visit your website!          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 6: Setting Up Automatic Deployments (CI/CD)

Right now, your app updates when you deploy manually. Let's make it automatic!

### What Happens With CI/CD

```
You make changes to code
         │
         ▼
git push origin main
         │
         ▼
┌─────────────────────────────────────────┐
│           GitHub detects push           │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
┌─────────────┐       ┌─────────────┐
│   VERCEL    │       │   RAILWAY   │
│ Auto-deploy │       │ Auto-deploy │
│  frontend   │       │   backend   │
└─────────────┘       └─────────────┘
    │                         │
    └──────────┬──────────────┘
               ▼
    ┌─────────────────────┐
    │  Both updated in    │
    │  about 2 minutes!   │
    └─────────────────────┘
```

### Step 6.1: Verify Auto-Deploy is Enabled

**Vercel (should be automatic):**
1. Go to Project Settings → Git
2. Ensure **"Auto-deploy"** is enabled for `main` branch

**Railway (should be automatic):**
1. Go to Service → Settings → Source
2. Ensure it's connected to your GitHub repo

### Step 6.2: Add GitHub Actions for Testing

GitHub Actions runs tests before deploying. This prevents broken code from going live.

The workflow files are already in your repo at `.github/workflows/`:

| File | Purpose |
|------|---------|
| `ci.yml` | Runs tests on every push/PR |
| `deploy.yml` | Deploys after tests pass |
| `scraper.yml` | Runs Python scraper daily |

### Step 6.3: Add Secrets to GitHub

For the workflows to deploy, they need access tokens:

1. Go to GitHub → Your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"** for each:

| Secret Name | How to Get It |
|-------------|---------------|
| `VERCEL_TOKEN` | vercel.com → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Run `npx vercel link` in web/ folder, check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Same as above |
| `RAILWAY_TOKEN` | railway.app → Account → Tokens → Create |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `GOOGLE_PLACES_API_KEY` | Your Google API key |

### Step 6.4: Test the CI/CD Pipeline

1. Make a small change to any file (like adding a comment)
2. Commit and push:

```bash
git add .
git commit -m "Test CI/CD pipeline"
git push origin main
```

3. Go to GitHub → Actions tab → Watch the workflow run

```
┌─────────────────────────────────────────────────────────────┐
│  Actions                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CI                                                         │
│  ├── ✓ test-python     (passed in 45s)                     │
│  ├── ✓ test-frontend   (passed in 30s)                     │
│  └── ✓ test-api        (passed in 15s)                     │
│                                                             │
│  Deploy                                                     │
│  ├── ✓ deploy-frontend (completed)                         │
│  └── ✓ deploy-api      (completed)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 7: Adding a Custom Domain

Want `where2eat.com` instead of `where2eat-abc123.vercel.app`?

### Step 7.1: Buy a Domain

Go to a domain registrar:
- [Namecheap](https://namecheap.com) (~$10/year)
- [Cloudflare](https://cloudflare.com) (~$9/year)
- [Google Domains](https://domains.google) (~$12/year)

Search for your desired domain and purchase it.

### Step 7.2: Configure DNS Records

DNS (Domain Name System) is like a phone book for the internet. It tells browsers which server to connect to when someone types your domain.

You need to add these records at your registrar:

**For the main site (Vercel):**

| Type | Name | Value | What it does |
|------|------|-------|--------------|
| A | `@` | `76.76.21.21` | Points `where2eat.com` to Vercel |
| CNAME | `www` | `cname.vercel-dns.com` | Points `www.where2eat.com` to Vercel |

**For the API (Railway):**

| Type | Name | Value | What it does |
|------|------|-------|--------------|
| CNAME | `api` | `your-app.up.railway.app` | Points `api.where2eat.com` to Railway |

### Step 7.3: Add Domain to Vercel

1. Vercel dashboard → Project → **Settings** → **Domains**
2. Enter `where2eat.com` → Click **Add**
3. Vercel will verify the DNS (takes 5-30 minutes)

### Step 7.4: Add Domain to Railway

1. Railway dashboard → Service → **Settings** → **Networking**
2. Click **Custom Domain**
3. Enter `api.where2eat.com`
4. Railway will show you the CNAME value to use

### Step 7.5: Update Environment Variables

1. Update Vercel's `NEXT_PUBLIC_API_URL` to `https://api.where2eat.com`
2. Update Railway's `ALLOWED_ORIGINS` to `https://where2eat.com,https://www.where2eat.com`
3. Redeploy both

### Step 7.6: Wait for Propagation

DNS changes take time to spread across the internet:
- Usually: 5-30 minutes
- Sometimes: Up to 48 hours

You can check progress at [dnschecker.org](https://dnschecker.org)

---

## Troubleshooting

### "My site shows an error"

**Check the logs:**
- Vercel: Dashboard → Deployments → Click deployment → Logs
- Railway: Dashboard → Service → Logs

### "API returns 'Failed to fetch'"

1. Check if API is running: Visit `your-api-url/health`
2. Check CORS: Make sure `ALLOWED_ORIGINS` includes your frontend URL
3. Check the browser console (F12) for specific errors

### "Changes aren't appearing"

1. Hard refresh your browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Check if deployment finished: Look at Vercel/Railway dashboards
3. Clear your browser cache

### "Build failed"

Check the build logs for the specific error. Common causes:
- Missing environment variables
- Syntax errors in code
- Missing dependencies (run `npm install`)

### "I get a 500 error"

This usually means a server-side error:
1. Check Railway logs for error messages
2. Make sure all environment variables are set
3. Check if the database/data files exist

---

## Glossary

| Term | Definition |
|------|------------|
| **API** | Application Programming Interface - how the frontend talks to the backend |
| **Backend** | The server-side code that processes data |
| **CI/CD** | Continuous Integration/Deployment - automatic testing and deploying |
| **CORS** | Cross-Origin Resource Sharing - security feature for APIs |
| **Deploy** | Making code available on the internet |
| **DNS** | Domain Name System - translates domain names to IP addresses |
| **Environment Variable** | A setting stored outside your code (like API keys) |
| **Frontend** | The code that runs in users' browsers |
| **Git** | Version control system for tracking code changes |
| **GitHub** | Website for hosting Git repositories |
| **Hosting** | Renting a server to run your website |
| **HTTPS** | Secure version of HTTP (the lock icon in browsers) |
| **Repository (Repo)** | A folder containing your project and its Git history |
| **SSL** | The technology that enables HTTPS |

---

## Summary Checklist

| Step | Description | Done? |
|------|-------------|-------|
| 1 | Create GitHub account | ⬜ |
| 2 | Push code to GitHub | ⬜ |
| 3 | Create Vercel account | ⬜ |
| 4 | Deploy frontend to Vercel | ⬜ |
| 5 | Create Railway account | ⬜ |
| 6 | Deploy API to Railway | ⬜ |
| 7 | Connect frontend to API | ⬜ |
| 8 | Add GitHub secrets | ⬜ |
| 9 | Test CI/CD pipeline | ⬜ |
| 10 | (Optional) Add custom domain | ⬜ |

---

## What's Next?

Now that your app is live, you might want to:

1. **Monitor your app** - Set up error tracking with [Sentry](https://sentry.io)
2. **Analyze traffic** - Add [Google Analytics](https://analytics.google.com) or [Plausible](https://plausible.io)
3. **Improve performance** - Use Vercel's analytics to find slow pages
4. **Scale up** - Upgrade to paid plans when you get more traffic

---

## Need Help?

- **Vercel Documentation:** [vercel.com/docs](https://vercel.com/docs)
- **Railway Documentation:** [docs.railway.app](https://docs.railway.app)
- **GitHub Actions:** [docs.github.com/actions](https://docs.github.com/en/actions)
- **Next.js:** [nextjs.org/docs](https://nextjs.org/docs)

---

**Congratulations! You've deployed your first full-stack web application!** 🎉
