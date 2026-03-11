"""Error log service - write and query error logs."""
import logging
import json
import re
from datetime import timedelta
from typing import Optional

from sqlalchemy import select, func, delete, cast, Date, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.error_log import ErrorLog
from app.core.timezone import now_kst

logger = logging.getLogger(__name__)

SENSITIVE_KEYS = re.compile(
    r"(password|token|secret|authorization|cookie|credit.?card)",
    re.IGNORECASE,
)


def _scrub_detail(detail: Optional[str]) -> Optional[str]:
    """Remove sensitive fields from JSON detail strings."""
    if not detail:
        return detail
    try:
        data = json.loads(detail)
        if isinstance(data, dict):
            for key in list(data.keys()):
                if SENSITIVE_KEYS.search(key):
                    data[key] = "[REDACTED]"
            return json.dumps(data, ensure_ascii=False)
    except (json.JSONDecodeError, TypeError):
        pass
    return re.sub(
        r'("(?:password|token|secret|authorization)":\s*"[^"]*")',
        lambda m: m.group(0).split(":")[0] + ': "[REDACTED]"',
        detail,
        flags=re.IGNORECASE,
    )


async def create_error_log(
    db: AsyncSession,
    *,
    level: str,
    source: str,
    message: str,
    detail: Optional[str] = None,
    stack_trace: Optional[str] = None,
    endpoint: Optional[str] = None,
    method: Optional[str] = None,
    status_code: Optional[int] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> ErrorLog:
    """Insert a new error log entry."""
    log_entry = ErrorLog(
        level=level,
        source=source,
        message=message[:500],
        detail=_scrub_detail(detail),
        stack_trace=stack_trace[:10000] if stack_trace else None,
        endpoint=endpoint[:255] if endpoint else None,
        method=method,
        status_code=status_code,
        user_id=user_id,
        username=username[:100] if username else None,
        user_agent=user_agent[:500] if user_agent else None,
        ip_address=ip_address,
    )
    db.add(log_entry)
    await db.commit()
    return log_entry


async def query_error_logs(
    db: AsyncSession,
    *,
    level: Optional[str] = None,
    source: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    status_code: Optional[int] = None,
    page: int = 1,
    limit: int = 50,
) -> tuple[list[ErrorLog], int]:
    """Query error logs with filtering and pagination."""
    conditions = []

    if level:
        conditions.append(ErrorLog.level == level)
    if source:
        conditions.append(ErrorLog.source == source)
    if status_code is not None:
        conditions.append(ErrorLog.status_code == status_code)
    if date_from:
        conditions.append(cast(ErrorLog.created_at, Date) >= date_from)
    if date_to:
        conditions.append(cast(ErrorLog.created_at, Date) <= date_to)
    if search:
        pattern = f"%{search}%"
        conditions.append(
            ErrorLog.message.ilike(pattern) | ErrorLog.endpoint.ilike(pattern)
        )

    count_stmt = select(func.count(ErrorLog.id))
    stmt = select(ErrorLog)

    for cond in conditions:
        count_stmt = count_stmt.where(cond)
        stmt = stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(desc(ErrorLog.created_at))
    stmt = stmt.offset((page - 1) * limit).limit(limit)

    rows = (await db.execute(stmt)).scalars().all()
    return list(rows), total


async def cleanup_old_logs(db: AsyncSession, days: int = 30) -> int:
    """Delete error logs older than N days."""
    cutoff = now_kst() - timedelta(days=days)
    result = await db.execute(
        delete(ErrorLog).where(ErrorLog.created_at < cutoff)
    )
    await db.commit()
    return result.rowcount or 0
