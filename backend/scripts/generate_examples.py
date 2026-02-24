"""Auto-generate example sentences using Gemini API and save to word_examples.

Usage:
    python -m scripts.generate_examples                     # 전체 생성
    python -m scripts.generate_examples --book "Power Voca 5000-01"  # 특정 책만
    python -m scripts.generate_examples --dry-run           # API 호출만, DB 저장 안함
    python -m scripts.generate_examples --resume            # 중단된 곳에서 이어서
    python -m scripts.generate_examples --per-word 2        # 단어당 예문 수 (기본 2)
"""
import asyncio
import json
import re
import sys
import time
import uuid
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google import genai
from google.genai import types

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.word import Word
from app.models.word_example import WordExample
from app.services.question_engines.sentence import make_sentence_blank

# ---------------------------------------------------------------------------
# Level guidelines
# ---------------------------------------------------------------------------
LEVEL_GUIDELINES = {
    1:  "초등 5~6학년. 5~8단어 짧은 문장. 기초 문법 (be동사, 현재형). 일상 주제",
    2:  "초등 6학년~중1. 6~10단어. 현재/과거형. 학교/가정 주제",
    3:  "중1. 8~12단어. 진행형, 조동사(can/will). 취미/여행 주제",
    4:  "중2. 8~12단어. 현재완료, 비교급. 사회/문화 주제",
    5:  "중3. 10~14단어. 관계대명사, 수동태. 과학/환경 주제",
    6:  "중3~고1. 10~15단어. 분사구문, 가정법. 시사/기술 주제",
    7:  "고1. 12~16단어. 복합문, 추상 개념. 경제/정치 주제",
    8:  "고2. 12~18단어. 학술적 어휘. 철학/심리 주제",
    9:  "고2~고3. 14~18단어. 수능 지문 수준. 과학논문/사설 주제",
    10: "고3. 14~20단어. 고난도 구문. 학술/전문 주제",
    11: "수능 기출. 15~20단어. 실제 수능 지문 스타일",
    12: "수능 기출 고난도. 수능 빈칸추론 수준",
    13: "수능 최상위. EBS 연계 수준",
    14: "수능 킬러문항 수준. 복합 구문",
    15: "최고난도. 대학 교양 수준 학술 문장",
}

PROGRESS_FILE = Path(__file__).resolve().parent / "generate_progress.json"

# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def build_prompt(
    words: list[dict],
    level: int,
    per_word: int = 2,
) -> str:
    """Build a Gemini prompt for a batch of words."""
    guideline = LEVEL_GUIDELINES.get(level, LEVEL_GUIDELINES[8])

    word_lines = []
    for i, w in enumerate(words, 1):
        pos = f" [{w['part_of_speech']}]" if w.get("part_of_speech") else ""
        existing = ""
        if w.get("existing_examples"):
            ex_list = "; ".join(f'"{e}"' for e in w["existing_examples"])
            existing = f" — 기존 예문: {ex_list}"
        word_lines.append(
            f'{i}. {w["english"]} ({w["korean"]}){pos}{existing}'
        )

    words_text = "\n".join(word_lines)

    return f"""당신은 영어 교육 전문가입니다. 아래 단어에 대해 예문 {per_word}개씩 생성해주세요.

## 난이도 기준
레벨 {level}: {guideline}

## 규칙
1. 예문에 반드시 영어 단어 원형이 그대로 포함되어야 합니다 (활용형 X, 원형 그대로)
2. 기존 예문과 다른 맥락/상황의 문장을 만들어주세요
3. 한국어 번역은 자연스러운 의역으로
4. JSON 배열로만 출력 (다른 텍스트 없이)

## 단어 목록
{words_text}

## 출력 형식
[{{"english":"단어","examples":[{{"example_en":"영어 예문","example_ko":"한국어 번역"}}]}}]"""


# ---------------------------------------------------------------------------
# Gemini API call with retry
# ---------------------------------------------------------------------------

def create_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY is not set in .env")
        sys.exit(1)
    import httpx
    http_options = types.HttpOptions(timeout=60_000)  # 60 seconds
    return genai.Client(api_key=settings.GEMINI_API_KEY, http_options=http_options)


