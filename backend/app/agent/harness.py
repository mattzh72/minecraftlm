"""
Agent executor - main agentic loop
"""

import json
import re
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import AsyncIterator, Literal
import logging

from app.services.llm import LLMService
from app.agent.block_parser import BlockStreamParser
from app.services.session import SessionService
from app.agent.tools.complete_task import CompleteTaskTool
from app.agent.tools.edit_code import EditCodeTool
from app.agent.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

ActivityEventType = Literal[
    "thought",
    "text_delta",
    "tool_call",
    "tool_result",
    "complete",
    "turn_start",
    "error",
    "block_preview",  # Streamed block preview from code parsing
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
            EditCodeTool(),
            CompleteTaskTool(),
        ]
        self.tool_registry = ToolRegistry(tools)

        # Load system prompt template and SDK docs (code will be injected per-call)
        prompt_path = Path(__file__).parent / "prompts" / "system_prompt.txt"
        self.prompt_template = prompt_path.read_text()

        docs_dir = Path(__file__).parent / "minecraft" / "docs"
        self.sdk_replacements = {
            "[[SDK_OVERVIEW]]": f"01-overview.md\n\n{(docs_dir / '01-overview.md').read_text()}",
            "[[SDK_API_SCENE]]": f"02-api-scene.md\n\n{(docs_dir / '02-api-scene.md').read_text()}",
            "[[SDK_BLOCKS_REFERENCE]]": f"03-blocks-reference.md\n\n{(docs_dir / '03-blocks-reference.md').read_text()}",
            "[[SDK_BLOCK_LIST]]": f"04-block-list.md\n\n{(docs_dir / '04-block-list.md').read_text()}",
            "[[SDK_PITFALLS]]": f"05-pitfalls.md\n\n{(docs_dir / '05-pitfalls.md').read_text()}",
        }

        # Block stream parser for real-time preview
        self.block_parser = BlockStreamParser()

    def _format_code_with_line_numbers(self, code: str) -> str:
        """Format code with line numbers (cat -n style)."""
        if not code or not code.strip():
            return "(empty file)"
        lines = code.split("\n")
        return "\n".join(f"{i + 1:6d}\t{line}" for i, line in enumerate(lines))

    def _build_system_prompt(self) -> str:
        """Build system prompt with current code embedded."""
        template = self.prompt_template

        # Inject SDK docs
        for marker, text in self.sdk_replacements.items():
            template = template.replace(marker, text)

        # Inject current code with line numbers
        code = self.session_service.load_code(self.session_id)
        formatted_code = self._format_code_with_line_numbers(code)
        template = template.replace("[[CURRENT_CODE]]", formatted_code)

        return template

    async def run(self, user_message: str) -> AsyncIterator[ActivityEvent]:
        """
        Run the agent loop.

        Args:
            user_message: Initial user message

        Yields:
            ActivityEvent for streaming to UI
        """
        turn_count = 0

        # Reset block parser for fresh preview state
        self.block_parser.reset()

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

            yield ActivityEvent(type="turn_start", data={"turn": turn_count})

            # Accumulators for streaming response
            accumulated_text = ""
            accumulated_tool_calls = {}  # index -> tool call dict

            # Stream response chunks (rebuild system prompt to include latest code)
            async for chunk in self.llm.generate_with_tools_streaming(
                self._build_system_prompt(),
                messages,
                self.tool_registry.get_tool_schemas(),
            ):
                # Handle text delta
                if chunk.text_delta:
                    accumulated_text += chunk.text_delta
                    yield ActivityEvent(
                        type="text_delta", data={"delta": chunk.text_delta}
                    )

                # Handle tool calls delta
                if chunk.tool_calls_delta:
                    for tc_delta in chunk.tool_calls_delta:
                        idx = tc_delta.get("index", 0)
                        if idx not in accumulated_tool_calls:
                            accumulated_tool_calls[idx] = {
                                "id": tc_delta.get("id", ""),
                                "type": tc_delta.get("type", "function"),
                                "function": {"name": "", "arguments": ""},
                            }

                        # Accumulate function name
                        if tc_delta.get("function", {}).get("name"):
                            accumulated_tool_calls[idx]["function"]["name"] = tc_delta[
                                "function"
                            ]["name"]

                        # Accumulate function arguments
                        if tc_delta.get("function", {}).get("arguments"):
                            accumulated_tool_calls[idx]["function"]["arguments"] += (
                                tc_delta["function"]["arguments"]
                            )

                        # Update ID if provided
                        if tc_delta.get("id"):
                            accumulated_tool_calls[idx]["id"] = tc_delta["id"]

                        # Parse blocks from edit_code's new_string for preview
                        func_name = accumulated_tool_calls[idx]["function"].get("name", "")
                        args_so_far = accumulated_tool_calls[idx]["function"].get("arguments", "")

                        # Stream block previews from edit_code's new_string
                        if func_name == "edit_code":
                            try:
                                # Find where new_string value starts (works with incomplete JSON)
                                start_match = re.search(
                                    r'"new_string"\s*:\s*"',
                                    args_so_far,
                                )

                                if start_match:
                                    # Extract everything after the opening quote
                                    content_start = start_match.end()
                                    remaining = args_so_far[content_start:]

                                    # Find the closing quote (handling escapes)
                                    code_content = ""
                                    i = 0
                                    while i < len(remaining):
                                        if remaining[i] == '\\' and i + 1 < len(remaining):
                                            code_content += remaining[i:i+2]
                                            i += 2
                                        elif remaining[i] == '"':
                                            break
                                        else:
                                            code_content += remaining[i]
                                            i += 1

                                    # Unescape the JSON string
                                    try:
                                        code_content = code_content.encode().decode(
                                            "unicode_escape"
                                        )
                                    except Exception:
                                        # Intentional: unicode decode failure is non-fatal, keep original content
                                        pass

                                    new_blocks = self.block_parser.feed(code_content)
                                    for block in new_blocks:
                                        # Get position from parser's updated state (may have position.set() now)
                                        updated_block = self.block_parser.blocks.get(block.variable_name, block)
                                        block_json = self.block_parser.to_block_json(updated_block)
                                        yield ActivityEvent(
                                            type="block_preview",
                                            data={"block": block_json},
                                        )
                            except Exception:
                                # Best effort - block parsing is non-fatal, don't break streaming
                                pass

            # Build assistant message from accumulated data
            assistant_message = {"role": "assistant", "content": accumulated_text}

            # Note: We don't yield a final 'thought' event here since we've been
            # streaming text_delta events. The frontend accumulates those into a thought.

            # Add tool calls to message
            tool_calls_list = list(accumulated_tool_calls.values())
            if tool_calls_list:
                assistant_message["tool_calls"] = tool_calls_list

            # Save assistant message
            conversation.append(assistant_message)
            self.session_service.save_conversation(self.session_id, conversation)
            messages.append(assistant_message)

            # No function calls - agent responded with content only
            if not tool_calls_list:
                # If agent responds with content only (no tool calls), treat this as
                # a conversational response and end the loop successfully
                if accumulated_text.strip():
                    yield ActivityEvent(
                        type="complete",
                        data={
                            "success": True,
                            "reason": TerminateReason.GOAL,
                            "message": "Agent responded with message",
                        },
                    )
                    return
                else:
                    # No content and no tool calls - protocol violation
                    yield ActivityEvent(
                        type="complete",
                        data={
                            "success": False,
                            "reason": TerminateReason.NO_COMPLETE_TASK,
                            "message": "Agent stopped without content or tool calls",
                        },
                    )
                    return

            # Process function calls
            task_completed = False
            serialized_responses = []

            for tool_call in tool_calls_list:
                # Parse tool call
                func_name = tool_call["function"]["name"]
                func_args = json.loads(tool_call["function"]["arguments"])

                yield ActivityEvent(
                    type="tool_call",
                    data={"name": func_name, "args": func_args},
                )

                # Execute tool - inject session_id automatically
                tool_params = dict(func_args) if func_args else {}
                tool_params["session_id"] = self.session_id

                invocation = await self.tool_registry.build_invocation(
                    func_name, tool_params
                )

                if not invocation:
                    tool_result = {"error": f"Tool {func_name} not found"}
                else:
                    result = await invocation.execute()
                    tool_result = result.to_dict()

                    # Check if this is complete_task
                    if func_name == "complete_task" and result.is_success():
                        task_completed = True

                yield ActivityEvent(type="tool_result", data=tool_result)

                # Build tool response in OpenAI format
                tool_response = {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id", ""),
                    "content": json.dumps(tool_result),
                    "name": func_name,
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
