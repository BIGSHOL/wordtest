"""Add antonym column to words table.

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2026-02-25
"""
from alembic import op
import sqlalchemy as sa

revision = "s4t5u6v7w8x9"
down_revision = "r3s4t5u6v7w8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("words", sa.Column("antonym", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("words", "antonym")
