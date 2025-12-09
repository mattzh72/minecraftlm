"""
Models API endpoints - list available LLM models
"""

from app.agent.harness import MinecraftSchematicAgent
from app.api.models import ModelInfo, ModelsResponse
from app.api.models.llms import AVAILABLE_MODELS
from app.config import settings
from fastapi import APIRouter

router = APIRouter()


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

    return ModelsResponse(models=models, default=settings.llm_model)
