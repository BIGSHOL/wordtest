"""Extract grammar questions from 천일문 GRAMMAR PDF files.

Uses PyMuPDF for text extraction and Gemini 2.5 Flash Lite for parsing/answering.
Outputs JSON compatible with `import_grammar.py --from-json`.

Usage:
    cd backend
    python -m scripts.extract_grammar_pdf                   # Extract all 3 levels
    python -m scripts.extract_grammar_pdf --level 1         # Specific level only
    python -m scripts.extract_grammar_pdf --dry-run         # Preview pages, no Gemini calls
    python -m scripts.extract_grammar_pdf --resume          # Resume from progress file
"""
import argparse
import io
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

# Fix Windows encoding
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import fitz  # PyMuPDF
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data"

PDF_FILES = {
    1: DATA_DIR / "천일문 문법_1권_unlocked.pdf",
    2: DATA_DIR / "천일문그래머_2권-잠금 해제됨.pdf",
    3: DATA_DIR / "천일문그래머_3권-잠금 해제됨.pdf",
}

OUTPUT_FILE = SCRIPT_DIR / "grammar_questions_extracted.json"
PROGRESS_FILE = SCRIPT_DIR / "extract_grammar_progress.json"

CHAPTER_TITLES = {
    1: {
        1: "be동사", 2: "일반동사", 3: "현재진행형과 미래 표현",
        4: "조동사", 5: "명사와 관사", 6: "대명사",
        7: "형용사, 부사, 비교", 8: "여러 가지 문장 종류",
        9: "문장의 여러 형식", 10: "to부정사와 동명사",
        11: "전치사", 12: "접속사",
    },
    2: {
        1: "문장의 주요 형식", 2: "시제", 3: "조동사",
        4: "수동태", 5: "to부정사", 6: "동명사",
        7: "분사", 8: "대명사", 9: "형용사와 부사",
        10: "비교 표현", 11: "접속사", 12: "관계대명사",
    },
    3: {
        1: "완료 시제", 2: "조동사", 3: "수동태",
        4: "부정사", 5: "동명사", 6: "분사",
        7: "비교 표현", 8: "접속사", 9: "관계사",
        10: "가정법", 11: "일치와 화법", 12: "특수 구문",
    },
}

# Question types our DB supports
VALID_QTYPES = [
    "grammar_blank",      # 빈칸 5지선다
    "grammar_error",      # 어법상 알맞지 않은/알맞은 문장
    "grammar_common",     # 공통으로 들어갈 말 / 나머지와 다른 하나
    "grammar_usage",      # 밑줄 친 부분의 의미/쓰임
    "grammar_pair",       # (A)(B) 짝짓기
    "grammar_order",      # 단어 배열 (서술형)
    "grammar_transform",  # 문장 전환 (서술형)
    "grammar_translate",  # 영작 (서술형)
]

