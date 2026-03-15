from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    QUIVER_API_KEY: str
    FMP_API_KEY: str = ""
    INGEST_INTERVAL_MINUTES: int = 15
    AMENDMENT_RECHECK_DAYS: int = 90
    INTERNAL_SECRET: str
    REDIS_URL: str = "redis://localhost:6379/0"
    NEXTJS_URL: str = ""
    REVALIDATE_SECRET: str = ""
    CONGRESS_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()  # type: ignore[call-arg]  # pydantic-settings reads from env/dotenv
