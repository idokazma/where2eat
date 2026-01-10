#!/usr/bin/env python3
"""
Railway MCP Server for Where2Eat
Provides tools to interact with Railway deployments, services, and variables
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


class RailwayMCPServer:
    """MCP Server for Railway GraphQL API integration"""

    def __init__(self):
        self.server = Server("railway")
        self.api_token = os.getenv("RAILWAY_TOKEN")
        self.graphql_url = "https://backboard.railway.app/graphql/v2"

        if not self.api_token:
            logger.warning("RAILWAY_TOKEN not set - some operations will fail")

        # Register handlers
        self.setup_handlers()

    def setup_handlers(self):
        """Register all MCP handlers"""

        @self.server.list_tools()
        async def list_tools() -> list[Tool]:
            """List available Railway tools"""
            return [
                Tool(
                    name="railway_list_projects",
                    description="List all Railway projects",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="railway_get_project",
                    description="Get details about a specific Railway project",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "project_id": {
                                "type": "string",
                                "description": "Railway project ID"
                            }
                        },
                        "required": ["project_id"]
                    }
                ),
                Tool(
                    name="railway_list_services",
                    description="List services in a Railway project",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "project_id": {
                                "type": "string",
                                "description": "Railway project ID"
                            }
                        },
                        "required": ["project_id"]
                    }
                ),
                Tool(
                    name="railway_get_deployments",
                    description="Get recent deployments for a service",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "service_id": {
                                "type": "string",
                                "description": "Railway service ID"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Number of deployments to return (default: 10)",
                                "default": 10
                            }
                        },
                        "required": ["service_id"]
                    }
                ),
                Tool(
                    name="railway_get_deployment_logs",
                    description="Get logs for a specific deployment",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "deployment_id": {
                                "type": "string",
                                "description": "Railway deployment ID"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Number of log lines (default: 100)",
                                "default": 100
                            }
                        },
                        "required": ["deployment_id"]
                    }
                ),
                Tool(
                    name="railway_get_variables",
                    description="Get environment variables for a service",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "service_id": {
                                "type": "string",
                                "description": "Railway service ID"
                            },
                            "environment_id": {
                                "type": "string",
                                "description": "Environment ID (optional - defaults to production)"
                            }
                        },
                        "required": ["service_id"]
                    }
                ),
                Tool(
                    name="railway_set_variable",
                    description="Set an environment variable",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "service_id": {
                                "type": "string",
                                "description": "Railway service ID"
                            },
                            "environment_id": {
                                "type": "string",
                                "description": "Environment ID"
                            },
                            "name": {
                                "type": "string",
                                "description": "Variable name"
                            },
                            "value": {
                                "type": "string",
                                "description": "Variable value"
                            }
                        },
                        "required": ["service_id", "environment_id", "name", "value"]
                    }
                ),
                Tool(
                    name="railway_trigger_deployment",
                    description="Trigger a new deployment for a service",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "service_id": {
                                "type": "string",
                                "description": "Railway service ID"
                            },
                            "environment_id": {
                                "type": "string",
                                "description": "Environment ID"
                            }
                        },
                        "required": ["service_id", "environment_id"]
                    }
                )
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Any) -> Sequence[TextContent | ImageContent | EmbeddedResource]:
            """Handle tool calls"""
            try:
                if name == "railway_list_projects":
                    return await self.list_projects()
                elif name == "railway_get_project":
                    return await self.get_project(**arguments)
                elif name == "railway_list_services":
                    return await self.list_services(**arguments)
                elif name == "railway_get_deployments":
                    return await self.get_deployments(**arguments)
                elif name == "railway_get_deployment_logs":
                    return await self.get_deployment_logs(**arguments)
                elif name == "railway_get_variables":
                    return await self.get_variables(**arguments)
                elif name == "railway_set_variable":
                    return await self.set_variable(**arguments)
                elif name == "railway_trigger_deployment":
                    return await self.trigger_deployment(**arguments)
                else:
                    return [TextContent(type="text", text=f"Unknown tool: {name}")]
            except Exception as e:
                logger.error(f"Error in {name}: {str(e)}", exc_info=True)
                return [TextContent(type="text", text=f"Error: {str(e)}")]

    async def _graphql_request(self, query: str, variables: dict = None) -> dict:
        """Make GraphQL request to Railway API"""
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

        payload = {
            "query": query,
            "variables": variables or {}
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.graphql_url,
                headers=headers,
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

            if "errors" in data:
                raise Exception(f"GraphQL errors: {data['errors']}")

            return data.get("data", {})

    async def list_projects(self) -> Sequence[TextContent]:
        """List all Railway projects"""
        query = """
        query {
          projects {
            edges {
              node {
                id
                name
                description
                createdAt
                updatedAt
              }
            }
          }
        }
        """

        data = await self._graphql_request(query)
        projects = [edge["node"] for edge in data.get("projects", {}).get("edges", [])]

        result = {
            "count": len(projects),
            "projects": projects
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def get_project(self, project_id: str) -> Sequence[TextContent]:
        """Get project details"""
        query = """
        query($projectId: String!) {
          project(id: $projectId) {
            id
            name
            description
            createdAt
            updatedAt
            services {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
        """

        data = await self._graphql_request(query, {"projectId": project_id})
        project = data.get("project", {})

        return [TextContent(type="text", text=json.dumps(project, indent=2))]

    async def list_services(self, project_id: str) -> Sequence[TextContent]:
        """List services in a project"""
        query = """
        query($projectId: String!) {
          project(id: $projectId) {
            services {
              edges {
                node {
                  id
                  name
                  createdAt
                  updatedAt
                }
              }
            }
          }
        }
        """

        data = await self._graphql_request(query, {"projectId": project_id})
        services = [
            edge["node"]
            for edge in data.get("project", {}).get("services", {}).get("edges", [])
        ]

        result = {
            "project_id": project_id,
            "count": len(services),
            "services": services
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def get_deployments(self, service_id: str, limit: int = 10) -> Sequence[TextContent]:
        """Get recent deployments for a service"""
        query = """
        query($serviceId: String!) {
          service(id: $serviceId) {
            deployments(first: 10) {
              edges {
                node {
                  id
                  status
                  createdAt
                  updatedAt
                  staticUrl
                }
              }
            }
          }
        }
        """

        data = await self._graphql_request(query, {"serviceId": service_id})
        deployments = [
            edge["node"]
            for edge in data.get("service", {}).get("deployments", {}).get("edges", [])
        ][:limit]

        result = {
            "service_id": service_id,
            "count": len(deployments),
            "deployments": deployments
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def get_deployment_logs(self, deployment_id: str, limit: int = 100) -> Sequence[TextContent]:
        """Get logs for a deployment"""
        query = """
        query($deploymentId: String!) {
          deployment(id: $deploymentId) {
            id
            status
            logs(limit: 100) {
              timestamp
              message
              severity
            }
          }
        }
        """

        data = await self._graphql_request(query, {"deploymentId": deployment_id})
        deployment = data.get("deployment", {})
        logs = deployment.get("logs", [])[:limit]

        result = {
            "deployment_id": deployment_id,
            "status": deployment.get("status"),
            "log_count": len(logs),
            "logs": logs
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def get_variables(self, service_id: str, environment_id: str = None) -> Sequence[TextContent]:
        """Get environment variables for a service"""
        query = """
        query($serviceId: String!, $environmentId: String) {
          service(id: $serviceId) {
            variables(environmentId: $environmentId) {
              edges {
                node {
                  name
                  createdAt
                  updatedAt
                }
              }
            }
          }
        }
        """

        variables = {"serviceId": service_id}
        if environment_id:
            variables["environmentId"] = environment_id

        data = await self._graphql_request(query, variables)
        env_vars = [
            edge["node"]
            for edge in data.get("service", {}).get("variables", {}).get("edges", [])
        ]

        result = {
            "service_id": service_id,
            "environment_id": environment_id,
            "count": len(env_vars),
            "variables": env_vars
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def set_variable(
        self,
        service_id: str,
        environment_id: str,
        name: str,
        value: str
    ) -> Sequence[TextContent]:
        """Set an environment variable"""
        query = """
        mutation($input: VariableUpsertInput!) {
          variableUpsert(input: $input) {
            name
            createdAt
          }
        }
        """

        variables = {
            "input": {
                "serviceId": service_id,
                "environmentId": environment_id,
                "name": name,
                "value": value
            }
        }

        data = await self._graphql_request(query, variables)
        variable = data.get("variableUpsert", {})

        result = {
            "success": True,
            "name": variable.get("name"),
            "created": variable.get("createdAt")
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def trigger_deployment(self, service_id: str, environment_id: str) -> Sequence[TextContent]:
        """Trigger a new deployment"""
        query = """
        mutation($input: ServiceDeployInput!) {
          serviceDeploy(input: $input) {
            id
            status
            createdAt
          }
        }
        """

        variables = {
            "input": {
                "serviceId": service_id,
                "environmentId": environment_id
            }
        }

        data = await self._graphql_request(query, variables)
        deployment = data.get("serviceDeploy", {})

        result = {
            "triggered": True,
            "deployment_id": deployment.get("id"),
            "status": deployment.get("status"),
            "created": deployment.get("createdAt")
        }

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    async def run(self):
        """Run the MCP server"""
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            logger.info("Railway MCP Server started")
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )


async def main():
    """Entry point"""
    server = RailwayMCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())
