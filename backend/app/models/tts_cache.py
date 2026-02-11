"""TTS audio cache model - stores Gemini TTS audio for reuse."""
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, LargeBinary, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class TtsCache(Base):
    __tablename__ = "tts_cache"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    voice: Mapped[str] = mapped_column(String(20), nullable=False)
    audio_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False, default="audio/wav")
    audio_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )

    __table_args__ = (
        UniqueConstraint("text", "voice", name="uq_tts_text_voice"),
        Index("idx_tts_text_voice", "text", "voice"),
    )
