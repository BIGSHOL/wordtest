"""Auto-assign difficulty levels (1-15) to all words based on linguistic metrics.

Uses multiple heuristics (NO AI cost - all offline):
  1. Word frequency (COCA/Wikipedia via wordfreq library) — primary signal
  2. Word length
  3. Syllable count
  4. Multi-word expression penalty
  5. Part of speech complexity

Usage:
    cd backend
    python scripts/auto_level_words.py              # dry-run (preview only)
    python scripts/auto_level_words.py --apply       # update DB
    python scripts/auto_level_words.py --csv         # export CSV report
"""
import asyncio
import csv
import math
import re
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from wordfreq import zipf_frequency

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


# ── Configuration ──────────────────────────────────────────────────────────

# Weight for each scoring component (must sum to 1.0)
WEIGHTS = {
    "frequency": 0.55,   # Word frequency is the strongest signal
    "length": 0.15,      # Longer words tend to be harder
    "syllables": 0.10,   # More syllables = harder
    "multiword": 0.10,   # Phrases/idioms are harder than single words
    "pos": 0.10,         # Abstract words harder than concrete nouns
}

# Number of levels
NUM_LEVELS = 15

# Words with Zipf frequency below this are considered "unknown/rare"
FREQ_FLOOR = 1.0


# ── Syllable Counter ──────────────────────────────────────────────────────

def count_syllables(word: str) -> int:
    """Estimate syllable count for an English word."""
    word = word.lower().strip()
    if not word:
        return 1

    # Remove non-alpha
    word = re.sub(r'[^a-z]', '', word)
    if not word:
        return 1

    # Special short words
    if len(word) <= 3:
        return 1

    # Count vowel groups
    count = len(re.findall(r'[aeiouy]+', word))

    # Subtract silent e
    if word.endswith('e') and not word.endswith(('le', 'ce', 'se', 'ge')):
        count -= 1
    # -ed endings that don't add syllable
    if word.endswith('ed') and not word.endswith(('ted', 'ded')):
        count -= 1

    return max(1, count)


# ── Scoring Functions ─────────────────────────────────────────────────────

def score_frequency(english: str) -> float:
    """Score 0.0 (easy/common) to 1.0 (hard/rare) based on word frequency.

    Uses Zipf frequency: higher Zipf = more common.
    Typical range: 0 (not found) to ~7.7 ("the").
    Most vocab words fall in 2.0-6.0 range.
    """
    # For multi-word expressions, use the rarest word's frequency
    words = re.sub(r'[~()]', '', english).strip().split()
    if not words:
        return 0.8

    # Get frequency of the core word (rarest among components)
    freqs = []
    for w in words:
        w_clean = w.lower().strip(".,;:'\"!?")
        if len(w_clean) < 2:
            continue
        freq = zipf_frequency(w_clean, 'en')
        freqs.append(freq)

    if not freqs:
        return 0.8  # Unknown → assume hard

    # Use the minimum frequency (rarest component determines difficulty)
    min_freq = min(freqs)

    # Map Zipf to 0-1 difficulty score
    # Zipf 6.0+ → very easy (score ~0.0)
    # Zipf 1.0  → very hard (score ~1.0)
    score = 1.0 - (min_freq - FREQ_FLOOR) / (6.0 - FREQ_FLOOR)
    return max(0.0, min(1.0, score))


def score_length(english: str) -> float:
    """Score 0.0 (short/easy) to 1.0 (long/hard) based on word length."""
    # Clean: remove tildes, parentheses
    clean = re.sub(r'[~()\s]+', '', english)
    length = len(clean)

    # Map: 3 chars → 0.0, 15+ chars → 1.0
    score = (length - 3) / 12.0
    return max(0.0, min(1.0, score))


def score_syllables(english: str) -> float:
    """Score based on total syllable count."""
    words = re.sub(r'[~()]', '', english).strip().split()
    total = sum(count_syllables(w) for w in words if len(w) > 1)

    # Map: 1 syllable → 0.0, 6+ syllables → 1.0
    score = (total - 1) / 5.0
    return max(0.0, min(1.0, score))


def score_multiword(english: str) -> float:
    """Score based on multi-word complexity."""
    has_tilde = '~' in english
    words = english.strip().split()
    word_count = len(words)

    if word_count == 1 and not has_tilde:
        return 0.0
    if word_count == 2:
        return 0.3 if not has_tilde else 0.5
    if word_count == 3:
        return 0.6
    return 0.8  # 4+ words


