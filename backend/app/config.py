"""
Configuration management using pydantic-settings
"""

from pydantic_settings import BaseSettings, SettingsConfigDict

# Model to provider mapping (prefix-based)
# TODO: Make this reused in the harness
MODEL_PREFIXES = {
    "gpt-": "openai",
    "claude-": "anthropic",
    "gemini/": "gemini",
}

DEFAULT_MODEL = "gemini/gemini-3-pro-preview"


def get_provider_for_model(model: str) -> str:
    """Infer provider from model name"""
    for prefix, provider in MODEL_PREFIXES.items():
        if model.startswith(prefix):
            return provider
    raise ValueError(
        f"Unknown model '{model}'. Model must start with one of: {list(MODEL_PREFIXES.keys())}"
    )


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # API Keys (all optional - only need key for selected provider)
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    gemini_api_key: str | None = None

    # Model selection - just set the model, provider is inferred
    llm_model: str = DEFAULT_MODEL

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False
    )

    def get_provider(self) -> str:
        """Get the provider for the configured model"""
        return get_provider_for_model(self.llm_model)


settings = Settings()
