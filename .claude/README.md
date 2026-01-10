# Claude Code Configuration for Where2Eat

This directory contains Claude Code configuration including skills and MCP (Model Context Protocol) server integrations.

## Overview

The Where2Eat project is enhanced with Claude Code through:

1. **Custom Skills** - Domain-specific expertise for frontend design
2. **MCP Servers** - External tool integrations (GitHub, Vercel, Railway, SQLite)
3. **Plugins** - Bundled capabilities for the development workflow

## Directory Structure

```
.claude/
├── README.md                          # This file
├── mcp.json                           # MCP server configuration
├── skills/                            # Custom Claude skills
│   └── frontend-designer/
│       └── SKILL.md                   # Frontend design expertise
├── mcp-servers/                       # Custom MCP server implementations
│   ├── vercel_server.py               # Vercel API integration
│   └── railway_server.py              # Railway API integration
└── plugins/                           # Plugin packages
    └── where2eat-devops/              # DevOps tooling bundle
```

## Quick Start

### 1. Install Dependencies

**For Node.js MCP servers:**
```bash
# GitHub and SQLite servers are installed automatically via npx
# No manual installation needed
```

**For Python MCP servers (Vercel & Railway):**
```bash
# Install MCP Python SDK
pip install mcp httpx

# Or add to your project requirements
echo "mcp>=0.9.0" >> requirements.txt
echo "httpx>=0.24.0" >> requirements.txt
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create or update your `.env` file with API tokens:

```bash
# GitHub MCP Server
GITHUB_TOKEN=ghp_your_github_personal_access_token

# Vercel MCP Server
VERCEL_TOKEN=your_vercel_api_token
VERCEL_TEAM_ID=team_xxxxxxxxxxxx  # Optional, for team accounts

# Railway MCP Server
RAILWAY_TOKEN=your_railway_api_token
```

**How to get API tokens:**

**GitHub Token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`, `read:org`
4. Copy token to `GITHUB_TOKEN`

**Vercel Token:**
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Copy token to `VERCEL_TOKEN`
4. Find Team ID at https://vercel.com/teams/[your-team]/settings

**Railway Token:**
1. Go to https://railway.app/account/tokens
2. Click "Create Token"
3. Copy token to `RAILWAY_TOKEN`

### 3. Verify MCP Server Configuration

The MCP servers are configured in `.claude/mcp.json`. Claude Code will automatically load them when you start a session.

**Test that MCP servers are working:**

```bash
# In Claude Code, try these commands:

# GitHub
"List my recent pull requests"
"Show open issues in this repository"

# Vercel
"Show my recent Vercel deployments"
"List all Vercel projects"

# Railway
"Show Railway project status"
"Get deployment logs from Railway"

# SQLite
"Query the restaurants database"
"Show me restaurants in Tel Aviv"
```

## Available Tools

### Frontend Designer Skill

**Location:** `.claude/skills/frontend-designer/SKILL.md`

**Capabilities:**
- Expert knowledge of Where2Eat's tech stack (Next.js 16, React 19, Tailwind v4)
- Understanding of design system (colors, typography, spacing)
- Component architecture patterns
- Performance optimization (image loading, lazy loading)
- Accessibility best practices
- Responsive design patterns

**When it activates:**
- Creating new UI components
- Refactoring existing components
- Implementing responsive layouts
- Adding animations or micro-interactions
- Making design decisions

**Example usage:**
```
"Create a new restaurant filter component using our design system"
"Optimize the image loading performance in the masonry grid"
"Make the navigation menu responsive for mobile"
```

### GitHub MCP Server

**Tools available:**
- `github_create_pull_request` - Create PRs
- `github_list_pull_requests` - List PRs
- `github_get_pull_request` - Get PR details
- `github_list_issues` - List issues
- `github_create_issue` - Create issues
- `github_search_repositories` - Search repos
- `github_get_file_contents` - Read files from GitHub

**Example usage:**
```
"Create a pull request for my changes"
"Show me all open issues labeled 'bug'"
"Get the contents of package.json from main branch"
```

### Vercel MCP Server

**Tools available:**
- `vercel_list_deployments` - List recent deployments
- `vercel_get_deployment` - Get deployment details
- `vercel_list_projects` - List all projects
- `vercel_get_env_vars` - Get environment variables
- `vercel_create_env_var` - Create/update env vars
- `vercel_trigger_deployment` - Trigger new deployment
- `vercel_get_build_logs` - Get build logs

**Example usage:**
```
"Show my last 5 Vercel deployments"
"Get build logs for the latest deployment"
"Add NEXT_PUBLIC_API_URL environment variable"
"Trigger a new deployment"
```

### Railway MCP Server

**Tools available:**
- `railway_list_projects` - List all projects
- `railway_get_project` - Get project details
- `railway_list_services` - List services in project
- `railway_get_deployments` - Get recent deployments
- `railway_get_deployment_logs` - Get deployment logs
- `railway_get_variables` - Get environment variables
- `railway_set_variable` - Set environment variable
- `railway_trigger_deployment` - Trigger deployment

