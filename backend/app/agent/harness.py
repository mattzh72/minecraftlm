"""
Agent executor - main agentic loop
"""

import json
import logging
import uuid
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import AsyncIterator

from app.agent.llms import (
    AnthropicService,
    BaseLLMService,
    GeminiService,
    OpenAIService,
    StreamChunk,
)
from app.agent.llms.base import ThinkingLevel
from app.agent.tools.base import ToolResult
from app.agent.tools.edit_code import EditCodeTool
from app.agent.tools.read_code import ReadCodeTool
from app.agent.tools.registry import ToolRegistry
from app.config import get_provider_for_model, settings
from app.models import (
    AssistantMessage,
    ToolCall,
    ToolCallFunction,
    ToolMessage,
)

logger = logging.getLogger(__name__)


class ActivityEventType(StrEnum):
    """Event types emitted by the agent"""

    THOUGHT = "thought"
    TEXT_DELTA = "text_delta"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    COMPLETE = "complete"
    TURN_START = "turn_start"
    ERROR = "error"


class TerminateReason(StrEnum):
    """Reasons for agent termination"""

    GOAL = "GOAL"
    MAX_TURNS = "MAX_TURNS"
    ERROR = "ERROR"
    NO_COMPLETE_TASK = "NO_COMPLETE_TASK"


@dataclass
class ActivityEvent:
    """Activity event for streaming to UI"""

    type: ActivityEventType
    data: dict


@dataclass
class StreamResponse:
    """Accumulated response from LLM streaming"""

    text: str = ""
    thought: str = ""
    thinking_signature: str | None = None
    reasoning_items: list | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)


class ToolCallAccumulator:
    """Accumulates streaming tool call deltas into complete ToolCalls"""

    def __init__(self):
        self._calls: dict[int, dict] = {}

    def add_delta(self, delta: dict) -> None:
        """Add a tool call delta to the accumulator"""
        idx = delta.get("index", 0)

        if idx not in self._calls:
            self._calls[idx] = {
                "id": delta.get("id"),
                "type": delta.get("type", "function"),
                "function": {"name": "", "arguments": ""},
                "extra_content": {},
                "thought_signature": None,
            }

        call = self._calls[idx]

        # Accumulate function name
        if delta.get("function", {}).get("name"):
            call["function"]["name"] = delta["function"]["name"]

        # Accumulate function arguments
        if delta.get("function", {}).get("arguments"):
            call["function"]["arguments"] += delta["function"]["arguments"]

        # Merge extra content
        if delta.get("extra_content"):
            call["extra_content"].update(delta["extra_content"])

        # Capture thought signature
        if delta.get("thought_signature"):
            call["thought_signature"] = delta["thought_signature"]

        # Update ID if provided
        if delta.get("id"):
            call["id"] = delta["id"]

    def build(self) -> list[ToolCall]:
        """Build list of ToolCall objects from accumulated data"""
        result = []
        for tc_data in self._calls.values():
            tool_call_id = tc_data.get("id") or f"call_{uuid.uuid4().hex}"
            result.append(
                ToolCall(
                    id=tool_call_id,
                    type="function",
                    function=ToolCallFunction(
                        name=tc_data.get("function", {}).get("name", ""),
                        arguments=tc_data.get("function", {}).get("arguments", ""),
                    ),
                    thought_signature=tc_data.get("thought_signature"),
                    extra_content=tc_data.get("extra_content", {}),
                )
            )
        return result


