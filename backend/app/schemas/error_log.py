"""Error log schemas."""
from typing import Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ClientErrorCreate(BaseModel):
    """Frontend error submission (no auth required)."""
    level: str = Field(default="error", pattern="^(error|warning|info)$")
    message: str = Field(..., max_length=500)
    detail: Optional[str] = Field(None, max_length=5000)
    stack_trace: Optional[str] = Field(None, max_length=10000)
    endpoint: Optional[str] = Field(None, max_length=255)
    user_id: Optional[str] = Field(None, max_length=36)
    username: Optional[str] = Field(None, max_length=100)


class ErrorLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    level: str
    source: str
    message: str
    detail: Optional[str] = None
    stack_trace: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status_code: Optional[int] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime


class ErrorLogListResponse(BaseModel):
    items: list[ErrorLogResponse]
    total: int
    page: int
    limit: int
