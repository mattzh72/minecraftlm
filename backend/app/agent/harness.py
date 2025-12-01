"""
Agent executor - main agentic loop
"""

import base64
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import AsyncIterator

from google.genai.types import Content, FunctionCall, FunctionResponse, Part

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


class MinecraftSchematicAgent:
    """Executes the main agentic loop"""

    def __init__(self, session_id: str, max_turns: int = 20):
        self.session_id = session_id
        self.max_turns = max_turns

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

        # Load system prompt and inject SDK docs
        prompt_path = Path(__file__).parent / "prompts" / "system_prompt.txt"
        template = prompt_path.read_text()

        docs_dir = Path(__file__).parent / "minecraft_sdk" / "docs"
        replacements = {
            "[[SDK_OVERVIEW]]": (docs_dir / "01-overview.md").read_text(),
            "[[SDK_API_SCENE]]": (docs_dir / "02-api-scene.md").read_text(),
            "[[SDK_BLOCKS_REFERENCE]]": (docs_dir / "03-blocks-reference.md").read_text(),
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

        # Add user message with structured parts so it can be replayed
        conversation.append({"role": "user", "parts": [{"text": user_message}]})
        self.session_service.save_conversation(self.session_id, conversation)

        # Convert to Gemini format
        contents = self._format_conversation(conversation)

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

            response = self.gemini.generate_with_tools(
                self.system_prompt,
                contents,
                self.tool_registry.get_function_declarations(),
            )

            model_message_parts = []

            # Handle response text (thoughts/reasoning)
            if response.text:
                model_message_parts.append({"text": response.text})
                yield ActivityEvent(type="thought", data={"text": response.text})

            # Capture function calls for persistence + next turn replay
            if response.function_calls:
                for i, func_call in enumerate(response.function_calls):
                    part_data = {
                        "function_call": {
                            "name": func_call.name,
                            "args": dict(func_call.args) if func_call.args else {},
                            "id": getattr(func_call, "id", None),
                        }
                    }
                    # Add thought signature if present (needed for Gemini 3)
                    if response.thought_signatures and i < len(response.thought_signatures):
                        encoded_sig = self._encode_thought_signature(response.thought_signatures[i])
                        if encoded_sig:
                            part_data["thought_signature"] = encoded_sig
                
                    model_message_parts.append(part_data)

            if model_message_parts:
                conversation.append({"role": "model", "parts": model_message_parts})
                self.session_service.save_conversation(self.session_id, conversation)
                contents = self._format_conversation(conversation)

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

                serialized_responses.append(
                    {
                        "function_response": {
                            "name": func_call.name,
                            "response": tool_result,
                            "id": getattr(func_call, "id", None),
                        }
                    }
                )

            if serialized_responses:
                conversation.append({"role": "user", "parts": serialized_responses})
                self.session_service.save_conversation(self.session_id, conversation)
                contents = self._format_conversation(conversation)

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

    def _format_conversation(self, conversation: list[dict]) -> list[Content]:
        """Convert conversation to Gemini format"""
        formatted = []
        for message in conversation:
            parts: list[Part] = []
            if "parts" in message:
                for part in message["parts"]:
                    if "text" in part:
                        parts.append(Part(text=part["text"]))
                    elif "function_call" in part:
                        call = part["function_call"]
                        # Include thought_signature if present
                        thought_sig = self._decode_thought_signature(part.get("thought_signature"))
                        parts.append(
                            Part(
                                function_call=FunctionCall(
                                    name=call.get("name"),
                                    args=call.get("args") or {},
                                    id=call.get("id"),
                                ),
                                thought_signature=thought_sig
                            )
                        )
                    elif "function_response" in part:
                        response = part["function_response"]
                        parts.append(
                            Part(
                                function_response=FunctionResponse(
                                    name=response.get("name"),
                                    response=response.get("response"),
                                    id=response.get("id"),
                                )
                            )
                        )
            elif "content" in message:
                parts.append(Part(text=message["content"]))

            if parts:
                formatted.append(Content(role=message["role"], parts=parts))
        return formatted

    @staticmethod
    def _encode_thought_signature(sig) -> str | None:
        """Store thought signatures as base64 strings for JSON compatibility"""
        if sig is None:
            return None
        try:
            raw: bytes
            if isinstance(sig, bytes):
                raw = sig
            else:
                raw = str(sig).encode("utf-8")
            return base64.b64encode(raw).decode("ascii")
        except Exception:
            return None

    @staticmethod
    def _decode_thought_signature(encoded: str | None):
        """Decode base64 thought signatures back to bytes for Gemini"""
        if not encoded:
            return None
        try:
            return base64.b64decode(encoded)
        except Exception:
            return None
