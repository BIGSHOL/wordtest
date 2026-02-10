from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase PostgreSQL (Transaction mode pooler uses port 6543)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/app"
    # Direct connection for migrations (bypasses pooler)
    DIRECT_DATABASE_URL: str = ""

    SECRET_KEY: str = "changeme"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS - Vercel frontend URL
    FRONTEND_URL: str = "http://localhost:5173"

    # Supabase (optional, for storage/realtime later)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    class Config:
        env_file = ("../.env", ".env")


settings = Settings()