GEMINI_PROMPT = """You are parsing grammar questions from a Korean middle-school English grammar textbook (천일문 GRAMMAR).

Given the raw extracted text from a PDF page, parse ALL questions into structured JSON.

## Question Types and JSON Format

### grammar_blank (빈칸 선택 - MCQ with 5 choices)
Instructions like: "빈칸에 들어갈 알맞은 말", "빈칸에 들어갈 말로 알맞지 않은 것"
```json
{
  "question_type": "grammar_blank",
  "question_data": {
    "stem": "Jisu ___ in the bathroom now.",
    "choices": ["is", "am", "are", "was", "were"],
    "correct_index": 0
  }
}
```
Note: If the instruction says "알맞지 않은 것" (incorrect one), correct_index should be the WRONG grammar choice.

### grammar_error (어법 판단 - choose correct/incorrect sentences)
Instructions like: "어법상 알맞지 않은 문장", "어법상 알맞은 문장", "어법상 알맞은 문장 두 개"
```json
{
  "question_type": "grammar_error",
  "question_data": {
    "prompt": "다음 중 어법상 알맞지 않은 문장을 고르세요.",
    "sentences": ["sentence1", "sentence2", "sentence3", "sentence4", "sentence5"],
    "correct_indices": [3],
    "invert": false,
    "select_count": 1
  }
}
```
- correct_indices: 0-based indices of the answer(s)
- invert: true if asking for CORRECT sentences (알맞은), false if asking for INCORRECT (알맞지 않은)
- select_count: 1 or 2

### grammar_common (공통/다른 단어)
Instructions like: "빈칸에 들어갈 단어가 나머지와 다른 하나", "공통으로 들어갈 말"
```json
{
  "question_type": "grammar_common",
  "question_data": {
    "sentences": ["My sister ___ sick yesterday.", "They ___ in Busan last month.", ...],
    "prompt": "다음 중 빈칸에 들어갈 단어가 나머지와 다른 하나를 고르세요.",
    "correct_index": 1
  }
}
```

### grammar_usage (쓰임/의미 구별)
Instructions like: "밑줄 친 부분의 의미가 나머지와 다른", "쓰임이 같은/같지 않은"
```json
{
  "question_type": "grammar_usage",
  "question_data": {
    "prompt": "다음 밑줄 친 be동사의 의미가 나머지와 다른 하나를 고르세요.",
    "sentences": ["sentence1", "sentence2", ...],
    "correct_index": 1
  }
}
```

### grammar_pair ((A)(B) 짝짓기)
Instructions like: "(A), (B)에 들어갈 말이 바르게 짝지어진 것"
```json
{
  "question_type": "grammar_pair",
  "question_data": {
    "stem": "Your sister looks (A) when she plays with her puppy. Rules will keep us (B).",
    "paired_choices": [["happy", "safe"], ["happy", "safely"], ...],
    "correct_index": 0
  }
}
```

### grammar_order (단어 배열 - 서술형)
Instructions like: "단어를 올바르게 배열", "주어진 단어를 사용하여"
```json
{
  "question_type": "grammar_order",
  "question_data": {
    "words": ["Hanbok", "my Chinese friends", "showed", "to", "I"],
    "correct_answer": "I showed Hanbok to my Chinese friends.",
    "sentence_ko": "나는 나의 중국인 친구들에게 한복을 보여 주었다."
  }
}
```

### grammar_transform (문장 전환 - 서술형)
Instructions like: "부정문으로 바꿔 쓰세요", "의문문으로 바꿔 쓰세요"
```json
{
  "question_type": "grammar_transform",
  "question_data": {
    "original": "Bill and Ted are very brave.",
    "instruction": "부정문으로 바꿔 쓰세요.",
    "correct_answer": "Bill and Ted are not very brave.",
    "acceptable_answers": ["Bill and Ted aren't very brave."]
  }
}
```

### grammar_translate (영작 - 서술형)
Instructions like: "우리말과 일치하도록", "영작"
```json
{
  "question_type": "grammar_translate",
  "question_data": {
    "sentence_ko": "그 배우는 매우 유명하다.",
    "correct_answer": "The actor is very famous.",
    "acceptable_answers": ["The actor is really famous."],
    "hint_words": ["actor", "famous"]
  }
}
```

## Rules
1. Parse EVERY question you can identify from the text
2. Determine the CORRECT answer based on English grammar rules
3. Use 0-based indexing for correct_index/correct_indices
4. For ① ② ③ ④ ⑤ markers, map to indices 0,1,2,3,4
5. Skip questions that require images/tables/diagrams to answer (output them with "skip": true and "skip_reason")
6. For 서술형 (written) questions, only parse if the answer can be determined from the text
7. Include ALL questions — even partially parseable ones
8. Be precise with the stem text — preserve English sentences exactly
9. For blanks, use ___ (three underscores) in the stem

## Important
- The text is from PyMuPDF extraction and may have formatting artifacts
- Question numbers may appear before or after the question content
- POINT references (e.g., "POINT 2") indicate grammar topics — ignore them
- "고난도" means "difficult", "빈출" means "frequently tested", "REAL 기출" means "real exam" — ignore these labels
- "서술형" means "written response" type question

Return a JSON array of question objects. Each object must have:
- "question_type": one of the valid types above
- "question_data": the structured data as shown above
- "difficulty": 1 (easy), 2 (medium), or 3 (hard) — use "고난도" as difficulty 3, default 1
- "source_q_num": the original question number from the text (if identifiable)

If a question cannot be parsed or requires missing context (like an image), include it as:
```json
{"skip": true, "skip_reason": "requires image", "source_q_num": 14}
```

Return ONLY the JSON array, no other text. Do not wrap in markdown code blocks."""


