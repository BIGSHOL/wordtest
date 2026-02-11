"""Add individual test codes to test_assignments.

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2026-02-11 18:00:00.000000
"""
import secrets
from alembic import op
import sqlalchemy as sa

revision = "k5l6m7n8o9p0"
down_revision = "j4k5l6m7n8o9"
branch_labels = None
depends_on = None

CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _generate_code():
    return "".join(secrets.choice(CODE_CHARS) for _ in range(8))


def upgrade() -> None:
    # 1. Add test_code column to test_assignments (nullable first for data migration)
    op.add_column(
        "test_assignments",
        sa.Column("test_code", sa.String(8), nullable=True),
    )

    # 2. Data migration: assign unique codes to existing assignments
    conn = op.get_bind()
    assignments = conn.execute(
        sa.text("SELECT id FROM test_assignments WHERE test_code IS NULL")
    ).fetchall()

    existing_codes = set()
    for (assignment_id,) in assignments:
        while True:
            code = _generate_code()
            if code not in existing_codes:
                existing_codes.add(code)
                break
        conn.execute(
            sa.text("UPDATE test_assignments SET test_code = :code WHERE id = :id"),
            {"code": code, "id": assignment_id},
        )

    # 3. Make test_code NOT NULL after data migration
    with op.batch_alter_table("test_assignments") as batch_op:
        batch_op.alter_column("test_code", nullable=False)
        batch_op.create_unique_constraint("uq_assignment_test_code", ["test_code"])
        batch_op.create_index("idx_assignment_test_code", ["test_code"])

    # 4. Make test_configs.test_code nullable and drop unique constraint
    with op.batch_alter_table("test_configs") as batch_op:
        batch_op.alter_column("test_code", nullable=True)
        batch_op.drop_index("idx_test_config_test_code")


def downgrade() -> None:
    with op.batch_alter_table("test_configs") as batch_op:
        batch_op.alter_column("test_code", nullable=False)
        batch_op.create_index("idx_test_config_test_code", ["test_code"], unique=True)

    with op.batch_alter_table("test_assignments") as batch_op:
        batch_op.drop_index("idx_assignment_test_code")
        batch_op.drop_constraint("uq_assignment_test_code", type_="unique")
        batch_op.drop_column("test_code")
