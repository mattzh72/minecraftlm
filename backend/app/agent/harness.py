"""
Agent executor - main agentic loop
"""

import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import AsyncIterator, Literal

from app.services.llm import LLMService
from app.services.session import SessionService
from app.agent.tools.complete_task import CompleteTaskTool
from app.agent.tools.edit_code import EditCodeTool
from app.agent.tools.read_code import ReadCodeTool
from app.agent.tools.registry import ToolRegistry


ActivityEventType = Literal[
    "thought",
    "tool_call",
    "tool_result",
    "complete",
    "turn_start",
    "error",
]


class TerminateReason(str, Enum):
    """Reasons for agent termination"""

    GOAL = "GOAL"  # Successfully completed
    MAX_TURNS = "MAX_TURNS"  # Hit max turns limit
    ERROR = "ERROR"  # Unexpected error
    NO_COMPLETE_TASK = "NO_COMPLETE_TASK"  # Protocol violation


@dataclass
class AgentOutput:
    """Output from agent execution"""

    success: bool
    terminate_reason: TerminateReason
    message: str


@dataclass
class ActivityEvent:
    """Activity event for streaming to UI"""

    type: ActivityEventType
    data: dict


class MinecraftSchematicAgent:
    """Executes the main agentic loop"""

    def __init__(self, session_id: str, max_turns: int = 20):
        self.session_id = session_id
        self.max_turns = max_turns

        # Initialize services
        self.llm = LLMService()
        self.session_service = SessionService()

        # Initialize tools
        tools = [
            ReadCodeTool(),
            EditCodeTool(),
            CompleteTaskTool(),
        ]
        self.tool_registry = ToolRegistry(tools)

        # Load system prompt and inject SDK docs
        prompt_path = Path(__file__).parent / "prompts" / "system_prompt.txt"
        template = prompt_path.read_text()

        docs_dir = Path(__file__).parent / "minecraft_sdk" / "docs"
        replacements = {
            "[[SDK_OVERVIEW]]": (docs_dir / "01-overview.md").read_text(),
            "[[SDK_API_SCENE]]": (docs_dir / "02-api-scene.md").read_text(),
            "[[SDK_BLOCKS_REFERENCE]]": (
                docs_dir / "03-blocks-reference.md"
            ).read_text(),
            "[[SDK_BLOCK_LIST]]": (docs_dir / "04-block-list.md").read_text(),
        }
        for marker, text in replacements.items():
            template = template.replace(marker, text)

        self.system_prompt = template

        # Track whether code has been read (for edit safety)
        self.code_read_since_edit = True  # Start True for initial empty file

    async def run(self, user_message: str) -> AsyncIterator[ActivityEvent]:
        """
        Run the agent loop.

        Args:
            user_message: Initial user message

        Yields:
            ActivityEvent for streaming to UI
        """
        turn_count = 0

        # Load conversation history
        conversation = self.session_service.load_conversation(self.session_id)

        # Add user message
        conversation.append({"role": "user", "content": user_message})
        self.session_service.save_conversation(self.session_id, conversation)

        # Conversation is already in OpenAI format
        messages = list(conversation)

        # Main loop
        while True:
            if turn_count >= self.max_turns:
                yield ActivityEvent(
                    type="complete",
                    data={
                        "success": False,
                        "reason": TerminateReason.MAX_TURNS,
                        "message": "Agent hit max turns limit",
                    },
                )
                return

            turn_count += 1

            # Call model with tools
            yield ActivityEvent(type="turn_start", data={"turn": turn_count})

            response = await self.llm.generate_with_tools(
                self.system_prompt,
                messages,
                self.tool_registry.get_tool_schemas(),
            )

            # Build assistant message in OpenAI format
            assistant_message = {"role": "assistant", "content": response.text or ""}

            # Handle response text (thoughts/reasoning)
            if response.text:
                yield ActivityEvent(type="thought", data={"text": response.text})

            # Add tool calls to message
            if response.function_calls:
                tool_calls = []
                for idx, func_call in enumerate(response.function_calls):
                    tool_calls.append({
                        "id": getattr(func_call, "id", None) or f"call_{idx}",
                        "type": "function",
                        "function": {
                            "name": func_call.name,
                            "arguments": json.dumps(dict(func_call.args) if func_call.args else {}),
                        },
                    })
                assistant_message["tool_calls"] = tool_calls

            # Save assistant message
            conversation.append(assistant_message)
            self.session_service.save_conversation(self.session_id, conversation)
            messages.append(assistant_message)

            # No function calls - check if task was completed
            if not response.function_calls:
                # Protocol violation - agent should call complete_task
                yield ActivityEvent(
                    type="complete",
                    data={
                        "success": False,
                        "reason": TerminateReason.NO_COMPLETE_TASK,
                        "message": "Agent stopped without calling complete_task",
                    },
                )
                return

            # Process function calls
            task_completed = False
            serialized_responses = []

            for idx, func_call in enumerate(response.function_calls):
                yield ActivityEvent(
                    type="tool_call",
                    data={"name": func_call.name, "args": func_call.args},
                )

                # Check if edit_code requires prior read
                if func_call.name == "edit_code" and not self.code_read_since_edit:
                    tool_result = {
                        "error": "You must read the code first before editing. Use read_code to see the current file contents."
                    }
                else:
                    # Execute tool - inject session_id automatically
                    tool_params = dict(func_call.args) if func_call.args else {}
                    tool_params["session_id"] = self.session_id

                    invocation = await self.tool_registry.build_invocation(
                        func_call.name, tool_params
                    )

                    if not invocation:
                        tool_result = {"error": f"Tool {func_call.name} not found"}
                    else:
                        result = await invocation.execute()
                        tool_result = result.to_dict()

                        # Update read/edit tracking
                        if func_call.name == "read_code" and result.is_success():
                            self.code_read_since_edit = True
                        elif func_call.name == "edit_code" and result.is_success():
                            self.code_read_since_edit = False

                        # Check if this is complete_task
                        if func_call.name == "complete_task" and result.is_success():
                            task_completed = True

                yield ActivityEvent(type="tool_result", data=tool_result)

                # Build tool response in OpenAI format
                tool_response = {
                    "role": "tool",
                    "tool_call_id": getattr(func_call, "id", None) or f"call_{idx}",
                    "content": json.dumps(tool_result),
                    "name": func_call.name,
                }
                serialized_responses.append(tool_response)

            if serialized_responses:
                # Save tool responses
                conversation.extend(serialized_responses)
                self.session_service.save_conversation(self.session_id, conversation)
                messages.extend(serialized_responses)

            # If task completed successfully, stop
            if task_completed:
                yield ActivityEvent(
                    type="complete",
                    data={
                        "success": True,
                        "reason": TerminateReason.GOAL,
                        "message": "Task completed successfully",
                    },
                )
                return