def find_question_pages(doc: fitz.Document) -> list[int]:
    """Find all pages that contain questions (MCQ choices or exercises)."""
    pages = []
    for pg_num in range(len(doc)):
        text = doc[pg_num].get_text()

        # Skip first ~8 pages (TOC, preview, vocab list)
        if pg_num < 8:
            # Only include if it's clearly a Chapter Test or Exercise page
            if "Chapter Test" not in text and "Unit Exercise" not in text and "기출 문제" not in text:
                continue

        # Skip vocab/preview pages
        if "어휘리스트" in text or "부가서비스" in text or "WORKBOOK" in text:
            continue

        has_choices = "①" in text and ("③" in text or "⑤" in text)
        has_exercise = "Unit Exercise" in text or "기출 문제" in text
        has_bracket = re.search(r"\[.+?/\s*.+?\]", text)  # [want / wants] pattern
        has_chapter_test = "Chapter Test" in text

        if has_choices or has_exercise or has_bracket or has_chapter_test:
            pages.append(pg_num)
    return pages


def identify_chapter(text: str) -> Optional[int]:
    """Extract chapter number from page text.

    Looks for the primary chapter header/footer pattern.
    Prefers header lines like 'CHAPTER 02  일반동사' or 'Chapter 02  시제'.
    """
    # Look for the chapter header that appears in the page margin/header
    # These usually appear as "CHAPTER XX  제목" on a single line
    lines = text.split("\n")
    for line in lines:
        line_s = line.strip()
        # Pattern: "CHAPTER XX  제목" (header/footer style)
        match = re.match(r"(?:CHAPTER|Chapter)\s+(\d{1,2})\s+\S", line_s)
        if match:
            return int(match.group(1))
    # Fallback: any "Chapter XX" reference
    match = re.search(r"(?:Chapter|CHAPTER)\s+(\d{1,2})", text)
    if match:
        return int(match.group(1))
    return None


def group_pages_by_chapter(
    doc: fitz.Document, q_pages: list[int]
) -> dict[int, list[int]]:
    """Group question pages by chapter number."""
    chapter_pages: dict[int, list[int]] = {}
    for pg_num in q_pages:
        text = doc[pg_num].get_text()
        ch = identify_chapter(text)
        if ch and 1 <= ch <= 12:
            chapter_pages.setdefault(ch, []).append(pg_num)
    return chapter_pages


def extract_chapter_text(doc: fitz.Document, pages: list[int]) -> str:
    """Combine text from multiple pages for a chapter."""
    texts = []
    for pg_num in sorted(pages):
        page_text = doc[pg_num].get_text()
        texts.append(f"\n--- PAGE {pg_num + 1} ---\n{page_text}")
    return "\n".join(texts)


def call_gemini(text: str, level: int, chapter: int, retries: int = 3) -> list[dict]:
    """Send text to Gemini for parsing and return structured questions."""
    from google import genai

    load_dotenv()
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    user_prompt = (
        f"Level {level}, Chapter {chapter} "
        f"({CHAPTER_TITLES.get(level, {}).get(chapter, 'Unknown')})\n\n"
        f"Parse the following extracted text:\n\n{text}"
    )

    for attempt in range(retries):
        try:
            resp = client.models.generate_content(
                model="gemini-2.5-flash-lite",
                contents=[
                    {"role": "user", "parts": [{"text": GEMINI_PROMPT + "\n\n" + user_prompt}]}
                ],
            )
            raw = resp.text.strip()
            # Strip markdown code block if present
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\s*\n?", "", raw)
                raw = re.sub(r"\n?```\s*$", "", raw)
            questions = json.loads(raw)
            if not isinstance(questions, list):
                questions = [questions]
            return questions
        except json.JSONDecodeError as e:
            print(f"  JSON parse error (attempt {attempt + 1}): {e}")
            if attempt < retries - 1:
                time.sleep(2)
        except Exception as e:
            print(f"  Gemini error (attempt {attempt + 1}): {e}")
            if attempt < retries - 1:
                time.sleep(3)
    return []


