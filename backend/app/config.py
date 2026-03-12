from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    QUIVER_API_KEY: str
    FMP_API_KEY: str = ""
    INGEST_INTERVAL_MINUTES: int = 15
    AMENDMENT_RECHECK_DAYS: int = 90
    INTERNAL_SECRET: str
    REDIS_URL: str
    NEXTJS_URL: str = ""
    REVALIDATE_SECRET: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
