"""WordExample model - multiple example sentences per word."""
import uuid

from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WordExample(Base):
    __tablename__ = "word_examples"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    word_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="CASCADE"), nullable=False
    )
    example_en: Mapped[str] = mapped_column(String(500), nullable=False)
    example_ko: Mapped[str] = mapped_column(String(500), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("idx_word_example_word_id", "word_id"),
        Index("idx_word_example_word_order", "word_id", "order_index"),
    )
