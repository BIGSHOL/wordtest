"""KST timezone utility and timezone-aware DateTime column type."""
from datetime import datetime, timezone, timedelta

from sqlalchemy import DateTime as SADateTime
from sqlalchemy.types import TypeDecorator

KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """현재 시간을 KST timezone-aware datetime으로 반환."""
    return datetime.now(KST)


class TZDateTime(TypeDecorator):
    """Timezone-aware DateTime that works with both SQLite and PostgreSQL.

    - PostgreSQL: uses TIMESTAMP WITH TIME ZONE natively.
    - SQLite (tests): stores as naive datetime, restores KST tzinfo on read.
    """
    impl = SADateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            # SQLite strips timezone; assume stored value is KST
            value = value.replace(tzinfo=KST)
        return value
