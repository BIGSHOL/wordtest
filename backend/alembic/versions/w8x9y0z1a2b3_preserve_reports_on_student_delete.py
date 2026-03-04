"""Preserve reports on student/assignment delete — CASCADE to SET NULL.

Revision ID: w8x9y0z1a2b3
Revises: v7w8x9y0z1a2
Create Date: 2026-03-04
"""
from alembic import op

revision = "w8x9y0z1a2b3"
down_revision = "v7w8x9y0z1a2"
branch_labels = None
depends_on = None


def _replace_fk(table: str, column: str, ref: str, old_action: str, new_action: str):
    """Drop old FK and create new one with different ondelete action."""
    fk_name = f"fk_{table}_{column}"
    # Drop existing FK (naming convention may vary — use batch for safety)
    op.drop_constraint(fk_name, table, type_="foreignkey")
    op.create_foreign_key(fk_name, table, ref.split(".")[0], [column], [ref.split(".")[1]], ondelete=new_action)


def upgrade():
    # 1. Make columns nullable
    op.alter_column("test_sessions", "student_id", nullable=True)
    op.alter_column("grammar_sessions", "student_id", nullable=True)
    op.alter_column("grammar_sessions", "assignment_id", nullable=True)
    op.alter_column("learning_sessions", "student_id", nullable=True)
    op.alter_column("learning_sessions", "assignment_id", nullable=True)
    op.alter_column("learning_answers", "word_mastery_id", nullable=True)

    # 2. Replace CASCADE FKs with SET NULL
    # test_sessions.student_id
    op.drop_constraint("test_sessions_student_id_fkey", "test_sessions", type_="foreignkey")
    op.create_foreign_key("test_sessions_student_id_fkey", "test_sessions", "users", ["student_id"], ["id"], ondelete="SET NULL")

    # grammar_sessions.student_id
    op.drop_constraint("grammar_sessions_student_id_fkey", "grammar_sessions", type_="foreignkey")
    op.create_foreign_key("grammar_sessions_student_id_fkey", "grammar_sessions", "users", ["student_id"], ["id"], ondelete="SET NULL")

    # grammar_sessions.assignment_id
    op.drop_constraint("grammar_sessions_assignment_id_fkey", "grammar_sessions", type_="foreignkey")
    op.create_foreign_key("grammar_sessions_assignment_id_fkey", "grammar_sessions", "test_assignments", ["assignment_id"], ["id"], ondelete="SET NULL")

    # learning_sessions.student_id
    op.drop_constraint("learning_sessions_student_id_fkey", "learning_sessions", type_="foreignkey")
    op.create_foreign_key("learning_sessions_student_id_fkey", "learning_sessions", "users", ["student_id"], ["id"], ondelete="SET NULL")

    # learning_sessions.assignment_id
    op.drop_constraint("learning_sessions_assignment_id_fkey", "learning_sessions", type_="foreignkey")
    op.create_foreign_key("learning_sessions_assignment_id_fkey", "learning_sessions", "test_assignments", ["assignment_id"], ["id"], ondelete="SET NULL")

    # learning_answers.word_mastery_id
    op.drop_constraint("learning_answers_word_mastery_id_fkey", "learning_answers", type_="foreignkey")
    op.create_foreign_key("learning_answers_word_mastery_id_fkey", "learning_answers", "word_mastery", ["word_mastery_id"], ["id"], ondelete="SET NULL")


def downgrade():
    # Revert to CASCADE
    op.drop_constraint("learning_answers_word_mastery_id_fkey", "learning_answers", type_="foreignkey")
    op.create_foreign_key("learning_answers_word_mastery_id_fkey", "learning_answers", "word_mastery", ["word_mastery_id"], ["id"], ondelete="CASCADE")

    op.drop_constraint("learning_sessions_assignment_id_fkey", "learning_sessions", type_="foreignkey")
    op.create_foreign_key("learning_sessions_assignment_id_fkey", "learning_sessions", "test_assignments", ["assignment_id"], ["id"], ondelete="CASCADE")

    op.drop_constraint("learning_sessions_student_id_fkey", "learning_sessions", type_="foreignkey")
    op.create_foreign_key("learning_sessions_student_id_fkey", "learning_sessions", "users", ["student_id"], ["id"], ondelete="CASCADE")

    op.drop_constraint("grammar_sessions_assignment_id_fkey", "grammar_sessions", type_="foreignkey")
    op.create_foreign_key("grammar_sessions_assignment_id_fkey", "grammar_sessions", "test_assignments", ["assignment_id"], ["id"], ondelete="CASCADE")

    op.drop_constraint("grammar_sessions_student_id_fkey", "grammar_sessions", type_="foreignkey")
    op.create_foreign_key("grammar_sessions_student_id_fkey", "grammar_sessions", "users", ["student_id"], ["id"], ondelete="CASCADE")

    op.drop_constraint("test_sessions_student_id_fkey", "test_sessions", type_="foreignkey")
    op.create_foreign_key("test_sessions_student_id_fkey", "test_sessions", "users", ["student_id"], ["id"], ondelete="CASCADE")

    # Revert nullable
    op.alter_column("learning_answers", "word_mastery_id", nullable=False)
    op.alter_column("learning_sessions", "assignment_id", nullable=False)
    op.alter_column("learning_sessions", "student_id", nullable=False)
    op.alter_column("grammar_sessions", "assignment_id", nullable=False)
    op.alter_column("grammar_sessions", "student_id", nullable=False)
    op.alter_column("test_sessions", "student_id", nullable=False)
