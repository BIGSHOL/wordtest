"""Add book_name_end column to test_configs.

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2026-02-11 23:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "m7n8o9p0q1r2"
down_revision = "l6m7n8o9p0q1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "test_configs",
        sa.Column("book_name_end", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("test_configs", "book_name_end")
