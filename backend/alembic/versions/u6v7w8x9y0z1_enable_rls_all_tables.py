"""Enable RLS on all public tables for Supabase security.

Revision ID: u6v7w8x9y0z1
Revises: t5u6v7w8x9y0
Create Date: 2026-03-04
"""
from alembic import op

revision = "u6v7w8x9y0z1"
down_revision = "t5u6v7w8x9y0"
branch_labels = None
depends_on = None

# All application tables
TABLES = [
    "users",
    "auth_tokens",
    "words",
    "word_examples",
    "word_mastery",
    "test_configs",
    "test_assignments",
    "test_sessions",
    "test_answers",
    "tts_cache",
    "learning_sessions",
    "learning_answers",
    "grammar_books",
    "grammar_chapters",
    "grammar_points",
    "grammar_sentences",
    "grammar_questions",
    "grammar_configs",
    "grammar_sessions",
    "grammar_answers",
    "alembic_version",
]


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        # Allow the postgres role (backend direct connection) full access
        op.execute(
            f"CREATE POLICY {table}_backend_full ON {table} "
            f"FOR ALL TO postgres USING (true) WITH CHECK (true)"
        )


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"DROP POLICY IF EXISTS {table}_backend_full ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
