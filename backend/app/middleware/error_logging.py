"""Middleware that captures HTTP errors and unhandled exceptions to DB."""
import logging
import traceback
import json
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from app.db.session import AsyncSessionLocal
from app.services.error_log_service import create_error_log

logger = logging.getLogger(__name__)

SKIP_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

SENSITIVE_PATHS = {
    "/api/v1/auth/login/json",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/password/change",
}


def _get_user_info(request: Request) -> tuple[Optional[str], Optional[str]]:
    """Extract user_id and username from request state."""
    user_id = getattr(request.state, "user_id", None)
    username = getattr(request.state, "username", None)
    return user_id, username


def _build_detail(request: Request) -> Optional[str]:
    """Build context detail JSON from request metadata."""
    if request.url.path in SENSITIVE_PATHS:
        return None
    detail = {}
    if request.query_params:
        params = dict(request.query_params)
        # Scrub sensitive query params
        for k in list(params.keys()):
            if "token" in k.lower() or "password" in k.lower():
                params[k] = "[REDACTED]"
        detail["query_params"] = params
    if request.path_params:
        detail["path_params"] = dict(request.path_params)
    return json.dumps(detail, ensure_ascii=False) if detail else None


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path
        if path in SKIP_PATHS or not path.startswith("/api/"):
            return await call_next(request)

        # Initialize request state for user tracking
        if not hasattr(request.state, "user_id"):
            request.state.user_id = None
        if not hasattr(request.state, "username"):
            request.state.username = None

        try:
            response = await call_next(request)
        except Exception as exc:
            user_id, username = _get_user_info(request)
            try:
                async with AsyncSessionLocal() as db:
                    await create_error_log(
                        db,
                        level="error",
                        source="backend",
                        message=f"Unhandled: {type(exc).__name__}: {str(exc)[:200]}",
                        detail=_build_detail(request),
                        stack_trace=traceback.format_exc()[-5000:],
                        endpoint=path,
                        method=request.method,
                        status_code=500,
                        user_id=user_id,
                        username=username,
                        user_agent=request.headers.get("user-agent", "")[:500],
                        ip_address=request.client.host if request.client else None,
                    )
            except Exception as log_err:
                logger.warning("Failed to log error: %s", log_err)

            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )

        # Log 4xx/5xx (skip 401/404 to reduce noise)
        if response.status_code >= 500 or (
            response.status_code >= 400 and response.status_code not in (401, 404)
        ):
            level = "error" if response.status_code >= 500 else "warning"
            user_id, username = _get_user_info(request)
            try:
                async with AsyncSessionLocal() as db:
                    await create_error_log(
                        db,
                        level=level,
                        source="backend",
                        message=f"HTTP {response.status_code} on {request.method} {path}",
                        detail=_build_detail(request),
                        endpoint=path,
                        method=request.method,
                        status_code=response.status_code,
                        user_id=user_id,
                        username=username,
                        user_agent=request.headers.get("user-agent", "")[:500],
                        ip_address=request.client.host if request.client else None,
                    )
            except Exception as log_err:
                logger.warning("Failed to log HTTP error: %s", log_err)

        return response
