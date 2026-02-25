"""Auto-generate antonym mappings using Gemini API and save to words.antonym.

Finds antonym pairs among existing words in the DB using Gemini,
then writes bidirectional links (A->B and B->A) when both words exist
and their levels are within +/-2 of each other.

v2: Send entire level group at once (not 100-word batches) for much better coverage.
    Overlapping groups (1-3, 2-4, 3-5, ...) to catch boundary pairs.

Usage:
    python -m scripts.generate_antonyms                          # 전체 생성
    python -m scripts.generate_antonyms --book "POWER VOCA 5000-01"
    python -m scripts.generate_antonyms --level-range 1 5
    python -m scripts.generate_antonyms --dry-run
    python -m scripts.generate_antonyms --resume
"""
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google import genai
from google.genai import types

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.word import Word

PROGRESS_FILE = Path(__file__).resolve().parent / "antonym_progress.json"
MAX_LEVEL_DIFF = 2


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def build_prompt(words: list[dict]) -> str:
    """Build a Gemini prompt for finding antonym pairs within a word list."""
    word_lines = []
    for w in words:
        word_lines.append(f'- {w["english"]} ({w["korean"]})')
    words_text = "\n".join(word_lines)

    return f"""You are an English vocabulary expert. Find all antonym pairs from the word list below.

## Rules
1. ONLY use words from the list below. Never invent words not in the list.
2. Each word can have at most 1 antonym.
3. Only include clear, direct antonyms (e.g., hot<->cold, big<->small, buy<->sell).
4. Do NOT include synonyms, related words, or loose associations.
5. Skip words that have no clear antonym in the list.
6. Be thorough - find ALL valid antonym pairs. Check every word.

## Word list ({len(words)} words)
{words_text}

## Output format
Return a JSON array. Each item: {{"word1": "english1", "word2": "english2"}}
Return empty array [] if no pairs found.

Example:
[
  {{"word1": "hot", "word2": "cold"}},
  {{"word1": "buy", "word2": "sell"}}
]"""


# ---------------------------------------------------------------------------
# Gemini API
# ---------------------------------------------------------------------------

def call_gemini(client: genai.Client, prompt: str) -> list[dict]:
    """Call Gemini API and parse the response as JSON."""
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    text = response.text.strip()
    return json.loads(text)


# ---------------------------------------------------------------------------
# Progress tracking
# ---------------------------------------------------------------------------

def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    return {"completed_groups": [], "found_pairs": {}}


