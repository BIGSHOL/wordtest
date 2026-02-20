"""add_compatible_engines_to_words

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Create Date: 2026-02-20 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'o9p0q1r2s3t4'
down_revision: Union[str, None] = 'n8o9p0q1r2s3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('words', sa.Column('compatible_engines', sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column('words', 'compatible_engines')
