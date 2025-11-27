"""
Agent executor - main agentic loop
"""

import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import AsyncIterator

from google.genai.types import Content, FunctionResponse, Part

from app.services.gemini import GeminiService
from app.services.session import SessionService
from app.agent.tools.complete_task import CompleteTaskTool
from app.agent.tools.edit_code import EditCodeTool
from app.agent.tools.read_code import ReadCodeTool
from app.agent.tools.registry import ToolRegistry


class TerminateReason(str, Enum):
    """Reasons for agent termination"""

    GOAL = "GOAL"  # Successfully completed
    MAX_TURNS = "MAX_TURNS"  # Hit max turns limit
    TIMEOUT = "TIMEOUT"  # Hit time limit
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

    type: str  # "thought", "tool_call", "tool_result", "complete"
    data: dict


class AgentHarness:
    """Executes the main agentic loop"""

    def __init__(self, session_id: str, max_turns: int = 20, max_time_minutes: int = 5):
        self.session_id = session_id
        self.max_turns = max_turns
        self.max_time_minutes = max_time_minutes

        # Initialize services
        self.gemini = GeminiService()
        self.session_service = SessionService()

        # Initialize tools
        tools = [
            ReadCodeTool(),
            EditCodeTool(),
            CompleteTaskTool(),
        ]
        self.tool_registry = ToolRegistry(tools)

        # Load system prompt
        prompt_path = Path(__file__).parent / "prompts" / "system_prompt.txt"
        self.system_prompt = prompt_path.read_text()

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
        start_time = time.time()
        turn_count = 0

        # Load conversation history
        conversation = self.session_service.load_conversation(self.session_id)

        # Add user message
        conversation.append({"role": "user", "content": user_message})
        self.session_service.save_conversation(self.session_id, conversation)

        # Convert to Gemini format
        contents = self._format_conversation(conversation)

        # Main loop
        while True:
            # Check termination conditions
            elapsed_minutes = (time.time() - start_time) / 60
            if elapsed_minutes >= self.max_time_minutes:
                yield ActivityEvent(
                    type="complete",
                    data={
                        "success": False,
                        "reason": TerminateReason.TIMEOUT,
                        "message": "Agent timed out",
                    },
                )
                return

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

            response = self.gemini.generate_with_tools(
                self.system_prompt,
                contents,
                self.tool_registry.get_function_declarations(),
            )

            # Handle response text (thoughts/reasoning)
            if response.text:
                yield ActivityEvent(type="thought", data={"text": response.text})

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
            tool_response_parts = []
            task_completed = False

            for func_call in response.function_calls:
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
                    tool_params["session_id"] = self.session_id  # Inject session context

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

                # Add to response parts
                tool_response_parts.append(
                    Part(
                        function_response=FunctionResponse(
                            name=func_call.name,
                            response=tool_result,
                            id=func_call.id if hasattr(func_call, "id") else None,
                        )
                    )
                )

            # If task completed successfully, stop
            if task_completed:
                # Save assistant response to conversation
                assistant_text = response.text or "Task completed"
                conversation.append({"role": "model", "content": assistant_text})
                self.session_service.save_conversation(self.session_id, conversation)

                yield ActivityEvent(
                    type="complete",
                    data={
                        "success": True,
                        "reason": TerminateReason.GOAL,
                        "message": "Task completed successfully",
                    },
                )
                return

            # Add tool responses to conversation and continue
            contents.append(Content(role="user", parts=tool_response_parts))

    def _format_conversation(self, conversation: list[dict]) -> list[Content]:
        """Convert conversation to Gemini format"""
        formatted = []
        for message in conversation:
            formatted.append(
                Content(role=message["role"], parts=[Part(text=message["content"])])
            )
        return formatted
