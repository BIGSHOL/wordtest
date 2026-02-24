"""add_skill_area_columns

Revision ID: r3s4t5u6v7w8
Revises: q2r3s4t5u6v7
Create Date: 2026-02-24 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'r3s4t5u6v7w8'
down_revision: Union[str, None] = 'q2r3s4t5u6v7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('words', sa.Column('area1_meaning', sa.Text(), nullable=True))
    op.add_column('words', sa.Column('area2_association', sa.Text(), nullable=True))
    op.add_column('words', sa.Column('area3_pronunciation', sa.Text(), nullable=True))
    op.add_column('words', sa.Column('area4_inference', sa.Text(), nullable=True))
    op.add_column('words', sa.Column('area5_spelling', sa.Text(), nullable=True))
    op.add_column('words', sa.Column('area6_context', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('words', 'area6_context')
    op.drop_column('words', 'area5_spelling')
    op.drop_column('words', 'area4_inference')
    op.drop_column('words', 'area3_pronunciation')
    op.drop_column('words', 'area2_association')
    op.drop_column('words', 'area1_meaning')
