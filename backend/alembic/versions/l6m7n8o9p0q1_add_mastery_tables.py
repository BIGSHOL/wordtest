"""Add mastery learning tables.

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2026-02-11 22:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "l6m7n8o9p0q1"
down_revision = "k5l6m7n8o9p0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add assignment_type to test_assignments (existing rows = 'legacy')
    op.add_column(
        "test_assignments",
        sa.Column("assignment_type", sa.String(20), nullable=False, server_default="legacy"),
    )

    # word_mastery table
    op.create_table(
        "word_mastery",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("word_id", sa.String(36), sa.ForeignKey("words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assignment_id", sa.String(36), sa.ForeignKey("test_assignments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("stage", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("total_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_correct", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("combo_best", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_practiced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("mastered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("student_id", "word_id", name="uq_mastery_student_word"),
    )
    op.create_index("idx_mastery_student_id", "word_mastery", ["student_id"])
    op.create_index("idx_mastery_student_stage", "word_mastery", ["student_id", "stage"])
    op.create_index("idx_mastery_assignment", "word_mastery", ["assignment_id"])
    op.create_index("idx_mastery_review_due", "word_mastery", ["student_id", "review_due_at"])

    # learning_sessions table
    op.create_table(
        "learning_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("student_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assignment_id", sa.String(36), sa.ForeignKey("test_assignments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_stage", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("words_practiced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("words_advanced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("words_demoted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_combo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_lsession_student", "learning_sessions", ["student_id"])
    op.create_index("idx_lsession_assignment", "learning_sessions", ["assignment_id"])

    # learning_answers table
    op.create_table(
        "learning_answers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("word_mastery_id", sa.String(36), sa.ForeignKey("word_mastery.id", ondelete="CASCADE"), nullable=False),
        sa.Column("word_id", sa.String(36), sa.ForeignKey("words.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("stage", sa.Integer(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("selected_answer", sa.String(500), nullable=True),
        sa.Column("correct_answer", sa.String(500), nullable=False),
        sa.Column("time_taken_sec", sa.Float(), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_lanswer_session", "learning_answers", ["session_id"])
    op.create_index("idx_lanswer_mastery", "learning_answers", ["word_mastery_id"])


def downgrade() -> None:
    op.drop_table("learning_answers")
    op.drop_table("learning_sessions")
    op.drop_table("word_mastery")
    op.drop_column("test_assignments", "assignment_type")
