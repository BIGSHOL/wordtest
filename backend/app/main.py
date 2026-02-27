"""FastAPI application with authentication."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from app.api.v1 import auth, users, students, words, stats, test_configs, test_assignments, tts, levelup, legacy_test, teachers, grammar
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.utils.load_words import classify_expression

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: auto-classify multi-word expressions missing POS
    try:
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                text(
                    "SELECT id, english FROM words "
                    "WHERE (english LIKE '%~%' OR english LIKE '% %') "
                    "AND (part_of_speech IS NULL OR part_of_speech = '')"
                )
            )).fetchall()
            if rows:
                count = 0
                for row in rows:
                    pos = classify_expression(row.english)
                    if pos:  # None = uncertain (e.g. compound noun) → skip
                        await db.execute(
                            text("UPDATE words SET part_of_speech = :pos WHERE id = :id"),
                            {"pos": pos, "id": row.id},
                        )
                        count += 1
                if count > 0:
                    await db.commit()
                    logger.info("Auto-classified %d multi-word expressions", count)
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
app.include_router(words.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(test_configs.router, prefix="/api/v1")
app.include_router(test_assignments.router, prefix="/api/v1")
app.include_router(tts.router, prefix="/api/v1")
app.include_router(levelup.router, prefix="/api/v1")
app.include_router(legacy_test.router, prefix="/api/v1")
app.include_router(teachers.router, prefix="/api/v1")
app.include_router(grammar.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