**Example usage:**
```
"Show my Railway projects"
"Get deployment logs for the API service"
"Set DATABASE_URL environment variable"
"Trigger a new Railway deployment"
```

### SQLite MCP Server

**Tools available:**
- `sqlite_query` - Execute SQL queries
- `sqlite_list_tables` - List all tables
- `sqlite_describe_table` - Show table schema
- `sqlite_read_query` - Read-only queries

**Example usage:**
```
"Show all restaurants in Tel Aviv with rating > 4.0"
"List all tables in the database"
"Show the schema for the restaurants table"
"Count total restaurants by cuisine type"
```

## Custom MCP Server Implementation

### Vercel Server

The Vercel MCP server (`vercel_server.py`) uses the Vercel REST API to manage deployments.

**Features:**
- List and filter deployments
- Get deployment details and logs
- Manage environment variables
- Trigger new deployments

**Architecture:**
```
Claude Code → MCP Protocol → vercel_server.py → Vercel REST API
```

### Railway Server

The Railway MCP server (`railway_server.py`) uses the Railway GraphQL API.

**Features:**
- Manage projects and services
- Get deployment status and logs
- Configure environment variables
- Trigger deployments

**Architecture:**
```
Claude Code → MCP Protocol → railway_server.py → Railway GraphQL API
```

## Troubleshooting

### MCP Server Not Loading

**Problem:** Claude Code doesn't recognize MCP server tools

**Solutions:**
1. Check that `.claude/mcp.json` is valid JSON:
   ```bash
   python -m json.tool .claude/mcp.json
   ```

2. Verify environment variables are set:
   ```bash
   printenv | grep -E '(GITHUB|VERCEL|RAILWAY)_TOKEN'
   ```

3. Check MCP server logs (shown in Claude Code console)

4. Restart Claude Code to reload configuration

### Python MCP Server Errors

**Problem:** `ImportError: No module named 'mcp'`

**Solution:**
```bash
pip install mcp httpx
```

**Problem:** Authentication errors (401 Unauthorized)

**Solution:**
- Verify API tokens are correct and not expired
- Check token has required permissions
- Regenerate tokens if needed

### GitHub MCP Server Issues

**Problem:** "Resource not accessible by personal access token"

**Solution:**
- Update token scopes: `repo`, `workflow`, `read:org`
- For private repos, ensure `repo` scope is enabled

### Performance Issues

**Problem:** Slow MCP server responses

**Solutions:**
1. Reduce query limits (fewer results)
2. Use specific filters instead of broad queries
3. Cache frequently accessed data locally
4. Consider using webhooks for real-time updates

## Advanced Configuration

### Custom Skill Development

Create new skills in `.claude/skills/[skill-name]/SKILL.md`:

```markdown
---
name: My Custom Skill
description: Brief description of when to use this skill
---

# My Custom Skill

Detailed instructions, examples, and context for Claude...
```

### Plugin Packaging

Bundle skills and MCP servers into a plugin:

```
.claude/plugins/my-plugin/
├── PLUGIN.md              # Plugin metadata
├── skills/                # Bundled skills
│   └── skill-name/
│       └── SKILL.md
└── mcp-servers/           # Bundled MCP servers
    └── server.py
```

### Environment-Specific Configuration

Use multiple MCP configuration files:

```bash
# Development
.claude/mcp.dev.json

# Production
.claude/mcp.prod.json

# Switch configurations
ln -sf mcp.dev.json mcp.json
```

## Best Practices

### Security

- **Never commit API tokens** - Use environment variables
- **Rotate tokens regularly** - Update every 90 days
- **Use least privilege** - Grant minimum required permissions
- **Audit token usage** - Check GitHub/Vercel/Railway logs

### Performance

- **Limit query results** - Use `limit` parameters
- **Filter early** - Use specific queries instead of broad searches
- **Cache when possible** - Store frequently accessed data
- **Batch operations** - Combine multiple queries when possible

### Skill Design

- **Be specific** - Clear, focused skill descriptions
- **Provide examples** - Show expected input/output
- **Include context** - Reference project-specific patterns
- **Keep updated** - Sync skills with codebase changes

## Resources

### Documentation

- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Claude Code Skills Guide](https://code.claude.com/docs/skills)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [Vercel API Reference](https://vercel.com/docs/rest-api)
- [Railway API Reference](https://docs.railway.app/reference/public-api)

### Community

- [MCP Server Registry](https://mcp.so)
- [Claude Code Discussions](https://github.com/anthropics/claude-code/discussions)
- [Awesome Claude Code](https://github.com/jmanhype/awesome-claude-code)

### Project-Specific

- Main docs: `/home/user/where2eat/CLAUDE.md`
- Frontend docs: `/home/user/where2eat/web/README.md`
- API docs: `/home/user/where2eat/api/README.md`

## Support

For issues or questions:

1. Check this README and project docs
2. Review MCP server logs in Claude Code console
3. Test API tokens with curl/httpie
4. Open issue at https://github.com/idokazma/where2eat/issues

---

**Last updated:** 2026-01-10
**Claude Code version:** Compatible with Claude Code CLI v0.9+
**MCP Protocol version:** v1.0
