# Known models per provider
from pydantic import BaseModel

AVAILABLE_MODELS = {
    "gemini": [
        "gemini/gemini-3-pro-preview",
    ],
    "openai": [
        "gpt-5.1",
    ],
    "anthropic": [
        "claude-opus-4-5-20251101",
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
