"""add_word_examples_table

Revision ID: p1q2r3s4t5u6
Revises: p0q1r2s3t4u5
Create Date: 2026-02-24 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'p1q2r3s4t5u6'
down_revision: Union[str, None] = 'p0q1r2s3t4u5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create word_examples table
    op.create_table(
        'word_examples',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('word_id', sa.String(36), sa.ForeignKey('words.id', ondelete='CASCADE'), nullable=False),
        sa.Column('example_en', sa.String(500), nullable=False),
        sa.Column('example_ko', sa.String(500), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index('idx_word_example_word_id', 'word_examples', ['word_id'])
    op.create_index('idx_word_example_word_order', 'word_examples', ['word_id', 'order_index'])

    # Migrate existing example_en/ko data as order_index=0
    op.execute("""
        INSERT INTO word_examples (id, word_id, example_en, example_ko, order_index)
        SELECT gen_random_uuid()::text, id, example_en, example_ko, 0
        FROM words
        WHERE example_en IS NOT NULL AND example_en != ''
          AND example_ko IS NOT NULL AND example_ko != ''
    """)


def downgrade() -> None:
    op.drop_index('idx_word_example_word_order', table_name='word_examples')
    op.drop_index('idx_word_example_word_id', table_name='word_examples')
    op.drop_table('word_examples')
