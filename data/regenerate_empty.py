"""Regenerate 6 skill-area content for words that had empty results."""
import json, time, requests, os

GEMINI_API_KEY = "AIzaSyAGf0KxjRX7aiqBJAv_E6hCoqU9fT2DVgg"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
BATCH_SIZE = 10  # Smaller batches for better matching (phrases with ~ are tricky)
DELAY = 2
DATA_DIR = os.path.dirname(os.path.abspath(__file__))

PROMPT_TEMPLATE = """You are an English vocabulary content generator for Korean students.
For each word/phrase below, generate content for 6 skill areas:

1. 의미파악력 (Meaning): One simple English sentence (under 12 words) that clearly shows the word's meaning.
2. 단어연상력 (Association): 3 related English words (synonyms, antonyms, or thematic).
3. 발음청취력 (Listening): One English word that sounds similar or is commonly confused.
4. 어휘추론력 (Inference): One English sentence with the target word replaced by "___" where context makes meaning guessable.
5. 철자기억력 (Spelling): The word with some letters replaced by underscores (keep first letter, remove ~40%).
6. 종합응용력 (Application): One natural English sentence using the word in real-life context (under 15 words).

IMPORTANT: The "w" field in output must EXACTLY match the word/phrase as given (including "~" symbols).

Return ONLY a JSON array. Each element: {"w":"exact word/phrase","1":"...","2":"...","3":"...","4":"...","5":"...","6":"..."}

Words:
"""


def generate_batch(words_batch, retries=3):
    word_list = "\n".join(
        f"- {w['english']} ({w['pos']}, {w['korean']})" for w in words_batch
    )
    body = {
        "contents": [{"parts": [{"text": PROMPT_TEMPLATE + word_list}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4096,
            "responseMimeType": "application/json",
        },
    }

    for attempt in range(retries):
        try:
            resp = requests.post(GEMINI_URL, json=body, timeout=60)
            if resp.status_code == 429:
                wait = 15 * (attempt + 1)
                print(f"RATE_LIMIT({wait}s)", end=" ", flush=True)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            data = resp.json()
            text_out = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text_out)
        except (json.JSONDecodeError, KeyError, IndexError):
            if attempt < retries - 1:
                print("RETRY", end=" ", flush=True)
                time.sleep(3)
            else:
                return None
        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                print(f"NET_RETRY", end=" ", flush=True)
                time.sleep(5)
            else:
                return None
    return None


def main():
    with open(os.path.join(DATA_DIR, "empty_words.json"), "r", encoding="utf-8") as f:
        empty_words = json.load(f)
    print(f"Empty words to regenerate: {len(empty_words)}")

    with open(os.path.join(DATA_DIR, "progress.json"), "r", encoding="utf-8") as f:
        progress = json.load(f)

    # Build index: word -> position in results
    results = progress["results"]
    word_to_idx = {}
    for idx, r in enumerate(results):
        w = r.get("w", "").lower()
        if not r.get("1"):  # Only index empty ones
            if w not in word_to_idx:
                word_to_idx[w] = []
            word_to_idx[w].append(idx)

    total_batches = (len(empty_words) + BATCH_SIZE - 1) // BATCH_SIZE
    filled = 0
    failed = 0
    start_time = time.time()

    for i in range(0, len(empty_words), BATCH_SIZE):
        batch = empty_words[i: i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"  [{batch_num}/{total_batches}] {batch[0]['english'][:30]}...", end=" ", flush=True)

        api_results = generate_batch(batch)
        if api_results:
            result_map = {r.get("w", "").lower(): r for r in api_results}
            batch_filled = 0
            for w in batch:
                matched = result_map.get(w["english"].lower())
                if matched and matched.get("1"):
                    # Update in progress results
                    indices = word_to_idx.get(w["english"].lower(), [])
                    if indices:
                        idx = indices.pop(0)
                        results[idx] = matched
                        batch_filled += 1
            filled += batch_filled
            print(f"OK ({batch_filled}/{len(batch)})")
        else:
            failed += len(batch)
            print("FAILED")

        if i + BATCH_SIZE < len(empty_words):
            time.sleep(DELAY)

    # Save updated progress
    progress["results"] = results
    with open(os.path.join(DATA_DIR, "progress.json"), "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False)

    elapsed = time.time() - start_time
    still_empty = sum(1 for r in results if not r.get("1"))
    print(f"\nDone! Filled: {filled} | Still empty: {still_empty} | Failed: {failed} | {elapsed:.0f}s")

    # Regenerate markdown files
    if filled > 0:
        print("\nUpdating markdown files...")
        from generate_all_areas import save_markdown_files, AREA_NAMES
        with open(os.path.join(DATA_DIR, "all_words.json"), "r", encoding="utf-8") as f:
            all_words = json.load(f)
        save_markdown_files(results, all_words)
        print("All 6 markdown files updated!")


if __name__ == "__main__":
    main()