def score_pos(part_of_speech: str | None) -> float:
    """Score based on part of speech difficulty.

    Concrete nouns are easiest, abstract concepts hardest.
    """
    if not part_of_speech:
        return 0.4  # Unknown → medium

    pos = part_of_speech.lower().strip()

    # Easy: concrete nouns, basic verbs
    if pos in ('n', 'noun'):
        return 0.2
    if pos in ('v', 'verb'):
        return 0.3
    # Medium: adjectives, adverbs
    if pos in ('adj', 'adjective'):
        return 0.4
    if pos in ('adv', 'adverb'):
        return 0.5
    # Harder: prepositions, conjunctions (abstract)
    if pos in ('prep', 'preposition', 'conj', 'conjunction'):
        return 0.5
    # Expressions
    if pos in ('구동사', '관용구', '숙어'):
        return 0.7

    return 0.4


# ── Composite Score ───────────────────────────────────────────────────────

def compute_difficulty(english: str, part_of_speech: str | None) -> float:
    """Compute composite difficulty score (0.0 = easiest, 1.0 = hardest)."""
    scores = {
        "frequency": score_frequency(english),
        "length": score_length(english),
        "syllables": score_syllables(english),
        "multiword": score_multiword(english),
        "pos": score_pos(part_of_speech),
    }

    composite = sum(scores[k] * WEIGHTS[k] for k in WEIGHTS)
    return composite


def assign_levels(scored_words: list[dict]) -> list[dict]:
    """Assign level 1-15 based on percentile ranking of difficulty scores.

    Uses percentile-based binning so each level gets roughly equal words.
    """
    if not scored_words:
        return scored_words

    # Sort by difficulty score
    sorted_words = sorted(scored_words, key=lambda w: w["difficulty_score"])
    total = len(sorted_words)

    for i, word in enumerate(sorted_words):
        # Percentile: 0.0 to 1.0
        percentile = i / total
        # Map to level 1-15
        level = min(NUM_LEVELS, max(1, math.ceil(percentile * NUM_LEVELS)))
        word["new_level"] = level

    return scored_words


# ── Database Operations ───────────────────────────────────────────────────

def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def load_all_words(session: AsyncSession) -> list[dict]:
    """Load all non-excluded words from DB."""
    result = await session.execute(text(
        "SELECT id, english, korean, level, book_name, lesson, part_of_speech "
        "FROM words WHERE is_excluded = false "
        "ORDER BY book_name, lesson, english"
    ))
    rows = result.fetchall()
    return [
        {
            "id": r.id,
            "english": r.english,
            "korean": r.korean,
            "old_level": r.level,
            "book_name": r.book_name,
            "lesson": r.lesson,
            "part_of_speech": r.part_of_speech,
        }
        for r in rows
    ]


async def apply_levels(session: AsyncSession, words: list[dict]) -> int:
    """Update word levels in DB. Returns count of changed words."""
    changed = 0
    for w in words:
        if w["new_level"] != w["old_level"]:
            await session.execute(
                text("UPDATE words SET level = :level WHERE id = :id"),
                {"level": w["new_level"], "id": w["id"]},
            )
            changed += 1
    await session.commit()
    return changed


# ── Reporting ─────────────────────────────────────────────────────────────

def print_distribution(words: list[dict], label: str, level_key: str):
    """Print level distribution table."""
    dist: dict[int, int] = {}
    for w in words:
        lv = w[level_key]
        dist[lv] = dist.get(lv, 0) + 1

    print(f"\n{'-' * 50}")
    print(f"  {label}")
    print(f"{'-' * 50}")
    print(f"  {'Level':<8} {'Count':>6}  {'Bar'}")
    print(f"  {'-' * 40}")

    total = len(words)
    for lv in range(1, NUM_LEVELS + 1):
        count = dist.get(lv, 0)
        bar_len = int(count / max(total, 1) * 60)
        bar = '#' * bar_len
        print(f"  Lv {lv:2d}    {count:5d}  {bar}")

    print(f"  {'-' * 40}")
    print(f"  {'Total':<8} {total:5d}")


