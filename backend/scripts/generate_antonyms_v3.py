"""Generate antonyms for words that don't have one yet (v3).

- Only processes words where antonym IS NULL
- Generates level-appropriate antonyms (not restricted to DB words)
- Skips ambiguous/concrete nouns unlikely to have antonyms
- Groups by book for consistent difficulty

Usage:
    python -m scripts.generate_antonyms_v3                          # 전체
    python -m scripts.generate_antonyms_v3 --book "POWER VOCA 5000-01"
    python -m scripts.generate_antonyms_v3 --dry-run
    python -m scripts.generate_antonyms_v3 --resume
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

PROGRESS_FILE = Path(__file__).resolve().parent / "antonym_v3_progress.json"

LEVEL_GUIDELINES = {
    1: "Elementary 5-6th grade vocabulary",
    2: "Elementary 6th ~ Middle 1st grade",
    3: "Middle school 1st grade",
    4: "Middle school 2nd grade",
    5: "Middle school 3rd grade",
    6: "Middle 3rd ~ High 1st grade",
    7: "High school 1st grade",
    8: "High school 2nd grade",
    9: "High school 2nd~3rd grade",
    10: "High school 3rd grade",
    11: "CSAT prep level 1",
    12: "CSAT prep level 2",
    13: "CSAT advanced level",
    14: "CSAT expert level",
    15: "University-level academic",
}


def build_prompt(words: list[dict], book_name: str, level: int) -> str:
    guideline = LEVEL_GUIDELINES.get(level, "intermediate level")

    word_lines = []
    for w in words:
        pos = f" [{w['pos']}]" if w.get("pos") else ""
        word_lines.append(f'- {w["english"]}{pos} ({w["korean"]})')
    words_text = "\n".join(word_lines)

    return f"""You are an English vocabulary expert for Korean students.
For each word below, provide ONE clear antonym if it exists.

## Rules
1. The antonym must be a SINGLE English word or simple phrase.
2. The antonym difficulty should match the student level: {guideline} (Level {level}).
   - For Level 1-3: use simple antonyms (e.g., hot->cold, big->small)
   - For Level 7+: more advanced antonyms are OK (e.g., abundant->scarce)
