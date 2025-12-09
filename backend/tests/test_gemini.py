"""
Integration test for live Gemini streaming with thought summaries.
"""

import pytest

from app.config import settings
from app.agent.llms import GeminiService, StreamChunk


@pytest.mark.integration
@pytest.mark.asyncio
async def test_generate_with_tools_streaming_live_reasoning():
    """
    Requires GEMINI_API_KEY. Verifies streamed thoughts and text are returned.
    """
    if not settings.gemini_api_key:
        pytest.skip("GEMINI_API_KEY not set")

    service = GeminiService()

    messages = [
        {
            "role": "user",
            "content": (
                "Share a one-sentence fun fact about the Moon. "
                "Use your internal reasoning and keep the final answer concise."
            ),
        }
    ]

    chunks: list[StreamChunk] = []
    async for chunk in service.generate_with_tools_streaming(
        system_prompt="Be concise and correct.",
        messages=messages,
        tools=[],
    ):
        chunks.append(chunk)

    assert chunks, "No chunks were streamed from Gemini"

    text = "".join(c.text_delta or "" for c in chunks)
    thoughts = "".join(c.thought_delta or "" for c in chunks)

    assert text.strip(), "Expected text content in streamed chunks"
    assert thoughts.strip(), "Expected thought summaries in streamed chunks"
