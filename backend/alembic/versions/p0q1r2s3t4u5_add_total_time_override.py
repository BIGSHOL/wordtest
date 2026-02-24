"""add_total_time_override

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2026-02-24 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'p0q1r2s3t4u5'
down_revision: Union[str, None] = 'o9p0q1r2s3t4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('test_configs', sa.Column('total_time_override_seconds', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('test_configs', 'total_time_override_seconds')
