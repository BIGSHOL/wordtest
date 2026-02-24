"""add_question_type_counts_to_test_configs

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-02-24 15:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'q2r3s4t5u6v7'
down_revision: Union[str, None] = 'p1q2r3s4t5u6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Widen question_types column from String(50) to String(200)
    op.alter_column(
        'test_configs',
        'question_types',
        existing_type=sa.String(50),
        type_=sa.String(200),
        existing_nullable=True,
    )
    # Add new column for per-type question count distribution (JSON string)
    op.add_column(
        'test_configs',
        sa.Column('question_type_counts', sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('test_configs', 'question_type_counts')
    op.alter_column(
        'test_configs',
        'question_types',
        existing_type=sa.String(200),
        type_=sa.String(50),
        existing_nullable=True,
    )
