"""FastAPI application with authentication."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, users, students, tests, words, stats, test_configs
from app.core.config import settings

app = FastAPI(title="API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "https://wordtest-three.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(tests.router, prefix="/api/v1")
app.include_router(words.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(test_configs.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
