from __future__ import annotations

from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    """
    App settings loaded from environment variables (and .env).

    Supports both:
      - OPENAI_API_KEY / OPENAI_MODEL / OPENAI_BASE_URL (recommended)
      - openai_api_key / openai_model / OPENAI_BASE_URL (common .env style)
    """

    # App
    APP_NAME: str = Field(
        default="AI Learning + Interview Copilot API",
        validation_alias=AliasChoices("APP_NAME", "app_name"),
    )

    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./app.db",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )

    # OpenAI
    OPENAI_API_KEY: str = Field(
        default="",
        validation_alias=AliasChoices("OPENAI_API_KEY", "openai_api_key"),
    )
    OPENAI_MODEL: str = Field(
        default="gpt-4",
        validation_alias=AliasChoices("OPENAI_MODEL", "openai_model"),
    )

    OPENAI_BASE_URL: str = Field(
        default="https://api.openai.com/v1",
        validation_alias=AliasChoices("OPENAI_BASE_URL", "openai_base_url"),
    )

    AI_TIMEOUT_SECS: int = Field(
        default=60,
        validation_alias=AliasChoices("AI_TIMEOUT_SECS", "ai_timeout_secs"),
    )

    # Optional: CORS (comma-separated origins), e.g. "http://localhost:3000"
    CORS_ORIGINS: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins"),
    )

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()