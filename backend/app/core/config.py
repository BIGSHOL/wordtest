from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"))

    # Supabase PostgreSQL (Transaction mode pooler uses port 6543)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/app"
    # Direct connection for migrations (bypasses pooler)
    DIRECT_DATABASE_URL: str = ""

    SECRET_KEY: str = "changeme"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    TEST_SESSION_TIMEOUT_MINUTES: int = 30

    # CORS - Vercel frontend URL
    FRONTEND_URL: str = "http://localhost:5173"

    # Supabase (optional, for storage/realtime later)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # Google Gemini TTS (optional)
    GEMINI_API_KEY: str = ""


settings = Settings()
