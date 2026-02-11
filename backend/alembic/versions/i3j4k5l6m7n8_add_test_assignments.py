"""Add phone_number to users, new columns to test_configs, and test_assignments table.

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-02-11 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "i3j4k5l6m7n8"
down_revision = "h2i3j4k5l6m7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add phone_number to users
    op.add_column("users", sa.Column("phone_number", sa.String(20), nullable=True))

    # 2. Add new columns to test_configs
    op.add_column("test_configs", sa.Column("per_question_time_seconds", sa.Integer(), nullable=True))
    op.add_column("test_configs", sa.Column("question_types", sa.String(50), nullable=True))
    op.add_column("test_configs", sa.Column("lesson_range_start", sa.String(50), nullable=True))
    op.add_column("test_configs", sa.Column("lesson_range_end", sa.String(50), nullable=True))

    # 3. Create test_assignments table
    op.create_table(
        "test_assignments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("test_config_id", sa.String(36), sa.ForeignKey("test_configs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("test_session_id", sa.String(36), sa.ForeignKey("test_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("test_config_id", "student_id", name="uq_assignment_config_student"),
    )
    op.create_index("idx_assignment_student_id", "test_assignments", ["student_id"])
    op.create_index("idx_assignment_teacher_id", "test_assignments", ["teacher_id"])
    op.create_index("idx_assignment_status", "test_assignments", ["status"])


def downgrade() -> None:
    # Drop test_assignments
    op.drop_index("idx_assignment_status", table_name="test_assignments")
    op.drop_index("idx_assignment_teacher_id", table_name="test_assignments")
    op.drop_index("idx_assignment_student_id", table_name="test_assignments")
    op.drop_table("test_assignments")

    # Drop test_configs new columns
    op.drop_column("test_configs", "lesson_range_end")
    op.drop_column("test_configs", "lesson_range_start")
    op.drop_column("test_configs", "question_types")
    op.drop_column("test_configs", "per_question_time_seconds")

    # Drop users phone_number
    op.drop_column("users", "phone_number")