def validate_question(q: dict) -> bool:
    """Basic validation of a parsed question."""
    if q.get("skip"):
        return False
    qtype = q.get("question_type")
    if qtype not in VALID_QTYPES:
        return False
    qdata = q.get("question_data")
    if not qdata:
        return False

    if qtype == "grammar_blank":
        return (
            "stem" in qdata
            and "choices" in qdata
            and "correct_index" in qdata
            and isinstance(qdata["choices"], list)
            and len(qdata["choices"]) >= 2
            and 0 <= qdata["correct_index"] < len(qdata["choices"])
        )
    elif qtype == "grammar_error":
        return (
            "sentences" in qdata
            and "correct_indices" in qdata
            and isinstance(qdata["sentences"], list)
        )
    elif qtype in ("grammar_common", "grammar_usage"):
        return "correct_index" in qdata
    elif qtype == "grammar_pair":
        return (
            "paired_choices" in qdata
            and "correct_index" in qdata
        )
    elif qtype == "grammar_order":
        return "correct_answer" in qdata
    elif qtype == "grammar_transform":
        return "correct_answer" in qdata and "original" in qdata
    elif qtype == "grammar_translate":
        return "correct_answer" in qdata
    return False


def load_progress() -> dict:
    """Load progress from file."""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"completed": [], "questions": []}


def save_progress(progress: dict):
    """Save progress to file."""
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Extract grammar questions from PDFs")
    parser.add_argument("--level", type=int, choices=[1, 2, 3], help="Extract specific level only")
    parser.add_argument("--dry-run", action="store_true", help="Preview pages without calling Gemini")
    parser.add_argument("--resume", action="store_true", help="Resume from progress file")
    args = parser.parse_args()

    levels = [args.level] if args.level else [1, 2, 3]
    progress = load_progress() if args.resume else {"completed": [], "questions": []}
    all_questions = progress["questions"]

    for level in levels:
        pdf_path = PDF_FILES[level]
        if not pdf_path.exists():
            print(f"PDF not found: {pdf_path}")
            continue

        print(f"\n{'='*60}")
        print(f"Level {level}: {pdf_path.name}")
        print(f"{'='*60}")

        doc = fitz.open(str(pdf_path))
        q_pages = find_question_pages(doc)
        chapter_pages = group_pages_by_chapter(doc, q_pages)

        print(f"Found {len(q_pages)} question pages across {len(chapter_pages)} chapters")

        for ch_num in sorted(chapter_pages.keys()):
            key = f"L{level}C{ch_num}"
            if key in progress["completed"]:
                print(f"  Chapter {ch_num} ({CHAPTER_TITLES[level].get(ch_num, '?')}) — skipped (already done)")
                continue

            pages = chapter_pages[ch_num]
            ch_title = CHAPTER_TITLES[level].get(ch_num, "Unknown")
            print(f"\n  Chapter {ch_num}: {ch_title} ({len(pages)} pages: {[p+1 for p in pages]})")

            text = extract_chapter_text(doc, pages)
            text_len = len(text)
            print(f"    Text length: {text_len} chars")

            if args.dry_run:
                # Show first 500 chars of combined text
                print(f"    Preview: {text[:300].replace(chr(10), ' | ')}")
                continue

            # Call Gemini to parse
            print(f"    Calling Gemini...", end=" ", flush=True)
            questions = call_gemini(text, level, ch_num)
            skipped = sum(1 for q in questions if q.get("skip"))
            valid = [q for q in questions if validate_question(q)]

            print(f"parsed {len(questions)} raw, {len(valid)} valid, {skipped} skipped")

            # Add metadata
            for q in valid:
                q["level"] = level
                q["chapter_num"] = ch_num
                q["source"] = "pdf"
                if "difficulty" not in q:
                    q["difficulty"] = 1

            all_questions.extend(valid)

            # Save progress
            progress["completed"].append(key)
            progress["questions"] = all_questions
            save_progress(progress)

            # Rate limit
            time.sleep(1)

        doc.close()

    if args.dry_run:
        print(f"\nDry run complete. Use without --dry-run to extract.")
        return

    # Write final output
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    # Stats
    by_level = {}
    by_type = {}
    for q in all_questions:
        lv = q.get("level", "?")
        by_level[lv] = by_level.get(lv, 0) + 1
        qt = q.get("question_type", "?")
        by_type[qt] = by_type.get(qt, 0) + 1

    print(f"\n{'='*60}")
    print(f"Extraction complete: {len(all_questions)} total questions")
    print(f"{'='*60}")
    print(f"By level: {dict(sorted(by_level.items()))}")
    print(f"By type:  {dict(sorted(by_type.items()))}")
    print(f"Output:   {OUTPUT_FILE}")
    print(f"\nTo import: python -m scripts.import_grammar --from-json {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