3. SKIP words that do NOT have a clear, direct antonym. These include:
   - Concrete nouns: food (lunch, breakfast), animals (dog, cat), objects (table, book), places (school, park)
   - People/roles: teacher, doctor, friend (unless there's a clear opposite like king/queen)
   - Actions without clear opposites: eat, study, play, travel
   - Abstract nouns without opposites: idea, culture, history, music
   - Adjectives/adverbs that are neutral: yellow, round, daily
4. ONLY return antonyms for words with CLEAR opposites:
   - Adjectives: hot/cold, big/small, happy/sad, rich/poor
   - Verbs: buy/sell, open/close, arrive/depart, increase/decrease
   - Adverbs: always/never, quickly/slowly, often/rarely
   - Some nouns: success/failure, peace/war, beginning/end
5. Return EXACTLY the format specified. Do not add words not in the list.

## Book: {book_name}
## Words ({len(words)} words)
{words_text}

## Output format
JSON object mapping each word to its antonym, or null if no clear antonym exists.
Example:
{{
  "hot": "cold",
  "big": "small",
  "lunch": null,
  "dog": null,
  "always": "never"
}}"""


def call_gemini(client: genai.Client, prompt: str) -> dict:
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


def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
    return {"completed_books": [], "stats": {"processed": 0, "assigned": 0, "skipped": 0}}


def save_progress(progress: dict) -> None:
    PROGRESS_FILE.write_text(
        json.dumps(progress, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate antonyms v3 - fill missing")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--book", type=str, help="Process specific book only")
    args = parser.parse_args()

    db_url = settings.DATABASE_URL
    if "postgresql://" in db_url and "postgresql+asyncpg://" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    connect_args = {}
    if "supabase" in db_url:
        connect_args["statement_cache_size"] = 0

    db_engine = create_async_engine(
        db_url, echo=False, connect_args=connect_args, pool_recycle=120,
    )
    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    progress = load_progress() if args.resume else {"completed_books": [], "stats": {"processed": 0, "assigned": 0, "skipped": 0}}

    # Fetch words without antonyms
    async with async_session() as db:
        query = select(Word).where(
            Word.is_excluded == False,
            Word.antonym == None,
        )
        if args.book:
            query = query.where(Word.book_name == args.book)
        query = query.order_by(Word.book_name.asc(), Word.level.asc(), Word.lesson.asc())

        result = await db.execute(query)
        all_words = list(result.scalars().all())

    if not all_words:
        print("No words without antonyms found.")
        await db_engine.dispose()
        return

    # Group by book + level
    groups: dict[tuple[str, int], list] = {}
    for w in all_words:
        key = (w.book_name, w.level)
        if key not in groups:
            groups[key] = []
        groups[key].append({
            "id": w.id, "english": w.english, "korean": w.korean,
            "level": w.level, "pos": w.part_of_speech,
        })

    total_words = len(all_words)
    total_assigned = progress["stats"]["assigned"]
    total_skipped = progress["stats"]["skipped"]
    total_processed = progress["stats"]["processed"]

    print(f"Words without antonym: {total_words}")
    print(f"Groups (book x level): {len(groups)}")

    for (book_name, level), words in groups.items():
        group_key = f"{book_name}|lv{level}"
        if group_key in progress["completed_books"]:
            print(f"  [skip] {group_key} (already done)")
            continue

        # Process in batches of 200 (Gemini can handle it)
        batch_size = 200
        group_updates: list[tuple[str, str]] = []

        for batch_idx in range(0, len(words), batch_size):
            batch = words[batch_idx:batch_idx + batch_size]
            batch_label = f"{book_name} lv{level}"
            if len(words) > batch_size:
                batch_label += f" [{batch_idx // batch_size + 1}]"

            prompt = build_prompt(batch, book_name, level)

            try:
                print(f"  [{batch_label}] {len(batch)} words...", end=" ", flush=True)
                result = call_gemini(client, prompt)
                assigned = sum(1 for v in result.values() if v)
                skipped = sum(1 for v in result.values() if not v)
                print(f"-> {assigned} antonyms, {skipped} skipped")
            except Exception as e:
                print(f"  [ERROR] {batch_label}: {e}")
                time.sleep(3)
                continue

            # Collect updates
            for w in batch:
                eng_lower = w["english"].lower().strip()
                # Try exact match first, then case-insensitive
                antonym = result.get(w["english"]) or result.get(eng_lower)
                if antonym and isinstance(antonym, str) and antonym.strip():
                    group_updates.append((w["id"], antonym.strip()))
                    total_assigned += 1
                else:
                    total_skipped += 1
                total_processed += 1

            time.sleep(1)

        # Commit this group
        if group_updates and not args.dry_run:
            async with async_session() as db:
                for word_id, antonym_val in group_updates:
                    await db.execute(
                        update(Word).where(Word.id == word_id).values(antonym=antonym_val)
                    )
                await db.commit()
            print(f"    [OK] {len(group_updates)} saved")

        progress["completed_books"].append(group_key)
        progress["stats"] = {"processed": total_processed, "assigned": total_assigned, "skipped": total_skipped}
        save_progress(progress)

    pct = total_assigned / (total_assigned + total_skipped) * 100 if (total_assigned + total_skipped) > 0 else 0
    print(f"\n{'='*50}")
    print(f"  Processed: {total_processed}")
    print(f"  Antonyms assigned: {total_assigned} ({pct:.1f}%)")
    print(f"  Skipped (no antonym): {total_skipped}")
    print(f"{'='*50}")

    await db_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
