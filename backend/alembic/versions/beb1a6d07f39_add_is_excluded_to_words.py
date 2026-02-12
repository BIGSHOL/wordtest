"""add_is_excluded_to_words

Revision ID: beb1a6d07f39
Revises: m7n8o9p0q1r2
Create Date: 2026-02-13 01:59:23.152989
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'beb1a6d07f39'
down_revision: Union[str, None] = 'm7n8o9p0q1r2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('words', sa.Column('is_excluded', sa.Boolean(), server_default='false', nullable=False))

def downgrade() -> None:
    op.drop_column('words', 'is_excluded')
