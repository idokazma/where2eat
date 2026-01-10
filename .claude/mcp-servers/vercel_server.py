#!/usr/bin/env python3
"""
Vercel MCP Server for Where2Eat
Provides tools to interact with Vercel deployments, projects, and environment variables
"""

import os
import sys
import json
import logging
import asyncio
import httpx
from typing import Any, Sequence

# Configure logging to stderr (required for MCP)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent, ImageContent, EmbeddedResource
    import mcp.server.stdio
except ImportError:
    logger.error("MCP SDK not installed. Run: pip install mcp")
    sys.exit(1)


class VercelMCPServer:
    """MCP Server for Vercel API integration"""

    def __init__(self):
        self.server = Server("vercel")
        self.api_token = os.getenv("VERCEL_TOKEN")
        self.team_id = os.getenv("VERCEL_TEAM_ID")  # Optional
        self.base_url = "https://api.vercel.com"

        if not self.api_token:
            logger.warning("VERCEL_TOKEN not set - some operations will fail")

        # Register handlers
        self.setup_handlers()

    def setup_handlers(self):
        """Register all MCP handlers"""

        @self.server.list_tools()
        async def list_tools() -> list[Tool]:
            """List available Vercel tools"""
            return [
                Tool(
                    name="vercel_list_deployments",
                    description="List recent deployments for a project",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "project_name": {
                                "type": "string",
                                "description": "Vercel project name (e.g., 'where2eat-web')"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Number of deployments to return (default: 10)",
                                "default": 10
                            }
                        }
                    }
                ),
                Tool(
                    name="vercel_get_deployment",
                    description="Get details about a specific deployment",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "deployment_id": {
                                "type": "string",
                                "description": "Deployment ID or URL"
                            }
                        },
                        "required": ["deployment_id"]
                    }
                ),
                Tool(
                    name="vercel_list_projects",
                    description="List all Vercel projects",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "limit": {
                                "type": "integer",
                                "description": "Number of projects to return (default: 20)",
                                "default": 20
                            }
                        }
                    }
                ),
                Tool(
                    name="vercel_get_env_vars",
                    description="Get environment variables for a project",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "project_id": {
                                "type": "string",
                                "description": "Vercel project ID or name"
                            }
                        },
                        "required": ["project_id"]
                    }
                ),
                Tool(
                    name="vercel_create_env_var",
                    description="Create or update an environment variable",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "project_id": {
                                "type": "string",
                                "description": "Vercel project ID or name"
                            },
                            "key": {
                                "type": "string",
                                "description": "Environment variable key"
                            },
                            "value": {
                                "type": "string",
                                "description": "Environment variable value"
                            },
                            "target": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Target environments (production, preview, development)",
                                "default": ["production", "preview", "development"]
                            }
                        },
                        "required": ["project_id", "key", "value"]
                    }
                ),
                Tool(
                    name="vercel_trigger_deployment",
                    description="Trigger a new deployment via deploy hook",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "hook_url": {
                                "type": "string",
                                "description": "Vercel deploy hook URL"
                            }
                        },
                        "required": ["hook_url"]
                    }
                ),
                Tool(
                    name="vercel_get_build_logs",
                    description="Get build logs for a deployment",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "deployment_id": {
                                "type": "string",
                                "description": "Deployment ID"
                            }
                        },
                        "required": ["deployment_id"]
                    }
                )
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Any) -> Sequence[TextContent | ImageContent | EmbeddedResource]:
            """Handle tool calls"""
            try:
                if name == "vercel_list_deployments":
                    return await self.list_deployments(**arguments)
                elif name == "vercel_get_deployment":
                    return await self.get_deployment(**arguments)
                elif name == "vercel_list_projects":
                    return await self.list_projects(**arguments)
                elif name == "vercel_get_env_vars":
                    return await self.get_env_vars(**arguments)
                elif name == "vercel_create_env_var":
                    return await self.create_env_var(**arguments)
                elif name == "vercel_trigger_deployment":
                    return await self.trigger_deployment(**arguments)
                elif name == "vercel_get_build_logs":
                    return await self.get_build_logs(**arguments)
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
            except Exception as e:
                logger.error(f"Error in {name}: {str(e)}", exc_info=True)
                return [TextContent(type="text", text=f"Error: {str(e)}")]

    async def _make_request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make HTTP request to Vercel API"""
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

        url = f"{self.base_url}{endpoint}"

        if self.team_id and "teamId" not in kwargs.get("params", {}):
            kwargs.setdefault("params", {})["teamId"] = self.team_id

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                timeout=30.0,
                **kwargs
            )
            response.raise_for_status()
            return response.json()

    async def list_deployments(self, project_name: str = None, limit: int = 10) -> Sequence[TextContent]:
        """List recent deployments"""
        params = {"limit": limit}
        if project_name:
            params["projectId"] = project_name

        data = await self._make_request("GET", "/v6/deployments", params=params)

        deployments = data.get("deployments", [])
        result = {
            "count": len(deployments),
            "deployments": [
                {
                    "id": d.get("uid"),
                    "name": d.get("name"),
                    "url": d.get("url"),
                    "state": d.get("state"),
                    "created": d.get("created"),
                    "creator": d.get("creator", {}).get("username"),
                    "git_branch": d.get("meta", {}).get("githubCommitRef")
                }
                for d in deployments
            ]
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def get_deployment(self, deployment_id: str) -> Sequence[TextContent]:
        """Get deployment details"""
        data = await self._make_request("GET", f"/v13/deployments/{deployment_id}")

        result = {
            "id": data.get("uid"),
            "name": data.get("name"),
            "url": data.get("url"),
            "state": data.get("readyState"),
            "created": data.get("created"),
            "build_time": data.get("buildingAt"),
            "ready_time": data.get("ready"),
            "git_commit": data.get("meta", {}).get("githubCommitSha"),
            "git_branch": data.get("meta", {}).get("githubCommitRef"),
            "git_message": data.get("meta", {}).get("githubCommitMessage")
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def list_projects(self, limit: int = 20) -> Sequence[TextContent]:
        """List all projects"""
        data = await self._make_request("GET", "/v9/projects", params={"limit": limit})

        projects = data.get("projects", [])
        result = {
            "count": len(projects),
            "projects": [
                {
                    "id": p.get("id"),
                    "name": p.get("name"),
                    "framework": p.get("framework"),
                    "git_repo": p.get("link", {}).get("repo"),
                    "production_url": p.get("latestDeployments", [{}])[0].get("url") if p.get("latestDeployments") else None
                }
                for p in projects
            ]
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def get_env_vars(self, project_id: str) -> Sequence[TextContent]:
        """Get environment variables"""
        data = await self._make_request("GET", f"/v9/projects/{project_id}/env")

        env_vars = data.get("envs", [])
        result = {
            "count": len(env_vars),
            "variables": [
                {
                    "key": e.get("key"),
                    "target": e.get("target"),
                    "type": e.get("type"),
                    "id": e.get("id"),
                    "created": e.get("createdAt"),
                    "updated": e.get("updatedAt")
                    # Value is NOT included for security
                }
                for e in env_vars
            ]
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def create_env_var(
        self,
        project_id: str,
        key: str,
        value: str,
        target: list[str] = None
    ) -> Sequence[TextContent]:
        """Create or update environment variable"""
        if target is None:
            target = ["production", "preview", "development"]

        payload = {
            "key": key,
            "value": value,
            "target": target,
            "type": "encrypted"
        }

        data = await self._make_request(
            "POST",
            f"/v10/projects/{project_id}/env",
            json=payload
        )

        result = {
            "success": True,
            "key": key,
            "target": target,
            "created": data.get("created")
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def trigger_deployment(self, hook_url: str) -> Sequence[TextContent]:
        """Trigger deployment via webhook"""
        async with httpx.AsyncClient() as client:
            response = await client.post(hook_url, timeout=30.0)
            response.raise_for_status()
            data = response.json()

        result = {
            "triggered": True,
            "job": data.get("job", {}),
            "message": "Deployment triggered successfully"
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def get_build_logs(self, deployment_id: str) -> Sequence[TextContent]:
        """Get build logs for deployment"""
        data = await self._make_request("GET", f"/v2/deployments/{deployment_id}/events")

        events = data.get("events", [])
        logs = []

        for event in events:
            if event.get("type") in ["command", "stdout", "stderr"]:
                logs.append({
                    "timestamp": event.get("created"),
                    "type": event.get("type"),
                    "text": event.get("payload", {}).get("text", "")
                })

        result = {
            "deployment_id": deployment_id,
            "log_count": len(logs),
            "logs": logs[:100]  # Limit to last 100 log entries
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def run(self):
        """Run the MCP server"""
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            logger.info("Vercel MCP Server started")
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )


async def main():
    """Entry point"""
    server = VercelMCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())