def print_samples(words: list[dict], num_per_level: int = 5):
    """Print sample words at each level."""
    by_level: dict[int, list[dict]] = {}
    for w in words:
        lv = w["new_level"]
        by_level.setdefault(lv, []).append(w)

    print(f"\n{'-' * 70}")
    print(f"  Sample Words by New Level (top {num_per_level} per level)")
    print(f"{'-' * 70}")

    for lv in range(1, NUM_LEVELS + 1):
        level_words = by_level.get(lv, [])
        # Sort by score and pick samples
        level_words.sort(key=lambda w: w["difficulty_score"])
        samples = level_words[:num_per_level]
        sample_str = ", ".join(
            f"{w['english']}({w['difficulty_score']:.2f})" for w in samples
        )
        count = len(level_words)
        print(f"  Lv {lv:2d} ({count:4d}): {sample_str}")


def print_big_changes(words: list[dict], threshold: int = 5, max_show: int = 20):
    """Print words with biggest level changes."""
    changed = [
        w for w in words
        if abs(w["new_level"] - w["old_level"]) >= threshold
    ]
    changed.sort(key=lambda w: abs(w["new_level"] - w["old_level"]), reverse=True)

    if not changed:
        print(f"\n  No words changed by {threshold}+ levels.")
        return

    print(f"\n{'-' * 70}")
    print(f"  Words with biggest level changes (>={threshold} levels)")
    print(f"{'-' * 70}")
    print(f"  {'English':<25} {'Book':<25} {'Old':>4} {'New':>4} {'Diff':>5}  {'Score':>5}")
    print(f"  {'-' * 65}")

    for w in changed[:max_show]:
        diff = w["new_level"] - w["old_level"]
        sign = "+" if diff > 0 else ""
        print(
            f"  {w['english']:<25} {w['book_name'][:24]:<25} "
            f"{w['old_level']:>4} {w['new_level']:>4} {sign}{diff:>4}  "
            f"{w['difficulty_score']:.3f}"
        )

    if len(changed) > max_show:
        print(f"  ... and {len(changed) - max_show} more")


def export_csv(words: list[dict], output_path: str):
    """Export results to CSV for review."""
    words_sorted = sorted(words, key=lambda w: (w["new_level"], w["difficulty_score"]))

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "english", "korean", "book_name", "lesson",
            "part_of_speech", "old_level", "new_level",
            "difficulty_score", "freq_score", "length_score",
        ])
        for w in words_sorted:
            writer.writerow([
                w["english"], w["korean"], w["book_name"], w["lesson"],
                w.get("part_of_speech", ""),
                w["old_level"], w["new_level"],
                f"{w['difficulty_score']:.4f}",
                f"{score_frequency(w['english']):.4f}",
                f"{score_length(w['english']):.4f}",
            ])

    print(f"\n  CSV exported to: {output_path}")
    print(f"  Total rows: {len(words_sorted)}")


# ── Main ──────────────────────────────────────────────────────────────────

async def main():
    do_apply = "--apply" in sys.argv
    do_csv = "--csv" in sys.argv

    print("=" * 60)
    print("  Word Auto-Level Assignment Tool")
    print("  (offline - no AI cost)")
    print("=" * 60)

    if do_apply:
        print("\n  [!] MODE: APPLY (will update database)")
    else:
        print("\n  MODE: DRY-RUN (preview only, use --apply to save)")

    # Connect to DB
    print("\n  Connecting to database...")
    SessionLocal = get_session_factory()

    async with SessionLocal() as session:
        # Load words
        words = await load_all_words(session)
        print(f"  Loaded {len(words)} words")

        if not words:
            print("  No words found. Exiting.")
            return

        # Print current distribution
        print_distribution(words, "BEFORE: Current Level Distribution", "old_level")

        # Compute difficulty scores
        print("\n  Computing difficulty scores...")
        for w in words:
            w["difficulty_score"] = compute_difficulty(
                w["english"], w.get("part_of_speech")
            )

        # Assign new levels
        assign_levels(words)

        # Print new distribution
        print_distribution(words, "AFTER: New Level Distribution", "new_level")

        # Print samples
        print_samples(words)

        # Print big changes
        print_big_changes(words)

        # Stats
        changed_count = sum(1 for w in words if w["new_level"] != w["old_level"])
        print(f"\n  Summary: {changed_count}/{len(words)} words would change level")

        # Export CSV
        if do_csv:
            csv_path = str(Path(__file__).parent / "word_levels_report.csv")
            export_csv(words, csv_path)

        # Apply
        if do_apply:
            print("\n  Applying changes to database...")
            updated = await apply_levels(session, words)
            print(f"  [OK] Updated {updated} words")
        else:
            print("\n  → Run with --apply to save changes to database")
            print("  → Run with --csv to export detailed report")


if __name__ == "__main__":
    asyncio.run(main())
