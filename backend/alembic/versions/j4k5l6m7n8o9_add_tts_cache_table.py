"""Add tts_cache table for persistent TTS audio caching.

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-02-11 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "j4k5l6m7n8o9"
down_revision = "i3j4k5l6m7n8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tts_cache",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("text", sa.String(500), nullable=False),
        sa.Column("voice", sa.String(20), nullable=False),
        sa.Column("audio_data", sa.LargeBinary(), nullable=False),
        sa.Column("mime_type", sa.String(50), nullable=False, server_default="audio/wav"),
        sa.Column("audio_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("text", "voice", name="uq_tts_text_voice"),
    )
    op.create_index("idx_tts_text_voice", "tts_cache", ["text", "voice"])


def downgrade() -> None:
    op.drop_index("idx_tts_text_voice", table_name="tts_cache")
    op.drop_table("tts_cache")
