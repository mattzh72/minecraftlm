"""
Models API endpoints - list available LLM models
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.agent.harness import MinecraftSchematicAgent
from app.config import settings

router = APIRouter()


# Known models per provider
AVAILABLE_MODELS = {
    "gemini": [
        "gemini/gemini-2.5-pro-preview-06-05",
        "gemini/gemini-2.5-flash-preview-05-20",
        "gemini/gemini-3-pro-preview",
    ],
    "openai": [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
    ],
    "anthropic": [
        "claude-sonnet-4-20250514",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
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


@router.get("/models")
async def list_models() -> ModelsResponse:
    """
    List available LLM models based on configured API keys.
    Only returns models for providers with valid API keys.
    """
    available_providers = MinecraftSchematicAgent.get_available_providers()

    models = []
    for provider, model_ids in AVAILABLE_MODELS.items():
        if provider in available_providers:
            for model_id in model_ids:
                models.append(ModelInfo(id=model_id, provider=provider))

    return ModelsResponse(
        models=models,
        default=settings.llm_model,
    )
