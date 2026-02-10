"""add_word_extended_columns

Revision ID: b5f8d1e2c3a4
Revises: ab923cd0b93a
Create Date: 2026-02-10 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b5f8d1e2c3a4'
down_revision: Union[str, None] = 'ab923cd0b93a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to words table
    op.add_column('words', sa.Column('book_name', sa.String(length=100), nullable=False, server_default=''))
    op.add_column('words', sa.Column('lesson', sa.String(length=50), nullable=False, server_default=''))
    op.add_column('words', sa.Column('part_of_speech', sa.String(length=30), nullable=True))
    op.add_column('words', sa.Column('example_en', sa.String(length=500), nullable=True))
    op.add_column('words', sa.Column('example_ko', sa.String(length=500), nullable=True))

    # Create composite index on book_name and lesson
    op.create_index('idx_word_book_lesson', 'words', ['book_name', 'lesson'], unique=False)


def downgrade() -> None:
    # Drop composite index
    op.drop_index('idx_word_book_lesson', table_name='words')

    # Remove columns
    op.drop_column('words', 'example_ko')
    op.drop_column('words', 'example_en')
    op.drop_column('words', 'part_of_speech')
    op.drop_column('words', 'lesson')
    op.drop_column('words', 'book_name')
