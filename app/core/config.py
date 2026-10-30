import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "dev-only-change-this-secret"
    access_token_expire_minutes: int = 30
    data_mode: str = "mock"
    database_url: str = "postgresql+psycopg://username:password@localhost:5432/business_ops"
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
