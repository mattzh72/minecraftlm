# Known models per provider
from pydantic import BaseModel

AVAILABLE_MODELS = {
    "gemini": [
        "gemini/gemini-3-pro-preview",
        "gemini/gemini-3-flash-preview",
    ],
    "openai": [
        "gpt-5.2",
    ],
    "anthropic": [
        "claude-opus-4-5-20251101",
        "claude-sonnet-4-5-20250929",
    ],
}


class ModelInfo(BaseModel):
    """Model information"""

    id: str
    provider: str


class ModelsResponse(BaseModel):
    """Response for listing models"""

    models: list[ModelInfo]
    default: str
