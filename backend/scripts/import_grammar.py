"""Import grammar books, chapters, and sample questions into the database.

Usage:
    cd backend
    python -m scripts.import_grammar            # seed books + chapters
    python -m scripts.import_grammar --samples   # + seed sample questions
    python -m scripts.import_grammar --from-json grammar_questions.json  # from parsed JSON
"""
import asyncio
import json
import uuid
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import AsyncSessionLocal

# ── Book/Chapter metadata (hardcoded from PDF TOC) ──────────────────────

BOOKS = [
    {"level": 1, "title": "천일문 GRAMMAR Level 1"},
    {"level": 2, "title": "천일문 GRAMMAR Level 2"},
    {"level": 3, "title": "천일문 GRAMMAR Level 3"},
]

CHAPTERS = {
    1: [
        (1, "be동사"), (2, "일반동사"), (3, "현재진행형과 미래 표현"),
        (4, "조동사"), (5, "명사와 관사"), (6, "대명사"),
        (7, "형용사, 부사, 비교"), (8, "여러 가지 문장 종류"),
        (9, "문장의 여러 형식"), (10, "to부정사와 동명사"),
        (11, "전치사"), (12, "접속사"),
    ],
    2: [
        (1, "문장의 주요 형식"), (2, "시제"), (3, "조동사"),
        (4, "수동태"), (5, "to부정사"), (6, "동명사"),
        (7, "분사"), (8, "대명사"), (9, "형용사와 부사"),
        (10, "비교 표현"), (11, "접속사"), (12, "관계대명사"),
    ],
    3: [
        (1, "완료 시제"), (2, "조동사"), (3, "수동태"),
        (4, "부정사"), (5, "동명사"), (6, "분사"),
        (7, "비교 표현"), (8, "접속사"), (9, "관계사"),
        (10, "가정법"), (11, "일치와 화법"), (12, "특수 구문"),
    ],
}

# ── Sample questions for testing (Level 1, Chapter 1) ───────────────────

