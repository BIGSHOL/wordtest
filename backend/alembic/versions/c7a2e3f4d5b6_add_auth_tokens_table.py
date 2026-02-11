"""add_auth_tokens_table

Revision ID: c7a2e3f4d5b6
Revises: b5f8d1e2c3a4
Create Date: 2026-02-10 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c7a2e3f4d5b6'
down_revision: Union[str, None] = 'b5f8d1e2c3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # auth_tokens already created in initial_schema; skip if exists
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='auth_tokens'"
    ))
    if result.fetchone():
        return
    op.create_table(
        'auth_tokens',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('refresh_token', sa.String(length=500), unique=True, nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_auth_token_user_id', 'auth_tokens', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_auth_token_user_id', table_name='auth_tokens')
    op.drop_table('auth_tokens')
