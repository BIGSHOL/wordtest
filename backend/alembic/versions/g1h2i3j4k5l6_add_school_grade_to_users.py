"""Add school_name and grade to users table.

Revision ID: g1h2i3j4k5l6
Revises: f0a1b2c3d4e5
Create Date: 2025-01-20 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "g1h2i3j4k5l6"
down_revision = "f0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("school_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("grade", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "grade")
    op.drop_column("users", "school_name")
