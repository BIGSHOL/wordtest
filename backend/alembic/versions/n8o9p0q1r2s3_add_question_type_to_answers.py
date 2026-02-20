"""add_question_type_to_answers

Revision ID: n8o9p0q1r2s3
Revises: beb1a6d07f39
Create Date: 2026-02-20 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'n8o9p0q1r2s3'
down_revision: Union[str, None] = 'beb1a6d07f39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('test_answers', sa.Column('question_type', sa.String(20), nullable=True))
    op.add_column('learning_answers', sa.Column('question_type', sa.String(20), nullable=True))
    op.create_index('idx_answer_question_type', 'test_answers', ['question_type'])
    op.create_index('idx_lanswer_question_type', 'learning_answers', ['question_type'])


def downgrade() -> None:
    op.drop_index('idx_lanswer_question_type', table_name='learning_answers')
    op.drop_index('idx_answer_question_type', table_name='test_answers')
    op.drop_column('learning_answers', 'question_type')
    op.drop_column('test_answers', 'question_type')