def call_gemini(client: genai.Client, prompt: str, max_retries: int = 3) -> str | None:
    """Call Gemini API with exponential backoff on rate limit errors."""
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.8,
                    response_mime_type="application/json",
                    max_output_tokens=8192,
                ),
            )
            return response.text
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                wait = 2 ** (attempt + 1)
                print(f"  Rate limited, waiting {wait}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait)
            else:
                print(f"  API error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                else:
                    return None
    return None


def parse_json_response(text: str) -> list[dict] | None:
    """Parse Gemini JSON response, handling markdown code fences."""
    if not text:
        return None
    # Strip markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", text.strip())
    cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    return None


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def normalize_sentence(s: str) -> str:
    """Normalize sentence for duplicate comparison."""
    return re.sub(r"[^\w\s]", "", s.lower()).strip()


def validate_examples(
    generated: list[dict],
    word_map: dict[str, dict],
    existing_set: set[str],
) -> list[dict]:
    """Validate generated examples and return only valid ones.

    Returns list of {"word_id", "english", "example_en", "example_ko"} dicts.
    """
    valid = []
    for entry in generated:
        english = entry.get("english", "").strip()
        info = word_map.get(english.lower())
        if not info:
            print(f"    SKIP: unknown word '{english}'")
            continue

        for ex in entry.get("examples", []):
            ex_en = ex.get("example_en", "").strip()
            ex_ko = ex.get("example_ko", "").strip()
            if not ex_en or not ex_ko:
                continue

            # Check make_sentence_blank passes
            blank = make_sentence_blank(ex_en, english)
            if blank is None:
                print(f"    SKIP (no blank): '{english}' in \"{ex_en}\"")
                continue

            # Check duplicate (normalized)
            norm_key = f"{info['word_id']}:{normalize_sentence(ex_en)}"
            if norm_key in existing_set:
                print(f"    SKIP (dup): \"{ex_en}\"")
                continue

            existing_set.add(norm_key)
            valid.append({
                "word_id": info["word_id"],
                "english": english,
                "example_en": ex_en,
                "example_ko": ex_ko,
            })
    return valid


# ---------------------------------------------------------------------------
# Progress tracking
# ---------------------------------------------------------------------------

def load_progress() -> set[str]:
    """Load set of completed lesson keys from progress file."""
    if PROGRESS_FILE.exists():
        data = json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        return set(data.get("completed", []))
    return set()


def save_progress(completed: set[str]):
    """Save completed lesson keys to progress file."""
    PROGRESS_FILE.write_text(
        json.dumps({"completed": sorted(completed)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def generate_examples(
    book_name: str | None = None,
    dry_run: bool = False,
    resume: bool = False,
    per_word: int = 2,
):
    # DB connection with statement_cache_size=0 for Supabase pooler
    db_url = settings.DATABASE_URL
    connect_args = {}
    if "supabase" in db_url or "pooler" in db_url:
        connect_args["statement_cache_size"] = 0

    engine = create_async_engine(db_url, connect_args=connect_args)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        # Load words
        query = select(Word).where(Word.is_excluded == False)
        if book_name:
            query = query.where(Word.book_name == book_name)
        query = query.order_by(Word.book_name, Word.lesson, Word.english)

        result = await db.execute(query)
        words = result.scalars().all()

        if not words:
            print("No words found.")
            await engine.dispose()
            return

        # Load existing examples for duplicate check
        existing_result = await db.execute(select(WordExample))
        existing_examples = existing_result.scalars().all()
        existing_set: set[str] = set()
        existing_by_word: dict[str, list[str]] = {}
        for ex in existing_examples:
            existing_set.add(f"{ex.word_id}:{normalize_sentence(ex.example_en)}")
            existing_by_word.setdefault(ex.word_id, []).append(ex.example_en)

        # Also include legacy example_en in existing examples
        for w in words:
            if w.example_en:
                existing_set.add(f"{w.id}:{normalize_sentence(w.example_en)}")
                existing_by_word.setdefault(w.id, []).append(w.example_en)

        # Group words by (book_name, lesson)
        lessons: dict[str, list[Word]] = {}
        for w in words:
            key = f"{w.book_name}|{w.lesson}"
            lessons.setdefault(key, []).append(w)

        print(f"Total: {len(words)} words in {len(lessons)} lessons")

        # Progress tracking
        completed = load_progress() if resume else set()
        if resume and completed:
            print(f"Resuming: {len(completed)} lessons already done")

        client = create_client()

        stats = {"api_calls": 0, "generated": 0, "validated": 0, "saved": 0, "failed_parse": 0}
        total_lessons = len(lessons)

        for idx, (lesson_key, lesson_words) in enumerate(lessons.items(), 1):
            if lesson_key in completed:
                continue

            book, lesson = lesson_key.split("|", 1)
            # Determine level from first word in the lesson
            level = lesson_words[0].level if lesson_words else 5

            # Build word info for prompt
            word_infos = []
            word_map: dict[str, dict] = {}
            for w in lesson_words:
                info = {
                    "english": w.english,
                    "korean": w.korean,
                    "part_of_speech": w.part_of_speech,
                    "word_id": w.id,
                    "existing_examples": existing_by_word.get(w.id, []),
                }
                word_infos.append(info)
                word_map[w.english.lower()] = info

            print(f"\n[{idx}/{total_lessons}] {book} / {lesson} ({len(lesson_words)} words, level {level})")

            # Split large lessons into batches of MAX_BATCH words
            MAX_BATCH = 25
            batches = [word_infos[i:i + MAX_BATCH] for i in range(0, len(word_infos), MAX_BATCH)]

            all_parsed: list[dict] = []
            batch_ok = True
            for bi, batch in enumerate(batches):
                if len(batches) > 1:
                    print(f"  Batch {bi + 1}/{len(batches)} ({len(batch)} words)")

                prompt = build_prompt(batch, level, per_word)

                # Call Gemini API
                raw = call_gemini(client, prompt)
                stats["api_calls"] += 1

                if raw is None:
                    print("  ERROR: API call failed")
                    batch_ok = False
                    continue

                # Parse JSON
                parsed = parse_json_response(raw)
                if parsed is None:
                    stats["failed_parse"] += 1
                    print("  ERROR: Failed to parse JSON, retrying...")
                    raw = call_gemini(client, prompt)
                    stats["api_calls"] += 1
                    if raw:
                        parsed = parse_json_response(raw)
                    if parsed is None:
                        print("  ERROR: Retry failed")
                        batch_ok = False
                        continue

                all_parsed.extend(parsed)
                if len(batches) > 1:
                    time.sleep(0.3)

            if not all_parsed:
                print("  ERROR: All batches failed, skipping lesson")
                continue

            stats["generated"] += sum(len(e.get("examples", [])) for e in all_parsed)

            # Validate
            valid = validate_examples(all_parsed, word_map, existing_set)
            stats["validated"] += len(valid)

            print(f"  Generated {sum(len(e.get('examples', [])) for e in all_parsed)}, validated {len(valid)}")

            # Save to DB
            if valid and not dry_run:
                # Get current max order_index per word
                word_ids = list({v["word_id"] for v in valid})
                max_idx_result = await db.execute(
                    select(
                        WordExample.word_id,
                        func.max(WordExample.order_index).label("max_idx"),
                    )
                    .where(WordExample.word_id.in_(word_ids))
                    .group_by(WordExample.word_id)
                )
                max_indices = {row.word_id: row.max_idx for row in max_idx_result}

                for v in valid:
                    wid = v["word_id"]
                    next_idx = (max_indices.get(wid) or 0) + 1
                    max_indices[wid] = next_idx

                    new_example = WordExample(
                        id=str(uuid.uuid4()),
                        word_id=wid,
                        example_en=v["example_en"],
                        example_ko=v["example_ko"],
                        order_index=next_idx,
                    )
                    db.add(new_example)

                await db.commit()
                stats["saved"] += len(valid)

            completed.add(lesson_key)
            save_progress(completed)

            # Brief pause between API calls to respect rate limits
            time.sleep(0.5)

    await engine.dispose()

    # Print summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"  API calls: {stats['api_calls']}")
    print(f"  Examples generated: {stats['generated']}")
    print(f"  Validated (blank check + dedup): {stats['validated']}")
    print(f"  Saved to DB: {stats['saved']}")
    print(f"  Failed parses: {stats['failed_parse']}")
    if dry_run:
        print("  (DRY RUN — no changes saved)")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate example sentences via Gemini API")
    parser.add_argument("--book", type=str, default=None, help="Filter by book name")
    parser.add_argument("--dry-run", action="store_true", help="API call only, no DB save")
    parser.add_argument("--resume", action="store_true", help="Resume from last progress")
    parser.add_argument("--per-word", type=int, default=2, help="Examples per word (default: 2)")
    args = parser.parse_args()

    asyncio.run(generate_examples(args.book, args.dry_run, args.resume, args.per_word))