class MinecraftSchematicAgent:
    """Executes the main agentic loop"""

    @staticmethod
    def get_available_providers() -> dict[str, type[BaseLLMService]]:
        """Get providers with configured API keys"""
        providers = {}
        if settings.gemini_api_key:
            providers["gemini"] = GeminiService
        if settings.openai_api_key:
            providers["openai"] = OpenAIService
        if settings.anthropic_api_key:
            providers["anthropic"] = AnthropicService
        return providers

    def __init__(
        self,
        session_id: str,
        model: str | None = None,
        thinking_level: ThinkingLevel = "med",
        max_turns: int = 20,
    ):
        self.session_id = session_id
        self.max_turns = max_turns
        self.thinking_level = thinking_level

        # Use provided model or fall back to config
        self.model = model or settings.llm_model
        provider = get_provider_for_model(self.model)

        # Validate provider availability
        available_providers = self.get_available_providers()
        if provider not in available_providers:
            raise ValueError(
                f"Provider '{provider}' for model '{self.model}' not available. "
                f"Available: {list(available_providers.keys())}"
            )

        # Initialize LLM service
        llm_class = available_providers[provider]
        self.llm = llm_class(self.model, self.thinking_level)

        # Initialize tools
        self.tool_registry = ToolRegistry([ReadCodeTool(), EditCodeTool()])

        # Load system prompt template and SDK docs
        self._load_prompt_template()

    def _load_prompt_template(self) -> None:
        """Load system prompt template and SDK documentation"""
        prompt_path = Path(__file__).parent / "prompts" / "system_prompt.txt"
        self.prompt_template = prompt_path.read_text()

        docs_dir = Path(__file__).parent / "minecraft" / "docs"
        self.sdk_replacements = {
            "[[SDK_OVERVIEW]]": f"01-overview.md\n\n{(docs_dir / '01-overview.md').read_text()}",
            "[[SDK_API_SCENE]]": f"02-api-scene.md\n\n{(docs_dir / '02-api-scene.md').read_text()}",
            "[[SDK_BLOCKS_REFERENCE]]": f"03-blocks-reference.md\n\n{(docs_dir / '03-blocks-reference.md').read_text()}",
            "[[SDK_BLOCK_LIST]]": f"04-block-list.md\n\n{(docs_dir / '04-block-list.md').read_text()}",
            "[[SDK_TERRAIN]]": f"05-terrain-guide.md\n\n{(docs_dir / '05-terrain-guide.md').read_text()}",
            "[[SDK_GUIDELINES]]": f"06-implementation-guidelines.md\n\n{(docs_dir / '06-implementation-guidelines.md').read_text()}",
        }

    def _build_system_prompt(self) -> str:
        """Build system prompt with SDK docs embedded"""
        template = self.prompt_template
        for marker, text in self.sdk_replacements.items():
            template = template.replace(marker, text)
        return template

    def _build_assistant_message(self, response: StreamResponse) -> dict:
        """Build assistant message dict from stream response"""
        return AssistantMessage(
            role="assistant",
            content=response.text,
            thought_summary=response.thought or None,
            thinking_signature=response.thinking_signature,
            tool_calls=response.tool_calls if response.tool_calls else None,
            reasoning_items=response.reasoning_items,
        ).model_dump()

    async def _execute_tool(self, tool_call: ToolCall) -> tuple[ToolResult, dict]:
        """Execute a single tool call and return result + serialized response"""
        func_name = tool_call.function.name
        func_args = json.loads(tool_call.function.arguments or "{}")

        # Inject session_id
        tool_params = dict(func_args) if func_args else {}
        tool_params["session_id"] = self.session_id

        invocation = await self.tool_registry.build_invocation(func_name, tool_params)

        if not invocation:
            result = ToolResult(
                error=f"Tool {func_name} not found", tool_call_id=tool_call.id
            )
        else:
            result = await invocation.execute()
            result.tool_call_id = tool_call.id

        # Build serialized response for conversation
        tool_response = ToolMessage(
            role="tool",
            tool_call_id=tool_call.id,
            content=json.dumps(
                {k: v for k, v in result.to_dict().items() if k != "tool_call_id"}
            ),
            name=func_name,
        ).model_dump()

        return result, tool_response

    async def _stream_llm_response(
        self, conversation: list[dict]
    ) -> AsyncIterator[tuple[ActivityEvent | None, StreamResponse]]:
        """
        Stream LLM response and yield events.

        Yields tuples of (event_to_emit, current_response_state).
        The final yield has the complete StreamResponse.
        """
        response = StreamResponse()
        tool_accumulator = ToolCallAccumulator()

        async for chunk in self.llm.generate_with_tools_streaming(
            self._build_system_prompt(),
            conversation,
            self.tool_registry.get_tool_schemas(),
        ):
            chunk: StreamChunk
            event = None

            # Handle thought delta
            thought_delta = getattr(chunk, "thought_delta", None)
            if thought_delta:
                response.thought += thought_delta
                event = ActivityEvent(
                    type=ActivityEventType.THOUGHT, data={"delta": thought_delta}
                )

            # Capture thinking signature
            thought_signature = getattr(chunk, "thought_signature", None)
            if thought_signature:
                response.thinking_signature = thought_signature

            # Handle text delta
            if chunk.text_delta:
                response.text += chunk.text_delta
                event = ActivityEvent(
                    type=ActivityEventType.TEXT_DELTA,
                    data={"delta": chunk.text_delta},
                )

            # Handle tool calls delta
            if chunk.tool_calls_delta:
                for tc_delta in chunk.tool_calls_delta:
                    tool_accumulator.add_delta(tc_delta)

            # Handle reasoning items (OpenAI)
            if chunk.reasoning_items:
                response.reasoning_items = chunk.reasoning_items

            if event:
                yield event, response

        # Build final tool calls
        response.tool_calls = tool_accumulator.build()
        yield None, response

    async def run(self, conversation: list[dict]) -> AsyncIterator[ActivityEvent]:
        """
        Run the agent loop.

        Args:
            conversation: Full conversation history including the new user message

        Yields:
            ActivityEvent for streaming to UI
        """
        for turn in range(1, self.max_turns + 1):
            logger.debug("Starting turn %d", turn)
            yield ActivityEvent(type=ActivityEventType.TURN_START, data={"turn": turn})

            # Stream LLM response
            response = StreamResponse()
            async for event, response in self._stream_llm_response(conversation):
                if event:
                    yield event

            # Build and save assistant message
            assistant_message = self._build_assistant_message(response)
            conversation.append(assistant_message)

            # Check for completion (no tool calls)
            if not response.tool_calls:
                if response.text.strip():
                    yield ActivityEvent(
                        type=ActivityEventType.COMPLETE,
                        data={
                            "success": True,
                            "reason": TerminateReason.GOAL,
                            "message": "Agent responded with message",
                            "conversation": conversation,
                        },
                    )
                else:
                    yield ActivityEvent(
                        type=ActivityEventType.COMPLETE,
                        data={
                            "success": False,
                            "reason": TerminateReason.NO_COMPLETE_TASK,
                            "message": "Agent stopped without content or tool calls",
                            "conversation": conversation,
                        },
                    )
                return

            # Execute tool calls
            tool_responses = []
            for tool_call in response.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments or "{}")

                yield ActivityEvent(
                    type=ActivityEventType.TOOL_CALL,
                    data={"id": tool_call.id, "name": func_name, "args": func_args},
                )

                result, tool_response = await self._execute_tool(tool_call)

                yield ActivityEvent(
                    type=ActivityEventType.TOOL_RESULT, data=result.to_dict()
                )

                tool_responses.append(tool_response)

            # Save tool responses to conversation
            conversation.extend(tool_responses)

        # Max turns reached
        yield ActivityEvent(
            type=ActivityEventType.COMPLETE,
            data={
                "success": False,
                "reason": TerminateReason.MAX_TURNS,
                "message": "Agent hit max turns limit",
                "conversation": conversation,
            },
        )
