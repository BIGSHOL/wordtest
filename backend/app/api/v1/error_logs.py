"""Error log endpoints - client error ingestion + master query."""
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import CurrentMaster
from app.schemas.error_log import (
    ClientErrorCreate,
    ErrorLogListResponse,
    ErrorLogResponse,
)
from app.services.error_log_service import (
    create_error_log,
    query_error_logs,
    cleanup_old_logs,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/logs", tags=["error-logs"])


@router.post("/client-error", status_code=201)
async def report_client_error(
    payload: ClientErrorCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Accept frontend error reports. No auth required."""
    await create_error_log(
        db,
        level=payload.level,
        source="frontend",
        message=payload.message,
        detail=payload.detail,
        stack_trace=payload.stack_trace,
        endpoint=payload.endpoint,
        user_id=payload.user_id,
        username=payload.username,
        user_agent=request.headers.get("user-agent", "")[:500],
        ip_address=request.client.host if request.client else None,
    )
    return {"status": "logged"}


@router.get("", response_model=ErrorLogListResponse)
async def list_error_logs(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
    level: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    status_code: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """List error logs with filtering (master only)."""
    items, total = await query_error_logs(
        db,
        level=level,
        source=source,
        date_from=date_from,
        date_to=date_to,
        search=search,
        status_code=status_code,
        page=page,
        limit=limit,
    )
    return ErrorLogListResponse(
        items=[ErrorLogResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        limit=limit,
    )


@router.delete("/cleanup")
async def cleanup_logs(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=365),
):
    """Delete logs older than N days (master only)."""
    deleted = await cleanup_old_logs(db, days=days)
    return {"deleted_count": deleted}