def save_progress(progress: dict) -> None:
    PROGRESS_FILE.write_text(
        json.dumps(progress, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Main logic
# ---------------------------------------------------------------------------

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate antonym mappings via Gemini")
    parser.add_argument("--dry-run", action="store_true", help="API only, no DB writes")
    parser.add_argument("--resume", action="store_true", help="Resume from progress file")
    parser.add_argument("--book", type=str, help="Process specific book only")
    parser.add_argument("--level-range", type=int, nargs=2, metavar=("MIN", "MAX"),
                        help="Level range (e.g., 1 5)")
    args = parser.parse_args()

    # DB setup
    db_url = settings.DATABASE_URL
    if "postgresql://" in db_url and "postgresql+asyncpg://" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    connect_args = {}
    if "supabase" in db_url:
        connect_args["statement_cache_size"] = 0

    db_engine = create_async_engine(
        db_url, echo=False, connect_args=connect_args,
        pool_recycle=120,
    )
    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    # Gemini client
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # Load progress
    progress = load_progress() if args.resume else {"completed_groups": [], "found_pairs": {}}

    # First, clear all existing antonyms (fresh start unless resume)
    if not args.resume and not args.dry_run:
        async with async_session() as db:
            await db.execute(update(Word).values(antonym=None))
            await db.commit()
        print("[RESET] Cleared all existing antonyms")

    # Fetch all words (short-lived session)
    async with async_session() as db:
        query = select(Word).where(Word.is_excluded == False)
        if args.book:
            query = query.where(Word.book_name == args.book)
        if args.level_range:
            query = query.where(
                Word.level >= args.level_range[0],
                Word.level <= args.level_range[1],
            )
        query = query.order_by(Word.level.asc(), Word.book_name.asc())

        result = await db.execute(query)
        all_words = list(result.scalars().all())

    if not all_words:
        print("No words found matching criteria.")
        await db_engine.dispose()
        return

    # Build lookup maps (detached from session)
    word_by_english: dict[str, dict] = {}
    for w in all_words:
        key = w.english.lower().strip()
        if key not in word_by_english:
            word_by_english[key] = {"id": w.id, "english": w.english, "korean": w.korean, "level": w.level}

    # Build overlapping groups: (1-3), (2-4), (3-5), ... for boundary coverage
    level_min = min(w.level for w in all_words)
    level_max = max(w.level for w in all_words)

    groups: list[tuple[int, int]] = []
    for start in range(level_min, level_max + 1):
        end = min(start + 2, level_max)
        if start <= level_max:
            groups.append((start, end))

    # Deduplicate groups
    groups = list(dict.fromkeys(groups))

    print(f"Total words: {len(all_words)}, Level range: {level_min}-{level_max}, Groups: {len(groups)}")

    # Collect all pairs globally (to handle dedup across groups)
    all_pairs: dict[str, str] = dict(progress.get("found_pairs", {}))
    new_pairs_count = 0

    for start_lvl, end_lvl in groups:
        group_key = f"lv{start_lvl}-{end_lvl}"
        if group_key in progress["completed_groups"]:
            print(f"  [skip] {group_key} (already completed)")
            continue

        # Get all words in this level range
        group_words = []
        seen_ids = set()
        for key, wd in word_by_english.items():
            if start_lvl <= wd["level"] <= end_lvl and wd["id"] not in seen_ids:
                group_words.append(wd)
                seen_ids.add(wd["id"])

        if not group_words:
            progress["completed_groups"].append(group_key)
            save_progress(progress)
            continue

        word_dicts = [
            {"english": w["english"], "korean": w["korean"], "level": w["level"]}
            for w in group_words
        ]

        try:
            print(f"  [{group_key}] Sending {len(group_words)} words to Gemini...", end=" ", flush=True)
            pairs = call_gemini(client, build_prompt(word_dicts))
            print(f"-> {len(pairs)} pairs found")
        except Exception as e:
            print(f"  [ERROR] {group_key}: {e}")
            progress["completed_groups"].append(group_key)
            save_progress(progress)
            time.sleep(2)
            continue

        # Validate and collect pairs
        group_new = 0
        for pair in pairs:
            w1_key = pair.get("word1", "").lower().strip()
            w2_key = pair.get("word2", "").lower().strip()

            if not w1_key or not w2_key or w1_key == w2_key:
                continue

            w1 = word_by_english.get(w1_key)
            w2 = word_by_english.get(w2_key)

            if not w1 or not w2:
                continue

            # Check level difference
            if abs(w1["level"] - w2["level"]) > MAX_LEVEL_DIFF:
                print(f"    [skip] {w1_key}<->{w2_key}: level diff {abs(w1['level'] - w2['level'])} > {MAX_LEVEL_DIFF}")
                continue

            # Skip if either word already has an antonym (from a previous group)
            if w1_key in all_pairs or w2_key in all_pairs:
                continue

            all_pairs[w1_key] = w2_key
            all_pairs[w2_key] = w1_key
            group_new += 1
            new_pairs_count += 1

            if args.dry_run:
                print(f"    {w1['english']} (lv{w1['level']}) <-> {w2['english']} (lv{w2['level']})")

        if group_new > 0:
            print(f"    +{group_new} new pairs (total: {new_pairs_count})")

        progress["completed_groups"].append(group_key)
        progress["found_pairs"] = all_pairs
        save_progress(progress)

        # Rate limiting
        time.sleep(1)

    # Write all pairs to DB at once (fresh session per batch)
    if not args.dry_run and all_pairs:
        print(f"\nWriting {len(all_pairs)} antonym links to DB...")
        updates = []
        for eng_key, antonym_key in all_pairs.items():
            w = word_by_english.get(eng_key)
            ant = word_by_english.get(antonym_key)
            if w and ant:
                updates.append((w["id"], ant["english"]))

        # Write in chunks of 50 to avoid timeout
        chunk_size = 50
        for i in range(0, len(updates), chunk_size):
            chunk = updates[i:i + chunk_size]
            async with async_session() as db:
                for word_id, antonym_val in chunk:
                    await db.execute(
                        update(Word).where(Word.id == word_id).values(antonym=antonym_val)
                    )
                await db.commit()
            print(f"  Written {min(i + chunk_size, len(updates))}/{len(updates)}")

        print(f"\nDone! {new_pairs_count} pairs found, {len(updates)} words linked.")
    elif args.dry_run:
        print(f"\n[dry-run] {new_pairs_count} pairs found (no DB changes).")
    else:
        print("\nNo pairs found.")

    await db_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
