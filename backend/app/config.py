"""
Configuration management using pydantic-settings
"""

from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


# Available models by provider
AVAILABLE_MODELS = {
    "openai": [
        "gpt-5",
        "gpt-5.1",
        "gpt-4.1",
        "gpt-4o",
        "gpt-4o-mini",
    ],
    "anthropic": [
        "claude-sonnet-4-20250514",
        "claude-opus-4-20250514",
    ],
    "gemini": [
        "gemini/gemini-2.5-pro",
        "gemini/gemini-2.5-flash",
        "gemini/gemini-2.0-flash",
    ],
}

# Default model for each provider
DEFAULT_MODELS = {
    "openai": "gpt-4o",
    "anthropic": "claude-sonnet-4-20250514",
    "gemini": "gemini/gemini-2.5-flash",
}


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # API Keys (all optional - only need key for selected provider)
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None

    # Model selection
    llm_provider: Literal["openai", "anthropic", "gemini"] = "gemini"
    llm_model: str | None = None  # If None, uses default for provider

    host: str = "0.0.0.0"
    port: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    def get_model(self) -> str:
        """Get the model to use, defaulting based on provider"""
        if self.llm_model:
            return self.llm_model
        return DEFAULT_MODELS[self.llm_provider]


settings = Settings()
