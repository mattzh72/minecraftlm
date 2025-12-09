"""
Agent executor - main agentic loop
"""

import json
import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import AsyncIterator, Literal

from app.agent.llms import (
    AnthropicService,
    BaseLLMService,
    GeminiService,
    OpenAIService,
)
from app.agent.tools.complete_task import CompleteTaskTool
from app.agent.tools.edit_code import EditCodeTool
from app.agent.tools.read_code import ReadCodeTool
from app.agent.tools.registry import ToolRegistry
from app.config import get_provider_for_model, settings
from app.models import (
    AssistantMessage,
    ToolCall,
    ToolCallFunction,
    ToolMessage,
    UserMessage,
)
from app.services.session import SessionService

# Event types emitted by the agent
ActivityEventType = Literal[
    "thought",
    "text_delta",
    "tool_call",
    "tool_result",
    "complete",
    "turn_start",
    "error",
]

logger = logging.getLogger(__name__)


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

    # Available providers based on configured API keys
    _providers: dict[str, type[BaseLLMService]] = {}

    @classmethod
    def get_available_providers(cls) -> dict[str, type[BaseLLMService]]:
        """Get providers with configured API keys"""
        providers = {}
        if settings.gemini_api_key:
            providers["gemini"] = GeminiService
        if settings.openai_api_key:
            providers["openai"] = OpenAIService
        if settings.anthropic_api_key:
            providers["anthropic"] = AnthropicService
        return providers

    def __init__(self, session_id: str, model: str | None = None, max_turns: int = 20):
        self.session_id = session_id
        self.max_turns = max_turns

        # Use provided model or fall back to config
        self.model = model or settings.llm_model
        provider = get_provider_for_model(self.model)

        # Get available providers
        self._providers = self.get_available_providers()
        if provider not in self._providers:
            raise ValueError(
                f"Provider '{provider}' for model '{self.model}' not available. "
                f"Available: {list(self._providers.keys())}"
            )

        # Initialize LLM service
        self.llm = self._providers[provider](self.model)

        self.session_service = SessionService()

        # Initialize tools
        tools = [ReadCodeTool(), EditCodeTool(), CompleteTaskTool()]
        self.tool_registry = ToolRegistry(tools)

        # Load system prompt template and SDK docs
        prompt_path = Path(__file__).parent / "prompts" / "system_prompt.txt"
        self.prompt_template = prompt_path.read_text()

        docs_dir = Path(__file__).parent / "minecraft" / "docs"
        self.sdk_replacements = {
            "[[SDK_OVERVIEW]]": f"01-overview.md\n\n{(docs_dir / '01-overview.md').read_text()}",
            "[[SDK_API_SCENE]]": f"02-api-scene.md\n\n{(docs_dir / '02-api-scene.md').read_text()}",
            "[[SDK_BLOCKS_REFERENCE]]": f"03-blocks-reference.md\n\n{(docs_dir / '03-blocks-reference.md').read_text()}",
            "[[SDK_BLOCK_LIST]]": f"04-block-list.md\n\n{(docs_dir / '04-block-list.md').read_text()}",
            "[[SDK_PITFALLS]]": f"05-pitfalls.md\n\n{(docs_dir / '05-pitfalls.md').read_text()}",
            "[[SDK_TERRAIN]]": f"06-terrain-guide.md\n\n{(docs_dir / '06-terrain-guide.md').read_text()}",
        }

    def _build_system_prompt(self) -> str:
        """Build system prompt with SDK docs embedded."""
        template = self.prompt_template

        # Inject SDK docs
        for marker, text in self.sdk_replacements.items():
            template = template.replace(marker, text)

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

        # Lock the model to this session on first use
        self.session_service.set_model(self.session_id, self.model)

        # Load conversation history
        conversation = self.session_service.load_conversation(self.session_id)

        # Add user message
        conversation.append(UserMessage(role="user", content=user_message).model_dump())
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

            # Call model with tools (streaming)
            logger.info(f"yielding event type=turn_start, turn={turn_count}")
            yield ActivityEvent(type="turn_start", data={"turn": turn_count})

            # Accumulators for streaming response
            accumulated_text = ""
            accumulated_thought = ""
            accumulated_thinking_signature = None
            accumulated_tool_calls = {}  # index -> tool call dict

            # Stream response chunks (rebuild system prompt to include latest code)
            async for chunk in self.llm.generate_with_tools_streaming(
                self._build_system_prompt(),
                messages,
                self.tool_registry.get_tool_schemas(),
            ):
                logger.info(f"handling chunk, chunk={chunk}")

                # Stream thought summaries separately when available (Gemini/Anthropic)
                thought_delta = getattr(chunk, "thought_delta", None)
                if thought_delta:
                    accumulated_thought += thought_delta
                    yield ActivityEvent(type="thought", data={"delta": thought_delta})

                # Capture thinking signature (Anthropic)
                thought_signature = getattr(chunk, "thought_signature", None)
                if thought_signature:
                    accumulated_thinking_signature = thought_signature

                # Handle text delta
                if chunk.text_delta:
                    accumulated_text += chunk.text_delta
                    logger.info(
                        f"yielding event type=text_delta, delta={chunk.text_delta}"
                    )
                    yield ActivityEvent(
                        type="text_delta", data={"delta": chunk.text_delta}
                    )

                # Handle tool calls delta
                if chunk.tool_calls_delta:
                    logger.info(
                        f"yielding event type=tool_calls_delta, delta={chunk.tool_calls_delta}"
                    )
                    for tc_delta in chunk.tool_calls_delta:
                        idx = tc_delta.get("index", 0)
                        if idx not in accumulated_tool_calls:
                            accumulated_tool_calls[idx] = {
                                "id": tc_delta.get("id"),
                                "type": tc_delta.get("type", "function"),
                                "function": {"name": "", "arguments": ""},
                                "extra_content": {},
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

                        # Capture provider-specific metadata such as thought signatures
                        extra_content = tc_delta.get("extra_content") or {}
                        if extra_content:
                            # Merge dictionaries shallowly; we only expect google.thought_signature for now
                            merged_extra = accumulated_tool_calls[idx].get(
                                "extra_content", {}
                            )
                            merged_extra.update(extra_content)
                            accumulated_tool_calls[idx]["extra_content"] = merged_extra
                        if tc_delta.get("thought_signature"):
                            accumulated_tool_calls[idx]["thought_signature"] = tc_delta[
                                "thought_signature"
                            ]

                        # Update ID if provided
                        if "id" in tc_delta:
                            accumulated_tool_calls[idx]["id"] = tc_delta["id"]

            # Build tool calls from accumulated data
            tool_calls_list: list[ToolCall] = []
            for tc_data in accumulated_tool_calls.values():
                tool_calls_list.append(
                    ToolCall(
                        id=tc_data.get("id"),
                        type="function",
                        function=ToolCallFunction(
                            name=tc_data.get("function", {}).get("name", ""),
                            arguments=tc_data.get("function", {}).get("arguments", ""),
                        ),
                        thought_signature=tc_data.get("thought_signature"),
                        extra_content=tc_data.get("extra_content", {}),
                    )
                )

            # Build assistant message
            assistant_message = AssistantMessage(
                role="assistant",
                content=accumulated_text,
                thought_summary=accumulated_thought or None,
                thinking_signature=accumulated_thinking_signature,
                tool_calls=tool_calls_list if tool_calls_list else None,
            ).model_dump()

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
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments or "{}")

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

                # Build tool response
                tool_response = ToolMessage(
                    role="tool",
                    tool_call_id=tool_call.id,
                    content=json.dumps(tool_result),
                    name=func_name,
                ).model_dump()
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
