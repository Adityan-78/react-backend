"""Application settings. Database connectivity is configured explicitly per environment."""
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-only-change-this-secret-do-not-use-in-prod"


class Settings(BaseSettings):
    environment: str = "development"
    secret_key: str = _DEV_SECRET
    access_token_expire_minutes: int = 30
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15
    # Required: configure a SQL Server SQLAlchemy URL in the environment.
    # Supports SQL authentication or pyodbc trusted_connection=yes.
    database_url: str
    sql_echo: bool = False
    low_stock_threshold: int = 10
    frontend_origin: str = "http://localhost:5173"
    employee_purchase_requests_enabled: bool = False

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @field_validator("database_url")
    @classmethod
    def require_sql_server(cls, value: str) -> str:
        if not value.strip().lower().startswith("mssql+pyodbc://"):
            raise ValueError("DATABASE_URL must use mssql+pyodbc and the configured SQL Server")
        return value.strip()

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.is_production and (self.secret_key == _DEV_SECRET or len(self.secret_key) < 32):
            raise ValueError("SECRET_KEY must be a random string of at least 32 characters in production")
        if self.is_production and any(origin == "*" for origin in self.cors_origins):
            raise ValueError("Wildcard CORS origins are not permitted in production")
        return self


settings = Settings()
