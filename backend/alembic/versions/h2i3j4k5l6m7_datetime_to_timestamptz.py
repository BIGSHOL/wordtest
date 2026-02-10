"""Convert all datetime columns to timestamptz for Supabase compatibility.

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-02-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "h2i3j4k5l6m7"
down_revision = "g1h2i3j4k5l6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users table
    op.alter_column("users", "created_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=False)
    op.alter_column("users", "updated_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=False)

    # words table
    op.alter_column("words", "created_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=False)

    # test_sessions table
    op.alter_column("test_sessions", "started_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=False)
    op.alter_column("test_sessions", "completed_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=True)

    # test_answers table
    op.alter_column("test_answers", "answered_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=True)

    # auth_tokens table
    op.alter_column("auth_tokens", "expires_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=False)
    op.alter_column("auth_tokens", "created_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=False)

    # test_configs table
    op.alter_column("test_configs", "created_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=False)
    op.alter_column("test_configs", "updated_at",
                     type_=sa.DateTime(timezone=True),
                     existing_type=sa.DateTime(),
                     existing_nullable=False)


def downgrade() -> None:
    # Revert all columns back to DateTime without timezone
    op.alter_column("test_configs", "updated_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=False)
    op.alter_column("test_configs", "created_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=False)
    op.alter_column("auth_tokens", "created_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=False)
    op.alter_column("auth_tokens", "expires_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=False)
    op.alter_column("test_answers", "answered_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=True)
    op.alter_column("test_sessions", "completed_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=True)
    op.alter_column("test_sessions", "started_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=False)
    op.alter_column("words", "created_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=False)
    op.alter_column("users", "updated_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=False)
    op.alter_column("users", "created_at",
                     type_=sa.DateTime(),
                     existing_type=sa.DateTime(timezone=True),
                     existing_nullable=False)
