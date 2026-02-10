"""add_test_configs_table

Revision ID: d8b3f5e6a7c8
Revises: c7a2e3f4d5b6
Create Date: 2026-02-10 20:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd8b3f5e6a7c8'
down_revision: Union[str, None] = 'c7a2e3f4d5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'test_configs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('teacher_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('test_type', sa.String(length=20), nullable=False),
        sa.Column('question_count', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('time_limit_seconds', sa.Integer(), nullable=False, server_default='300'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('book_name', sa.String(length=100), nullable=True),
        sa.Column('level_range_min', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('level_range_max', sa.Integer(), nullable=False, server_default='15'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_test_config_teacher_id', 'test_configs', ['teacher_id'])
    op.create_index('idx_test_config_active', 'test_configs', ['is_active'])


def downgrade() -> None:
    op.drop_index('idx_test_config_active', table_name='test_configs')
    op.drop_index('idx_test_config_teacher_id', table_name='test_configs')
    op.drop_table('test_configs')
