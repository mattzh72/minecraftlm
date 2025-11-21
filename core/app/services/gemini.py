"""
Gemini API service
"""

from typing import AsyncIterator

from google import genai

from app.config import settings


class GeminiService:
    """Service for interacting with Gemini API"""

    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model_id = "gemini-2.0-flash-exp"

    async def generate_stream(
        self, system_prompt: str, conversation: list[dict]
    ) -> AsyncIterator[str]:
        """
        Stream responses from Gemini API.

        Args:
            system_prompt: System instructions for the model
            conversation: List of messages [{"role": "user"|"model", "content": str}]

        Yields:
            Response chunks as they're generated
        """
        # TODO: Implement streaming
        # - Format messages for Gemini API (role: user/model, parts: [{text: ...}])
        # - Include system prompt in config
        # - Stream response chunks
        # - Extract code from response
        yield ""
