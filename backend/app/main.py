"""FastAPI application with authentication."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from app.api.v1 import auth, users, students, tests, words, stats, test_configs, test_assignments, tts, mastery
from app.core.config import settings
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: one-time data fixes
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text(
                    "UPDATE words SET part_of_speech = '숙어' "
                    "WHERE english LIKE '%~%' AND (part_of_speech IS NULL OR part_of_speech = '')"
                )
            )
            if result.rowcount > 0:
                await db.commit()
                logger.info("Auto-tagged %d tilde words as 숙어", result.rowcount)
    except Exception as e:
        logger.warning("Startup word fix skipped: %s", e)
    yield


app = FastAPI(title="API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "https://wordtest-three.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

app.add_middleware(GZipMiddleware, minimum_size=500)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(tests.router, prefix="/api/v1")
app.include_router(words.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(test_configs.router, prefix="/api/v1")
app.include_router(test_assignments.router, prefix="/api/v1")
app.include_router(tts.router, prefix="/api/v1")
app.include_router(mastery.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
