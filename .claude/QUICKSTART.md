# Claude Code Quick Start for Where2Eat

Get up and running with Claude Code enhancements in 5 minutes.

## Prerequisites

- Python 3.9+ installed
- Node.js 18+ installed
- Claude Code CLI installed
- Git access to where2eat repository

## Step 1: Install MCP Dependencies (2 min)

```bash
# Navigate to project root
cd /home/user/where2eat

# Install Python MCP dependencies
pip install -r .claude/mcp-servers/requirements.txt

# Verify installation
python -c "import mcp; print('MCP SDK installed successfully')"
```

## Step 2: Configure API Tokens (3 min)

Create or edit `.env` file in project root:

```bash
# Copy example if it doesn't exist
cp .env.example .env 2>/dev/null || touch .env

# Add these tokens (get them from the links below)
echo "GITHUB_TOKEN=ghp_your_token_here" >> .env
echo "VERCEL_TOKEN=your_vercel_token" >> .env
echo "RAILWAY_TOKEN=your_railway_token" >> .env
```

### Get Your API Tokens

**GitHub:** https://github.com/settings/tokens/new
- Scopes needed: `repo`, `workflow`, `read:org`

**Vercel:** https://vercel.com/account/tokens
- Click "Create Token"

**Railway:** https://railway.app/account/tokens
- Click "Create Token"

## Step 3: Test the Setup

Start Claude Code and try these commands:

```
# Test Frontend Designer Skill
"Create a new restaurant card component using our design system"

# Test GitHub MCP
"List my recent pull requests"

# Test SQLite MCP
"Show me restaurants in Tel Aviv"

# Test Vercel MCP
"List my Vercel deployments"

# Test Railway MCP
"Show Railway project status"
```

## What You Just Installed

✅ **Frontend Designer Skill** - Expert on Where2Eat's tech stack
✅ **GitHub MCP** - Manage PRs, issues, and files
✅ **Vercel MCP** - Deploy and manage frontend
✅ **Railway MCP** - Deploy and manage backend
✅ **SQLite MCP** - Query restaurant database

## Common First Tasks

### 1. Create a New Feature Component

```
"Using the frontend designer skill, create a new component for filtering restaurants by price range. It should:
- Use our existing design system
- Follow the shadcn/ui pattern
- Include mobile responsiveness
- Add proper TypeScript types"
```

### 2. Deploy to Vercel

```
"List my Vercel deployments for where2eat-web"
"Show build logs for the latest deployment"
"Set NEXT_PUBLIC_API_URL to https://api.where2eat.com"
```

### 3. Query the Database

```
"Show me the top 10 highest-rated restaurants"
"How many restaurants do we have by cuisine type?"
"List restaurants added in the last 7 days"
```

### 4. Create a Pull Request

```
"Create a pull request for my frontend improvements with a detailed summary of changes"
"Add reviewers to PR #123"
```

## Troubleshooting

### "MCP server not found"

**Problem:** Claude Code can't find the MCP server

**Fix:**
```bash
# Check .claude/mcp.json exists
ls -la .claude/mcp.json

# Restart Claude Code to reload config
```

### "Authentication failed"

**Problem:** API token is invalid or expired

**Fix:**
```bash
# Check tokens are set
printenv | grep -E '(GITHUB|VERCEL|RAILWAY)_TOKEN'

# Regenerate token from provider
# Update .env file
# Restart Claude Code
```

### "Module 'mcp' not found"

**Problem:** Python MCP SDK not installed

**Fix:**
```bash
pip install mcp httpx
```

## Next Steps

- **Read full docs:** `.claude/README.md`
- **Explore skills:** `.claude/skills/frontend-designer/SKILL.md`
- **View MCP servers:** `.claude/mcp-servers/`
- **Check main docs:** `CLAUDE.md`

## Tips for Best Results

1. **Be specific** - "Create a restaurant card" vs "Create UI"
2. **Reference the skill** - "Using the frontend designer skill..."
3. **Use project context** - "Following our design system..."
4. **Ask for tests** - "Include unit tests"
5. **Chain commands** - "Deploy to Vercel and send me the URL"

## Getting Help

- **Documentation:** `.claude/README.md`
- **Issues:** https://github.com/idokazma/where2eat/issues
- **Claude Code Docs:** https://code.claude.com/docs

---

**Setup time:** ~5 minutes
**Ready to code:** ✅
