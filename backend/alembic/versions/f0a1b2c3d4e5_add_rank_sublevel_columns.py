"""add determined_sublevel and rank_name to test_sessions

Revision ID: f0a1b2c3d4e5
Revises: e9c4f6g7h8i9
Create Date: 2026-02-10 23:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f0a1b2c3d4e5'
down_revision: Union[str, None] = 'e9c4f6g7h8i9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Add columns only if they don't already exist
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'test_sessions' AND column_name = 'determined_sublevel'"
    ))
    if not result.fetchone():
        op.add_column(
            'test_sessions',
            sa.Column('determined_sublevel', sa.Integer(), nullable=True),
        )

    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'test_sessions' AND column_name = 'rank_name'"
    ))
    if not result.fetchone():
        op.add_column(
            'test_sessions',
            sa.Column('rank_name', sa.String(length=20), nullable=True),
        )


def downgrade() -> None:
    op.drop_column('test_sessions', 'rank_name')
    op.drop_column('test_sessions', 'determined_sublevel')