SAMPLE_QUESTIONS = [
    # grammar_blank: 빈칸 5지선다
    {
        "question_type": "grammar_blank",
        "question_data": {
            "stem": "Jisu ___ in the bathroom now.",
            "choices": ["is", "am", "are", "was", "were"],
            "correct_index": 0,
            "sentence_ko": "지수는 지금 화장실에 있다.",
            "grammar_point": "주어에 따른 be동사 현재형"
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_blank",
        "question_data": {
            "stem": "Yesterday, I ___ at home all day.",
            "choices": ["am not", "amn't", "isn't", "wasn't", "weren't"],
            "correct_index": 3,
            "sentence_ko": "어제 나는 하루 종일 집에 없었다.",
            "grammar_point": "be동사 과거형 부정"
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_blank",
        "question_data": {
            "stem": "___ you and Lucy at the park last Saturday?",
            "choices": ["Is", "Am", "Are", "Was", "Were"],
            "correct_index": 4,
            "sentence_ko": "너와 Lucy는 지난 토요일에 공원에 있었니?",
            "grammar_point": "be동사 과거형 의문문"
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    # grammar_error: 어법상 알맞지 않은 문장
    {
        "question_type": "grammar_error",
        "question_data": {
            "prompt": "다음 중 어법상 알맞지 않은 문장을 고르세요.",
            "sentences": [
                "We're in the shopping mall now.",
                "I am not a high school student.",
                "My favorite sport is swimming.",
                "Tony and I am neighbors.",
                "She's not in the kitchen."
            ],
            "correct_indices": [3],
            "invert": False,
            "select_count": 1
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_error",
        "question_data": {
            "prompt": "다음 중 어법상 알맞은 문장 두 개를 고르세요.",
            "sentences": [
                "This camera isn't expensive.",
                "A: Are you a new teacher? B: Yes, you are.",
                "His shoes were dirty and old.",
                "Are your bag heavy?",
                "Was your parents at the theater last night?"
            ],
            "correct_indices": [0, 2],
            "invert": True,
            "select_count": 2
        },
        "level": 1, "chapter_num": 1, "difficulty": 3,
    },
    # grammar_common: 공통으로 들어갈 말
    {
        "question_type": "grammar_common",
        "question_data": {
            "sentences": [
                "My sister ___ sick yesterday.",
                "He ___ a little boy 10 years ago.",
                "The musical ___ great yesterday.",
                "I ___ an elementary student last year."
            ],
            "prompt": "다음 중 빈칸에 들어갈 단어가 나머지와 다른 하나를 고르세요.",
            "choices": ["was", "was", "was", "was", "were"],
            "correct_index": 4,
            "different_sentences": [
                "They ___ in Busan last month."
            ]
        },
        "level": 1, "chapter_num": 1, "difficulty": 2,
    },
    # grammar_usage: 밑줄 친 부분의 의미/쓰임 구별
    {
        "question_type": "grammar_usage",
        "question_data": {
            "prompt": "다음 밑줄 친 be동사의 의미가 나머지와 다른 하나를 고르세요.",
            "sentences": [
                "You are not a pilot.",
                "They are in this building.",
                "Ms. Han is my English teacher.",
                "Curry is my favorite food.",
                "Steve is my new classmate."
            ],
            "correct_index": 1,
            "underlined_word": "be동사"
        },
        "level": 1, "chapter_num": 1, "difficulty": 2,
    },
    # grammar_transform: 문장 전환
    {
        "question_type": "grammar_transform",
        "question_data": {
            "original": "Bill and Ted are very brave.",
            "instruction": "부정문으로 바꿔 쓰세요.",
            "correct_answer": "Bill and Ted are not very brave.",
            "acceptable_answers": [
                "Bill and Ted aren't very brave."
            ]
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_transform",
        "question_data": {
            "original": "James was absent from school yesterday.",
            "instruction": "의문문으로 바꿔 쓰세요.",
            "correct_answer": "Was James absent from school yesterday?",
            "acceptable_answers": []
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    # grammar_pair: (A)(B) 짝짓기
    {
        "question_type": "grammar_pair",
        "question_data": {
            "stem": "Your sister looks (A) when she plays with her puppy. Rules and laws will keep us (B).",
            "paired_choices": [
                ["happy", "safe"],
                ["happy", "safely"],
                ["happily", "safe"],
                ["happily", "safely"],
                ["happiness", "safe"]
            ],
            "correct_index": 0
        },
        "level": 2, "chapter_num": 1, "difficulty": 2,
    },
    # grammar_order: 단어 배열
    {
        "question_type": "grammar_order",
        "question_data": {
            "words": ["Hanbok", "my Chinese friends", "showed", "to", "I"],
            "correct_answer": "I showed Hanbok to my Chinese friends.",
            "sentence_ko": "나는 나의 중국인 친구들에게 한복을 보여 주었다."
        },
        "level": 2, "chapter_num": 1, "difficulty": 2,
    },
    # grammar_translate: 영작
    {
        "question_type": "grammar_translate",
        "question_data": {
            "sentence_ko": "그 배우는 매우 유명하다.",
            "correct_answer": "The actor is very famous.",
            "acceptable_answers": [
                "The actor is really famous."
            ],
            "hint_words": ["actor", "famous"]
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
]


async def seed_books_and_chapters():
    """Insert grammar_books and grammar_chapters (idempotent)."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT COUNT(*) FROM grammar_books")
        )
        count = result.scalar()
        if count > 0:
            print(f"grammar_books already has {count} rows, skipping book/chapter seed.")
            return

        book_ids = {}
        for book in BOOKS:
            book_id = str(uuid.uuid4())
            book_ids[book["level"]] = book_id
            await session.execute(
                text(
                    "INSERT INTO grammar_books (id, title, level, created_at) "
                    "VALUES (:id, :title, :level, NOW())"
                ),
                {"id": book_id, "title": book["title"], "level": book["level"]},
            )
            print(f"  Book: {book['title']} -> {book_id}")

        for level, chapters in CHAPTERS.items():
            for ch_num, ch_title in chapters:
                ch_id = str(uuid.uuid4())
                await session.execute(
                    text(
                        "INSERT INTO grammar_chapters (id, book_id, chapter_num, title) "
                        "VALUES (:id, :book_id, :ch_num, :title)"
                    ),
                    {
                        "id": ch_id,
                        "book_id": book_ids[level],
                        "ch_num": ch_num,
                        "title": ch_title,
                    },
                )
            print(f"  Level {level}: {len(chapters)} chapters inserted")

        await session.commit()
        print(f"Seeded {len(BOOKS)} books, {sum(len(c) for c in CHAPTERS.values())} chapters.")


async def _get_book_chapter_ids(session):
    """Get mapping of (level, chapter_num) -> (book_id, chapter_id)."""
    result = await session.execute(
        text(
            "SELECT b.level, c.chapter_num, b.id AS book_id, c.id AS chapter_id "
            "FROM grammar_books b JOIN grammar_chapters c ON c.book_id = b.id"
        )
    )
    mapping = {}
    for row in result:
        mapping[(row.level, row.chapter_num)] = (row.book_id, row.chapter_id)
    return mapping


async def seed_sample_questions():
    """Insert sample questions for testing (idempotent)."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text("SELECT COUNT(*) FROM grammar_questions WHERE source = 'sample'")
        )
        if result.scalar() > 0:
            print("Sample questions already exist, skipping.")
            return

        mapping = await _get_book_chapter_ids(session)
        if not mapping:
            print("ERROR: No books/chapters found. Run seed_books_and_chapters first.")
            return

        count = 0
        now = datetime.now(timezone.utc).isoformat()
        for q in SAMPLE_QUESTIONS:
            key = (q["level"], q["chapter_num"])
            if key not in mapping:
                print(f"  WARNING: No chapter for level={q['level']} ch={q['chapter_num']}")
                continue
            book_id, chapter_id = mapping[key]
            await session.execute(
                text(
                    "INSERT INTO grammar_questions "
                    "(id, book_id, chapter_id, question_type, question_data, "
                    "source, difficulty, created_at) "
                    "VALUES (:id, :book_id, :chapter_id, :qtype, :qdata, "
                    "'sample', :diff, :now)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "book_id": book_id,
                    "chapter_id": chapter_id,
                    "qtype": q["question_type"],
                    "qdata": json.dumps(q["question_data"], ensure_ascii=False),
                    "diff": q.get("difficulty", 1),
                    "now": now,
                },
            )
            count += 1

        await session.commit()
        print(f"Seeded {count} sample questions.")


async def import_from_json(json_path: str):
    """Import questions from a parsed JSON file."""
    with open(json_path, "r", encoding="utf-8") as f:
        questions = json.load(f)

    async with AsyncSessionLocal() as session:
        mapping = await _get_book_chapter_ids(session)
        if not mapping:
            print("ERROR: No books/chapters found.")
            return

        count = 0
        now = datetime.now(timezone.utc).isoformat()
        for q in questions:
            key = (q["level"], q["chapter_num"])
            if key not in mapping:
                continue
            book_id, chapter_id = mapping[key]
            # Deduplicate by checking existing
            result = await session.execute(
                text(
                    "SELECT COUNT(*) FROM grammar_questions "
                    "WHERE chapter_id = :cid AND question_type = :qtype "
                    "AND question_data::text = :qdata"
                ),
                {
                    "cid": chapter_id,
                    "qtype": q["question_type"],
                    "qdata": json.dumps(q["question_data"], ensure_ascii=False),
                },
            )
            if result.scalar() > 0:
                continue

            await session.execute(
                text(
                    "INSERT INTO grammar_questions "
                    "(id, book_id, chapter_id, question_type, question_data, "
                    "source, difficulty, created_at) "
                    "VALUES (:id, :book_id, :chapter_id, :qtype, :qdata, "
                    ":source, :diff, :now)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "book_id": book_id,
                    "chapter_id": chapter_id,
                    "qtype": q["question_type"],
                    "qdata": json.dumps(q["question_data"], ensure_ascii=False),
                    "source": q.get("source", "pdf"),
                    "diff": q.get("difficulty", 1),
                    "now": now,
                },
            )
            count += 1

        await session.commit()
        print(f"Imported {count} questions from {json_path}.")


async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", action="store_true", help="Seed sample questions")
    parser.add_argument("--from-json", type=str, help="Import from parsed JSON file")
    args = parser.parse_args()

    print("=== Grammar Data Import ===")
    await seed_books_and_chapters()

    if args.samples:
        await seed_sample_questions()

    if args.from_json:
        await import_from_json(args.from_json)

    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
