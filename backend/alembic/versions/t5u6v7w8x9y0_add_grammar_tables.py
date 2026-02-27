"""Add grammar tables (8 tables) and grammar_config_id to test_assignments.

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-02-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "t5u6v7w8x9y0"
down_revision = "s4t5u6v7w8x9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. grammar_books
    op.create_table(
        "grammar_books",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # 2. grammar_chapters
    op.create_table(
        "grammar_chapters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "book_id", sa.String(36),
            sa.ForeignKey("grammar_books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chapter_num", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
    )
    op.create_index("idx_grammar_chapter_book", "grammar_chapters", ["book_id"])

    # 3. grammar_points
    op.create_table(
        "grammar_points",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "chapter_id", sa.String(36),
            sa.ForeignKey("grammar_chapters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("unit_num", sa.Integer(), nullable=False),
        sa.Column("point_num", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
    )
    op.create_index("idx_grammar_point_chapter", "grammar_points", ["chapter_id"])

    # 4. grammar_sentences
    op.create_table(
        "grammar_sentences",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "book_id", sa.String(36),
            sa.ForeignKey("grammar_books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chapter_id", sa.String(36),
            sa.ForeignKey("grammar_chapters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "point_id", sa.String(36),
            sa.ForeignKey("grammar_points.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sentence_num", sa.Integer(), nullable=False),
        sa.Column("sentence_en", sa.Text(), nullable=False),
        sa.Column("sentence_ko", sa.Text(), nullable=False),
        sa.Column("grammar_note", sa.String(200), nullable=True),
    )
    op.create_index("idx_grammar_sentence_book", "grammar_sentences", ["book_id"])
    op.create_index("idx_grammar_sentence_chapter", "grammar_sentences", ["chapter_id"])

    # 5. grammar_questions
    op.create_table(
        "grammar_questions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "book_id", sa.String(36),
            sa.ForeignKey("grammar_books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chapter_id", sa.String(36),
            sa.ForeignKey("grammar_chapters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question_type", sa.String(30), nullable=False),
        sa.Column("question_data", JSONB(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="pdf"),
        sa.Column("difficulty", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("point_refs", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_grammar_question_book", "grammar_questions", ["book_id"])
    op.create_index("idx_grammar_question_chapter", "grammar_questions", ["chapter_id"])
    op.create_index("idx_grammar_question_type", "grammar_questions", ["question_type"])

    # 6. grammar_configs
    op.create_table(
        "grammar_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "teacher_id", sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("book_ids", sa.String(200), nullable=True),
        sa.Column("chapter_ids", sa.String(500), nullable=True),
        sa.Column("question_count", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("time_limit_seconds", sa.Integer(), nullable=False, server_default="600"),
        sa.Column("per_question_seconds", sa.Integer(), nullable=True),
        sa.Column("time_mode", sa.String(20), nullable=False, server_default="per_question"),
        sa.Column("question_types", sa.String(300), nullable=True),
        sa.Column("question_type_counts", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_grammar_config_teacher", "grammar_configs", ["teacher_id"])

    # 7. grammar_sessions
    op.create_table(
        "grammar_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "student_id", sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "assignment_id", sa.String(36),
            sa.ForeignKey("test_assignments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "grammar_config_id", sa.String(36),
            sa.ForeignKey("grammar_configs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_grammar_session_student", "grammar_sessions", ["student_id"])
    op.create_index("idx_grammar_session_assignment", "grammar_sessions", ["assignment_id"])

    # 8. grammar_answers
    op.create_table(
        "grammar_answers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "grammar_session_id", sa.String(36),
            sa.ForeignKey("grammar_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "grammar_question_id", sa.String(36),
            sa.ForeignKey("grammar_questions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("question_order", sa.Integer(), nullable=False),
        sa.Column("question_type", sa.String(30), nullable=False),
        sa.Column("selected_answer", sa.Text(), nullable=True),
        sa.Column("correct_answer", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("time_taken_seconds", sa.Float(), nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_grammar_answer_session", "grammar_answers", ["grammar_session_id"])
    op.create_index("idx_grammar_answer_question", "grammar_answers", ["grammar_question_id"])

    # 9. Add grammar_config_id to test_assignments
    op.add_column(
        "test_assignments",
        sa.Column(
            "grammar_config_id", sa.String(36),
            sa.ForeignKey("grammar_configs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 10. Make test_config_id nullable (grammar assignments don't have a test_config)
    op.alter_column(
        "test_assignments",
        "test_config_id",
        existing_type=sa.String(36),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "test_assignments",
        "test_config_id",
        existing_type=sa.String(36),
        nullable=False,
    )
    op.drop_column("test_assignments", "grammar_config_id")
    op.drop_table("grammar_answers")
    op.drop_table("grammar_sessions")
    op.drop_table("grammar_configs")
    op.drop_table("grammar_questions")
    op.drop_table("grammar_sentences")
    op.drop_table("grammar_points")
    op.drop_table("grammar_chapters")
    op.drop_table("grammar_books")
