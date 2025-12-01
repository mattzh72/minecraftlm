"""
Tool registry for managing available tools
"""

from typing import Any

from app.agent.tools.base import BaseDeclarativeTool, BaseToolInvocation, ToolSchema


class ToolRegistry:
    """Registry for managing tools available to the agent"""

    def __init__(self, tools: list[BaseDeclarativeTool]):
        self.tools = {tool.name: tool for tool in tools}

    def get_tool(self, name: str) -> BaseDeclarativeTool | None:
        """Get tool by name"""
        return self.tools.get(name)

    def get_all_tool_names(self) -> list[str]:
        """Get list of all tool names"""
        return list(self.tools.keys())

    def get_tool_schemas(self) -> list[ToolSchema]:
        """Get all tool schemas in OpenAI format"""
        return [tool.schema for tool in self.tools.values()]

    async def build_invocation(
        self, name: str, params: dict[str, Any]
    ) -> BaseToolInvocation | None:
        """
        Build a tool invocation from name and parameters.

        Args:
            name: Tool name
            params: Raw parameters from LLM

        Returns:
            ToolInvocation ready to execute, or None if tool not found
        """
        tool = self.get_tool(name)
        if not tool:
            return None
        return await tool.build(params)
