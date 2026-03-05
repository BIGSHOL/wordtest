"""Add invite_code and invited_by columns to users.

Revision ID: x9y0z1a2b3c4
Revises: w8x9y0z1a2b3
Create Date: 2026-03-05
"""
from alembic import op
import sqlalchemy as sa

revision = "x9y0z1a2b3c4"
down_revision = "w8x9y0z1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("invite_code", sa.String(8), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "invited_by",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_user_invite_code", "users", ["invite_code"], unique=True)


def downgrade() -> None:
    op.drop_index("idx_user_invite_code", table_name="users")
    op.drop_column("users", "invited_by")
    op.drop_column("users", "invite_code")
