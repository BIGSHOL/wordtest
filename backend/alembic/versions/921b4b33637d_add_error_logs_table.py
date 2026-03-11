"""add error_logs table

Revision ID: 921b4b33637d
Revises: w8x9y0z1a2b3
Create Date: 2026-03-11 16:58:03.170488
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '921b4b33637d'
down_revision: Union[str, None] = 'w8x9y0z1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('error_logs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('level', sa.String(length=10), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('message', sa.String(length=500), nullable=False),
    sa.Column('detail', sa.Text(), nullable=True),
    sa.Column('stack_trace', sa.Text(), nullable=True),
    sa.Column('endpoint', sa.String(length=255), nullable=True),
    sa.Column('method', sa.String(length=10), nullable=True),
    sa.Column('status_code', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.String(length=36), nullable=True),
    sa.Column('username', sa.String(length=100), nullable=True),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_error_log_created_at', 'error_logs', ['created_at'], unique=False)
    op.create_index('idx_error_log_level', 'error_logs', ['level'], unique=False)
    op.create_index('idx_error_log_source', 'error_logs', ['source'], unique=False)
    op.create_index('idx_error_log_status_code', 'error_logs', ['status_code'], unique=False)
    op.create_index('idx_error_log_user_id', 'error_logs', ['user_id'], unique=False)

def downgrade() -> None:
    op.drop_index('idx_error_log_user_id', table_name='error_logs')
    op.drop_index('idx_error_log_status_code', table_name='error_logs')
    op.drop_index('idx_error_log_source', table_name='error_logs')
    op.drop_index('idx_error_log_level', table_name='error_logs')
    op.drop_index('idx_error_log_created_at', table_name='error_logs')
    op.drop_table('error_logs')
