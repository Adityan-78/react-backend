"""Application settings, loaded from environment variables / the .env file.

Nothing secret should ever be hard-coded here. The defaults below are
development-only placeholders so the app can boot on a fresh checkout.
"""
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The placeholder secret is only acceptable on a developer machine.
_DEV_SECRET = "dev-only-change-this-secret-do-not-use-in-prod"


class Settings(BaseSettings):
    # "development" or "production". Production turns on stricter checks.
    environment: str = "development"

    # --- Authentication -----------------------------------------------------
    secret_key: str = _DEV_SECRET
    access_token_expire_minutes: int = 30
    # Brute-force protection for the login endpoint.
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    # --- Database (dummy value - the real connection is wired up later) -----
    database_url: str = (
        "mssql+pyodbc://dummy_user:dummy_password@localhost:1433/B3A-S7-T2"
        "?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
    )
    sql_echo: bool = False

    # --- CORS: one origin or a comma separated list -------------------------
    frontend_origin: str = "http://localhost:5173"

    # --- Business switches --------------------------------------------------
    # The spec says plain employees may raise purchase requests "if enabled".
    employee_purchase_requests_enabled: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @model_validator(mode="after")
    def _refuse_weak_secret_in_production(self) -> "Settings":
        # Fail fast at start-up instead of silently running with a guessable key.
        if self.is_production and (
            self.secret_key == _DEV_SECRET or len(self.secret_key) < 32
        ):
            raise ValueError(
                "SECRET_KEY must be a random string of at least 32 characters "
                "when ENVIRONMENT=production"
            )
        return self


settings = Settings()
