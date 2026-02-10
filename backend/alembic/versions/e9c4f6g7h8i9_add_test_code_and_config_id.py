"""add test_code column to test_configs and test_config_id to test_sessions

Revision ID: e9c4f6g7h8i9
Revises: d8b3f5e6a7c8
Create Date: 2026-02-10 22:00:00.000000
"""
from typing import Sequence, Union
import uuid
import string
import random

from alembic import op
import sqlalchemy as sa


revision: str = 'e9c4f6g7h8i9'
down_revision: Union[str, None] = 'd8b3f5e6a7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=6))


def upgrade() -> None:
    # 1. Add test_code column with a temporary server_default
    op.add_column(
        'test_configs',
        sa.Column('test_code', sa.String(length=6), nullable=False, server_default='TEMP00'),
    )

    # 2. Assign unique codes to existing rows
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id FROM test_configs")).fetchall()
    used_codes: set[str] = set()
    for row in rows:
        code = _generate_code()
        while code in used_codes:
            code = _generate_code()
        used_codes.add(code)
        conn.execute(
            sa.text("UPDATE test_configs SET test_code = :code WHERE id = :id"),
            {"code": code, "id": row[0]},
        )

    # 3. Remove the server_default and add unique constraint
    with op.batch_alter_table('test_configs') as batch_op:
        batch_op.alter_column('test_code', server_default=None)
        batch_op.create_index('idx_test_config_test_code', ['test_code'], unique=True)

    # 4. Add test_config_id, determined_sublevel, rank_name to test_sessions
    op.add_column(
        'test_sessions',
        sa.Column('test_config_id', sa.String(length=36), nullable=True),
    )
    op.add_column(
        'test_sessions',
        sa.Column('determined_sublevel', sa.Integer(), nullable=True),
    )
    op.add_column(
        'test_sessions',
        sa.Column('rank_name', sa.String(length=20), nullable=True),
    )
    op.create_foreign_key(
        'fk_test_sessions_test_config_id',
        'test_sessions',
        'test_configs',
        ['test_config_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_test_sessions_test_config_id', 'test_sessions', type_='foreignkey')
    op.drop_column('test_sessions', 'rank_name')
    op.drop_column('test_sessions', 'determined_sublevel')
    op.drop_column('test_sessions', 'test_config_id')

    with op.batch_alter_table('test_configs') as batch_op:
        batch_op.drop_index('idx_test_config_test_code')
    op.drop_column('test_configs', 'test_code')
