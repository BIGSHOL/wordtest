"""Regenerate remaining empty results - handles duplicate words by reusing results."""
import json, time, requests, os

GEMINI_API_KEY = "AIzaSyAGf0KxjRX7aiqBJAv_E6hCoqU9fT2DVgg"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
BATCH_SIZE = 10
DELAY = 2
DATA_DIR = os.path.dirname(os.path.abspath(__file__))

PROMPT_TEMPLATE = """You are an English vocabulary content generator for Korean students.
For each word below, generate content for 6 skill areas:

1. 의미파악력 (Meaning): One simple English sentence (under 12 words) that clearly shows the word's meaning.
2. 단어연상력 (Association): 3 related English words (synonyms, antonyms, or thematic).
3. 발음청취력 (Listening): One English word that sounds similar or is commonly confused.
4. 어휘추론력 (Inference): One English sentence with the target word replaced by "___" where context makes meaning guessable.
5. 철자기억력 (Spelling): The word with some letters replaced by underscores (keep first letter, remove ~40%).
6. 종합응용력 (Application): One natural English sentence using the word in real-life context (under 15 words).

IMPORTANT: The "w" field must EXACTLY match the input word.

Return ONLY a JSON array. Each element: {"w":"word","1":"...","2":"...","3":"...","4":"...","5":"...","6":"..."}

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
        except requests.exceptions.RequestException:
            if attempt < retries - 1:
                print("NET_RETRY", end=" ", flush=True)
                time.sleep(5)
            else:
                return None
    return None


def main():
    with open(os.path.join(DATA_DIR, "progress.json"), "r", encoding="utf-8") as f:
        progress = json.load(f)
    with open(os.path.join(DATA_DIR, "all_words.json"), "r", encoding="utf-8") as f:
        all_words = json.load(f)

    results = progress["results"]
    word_info = {w["english"].lower(): w for w in all_words}

    # Collect empty indices
    empty_indices = []
    for idx, r in enumerate(results):
        if not r.get("1"):
            empty_indices.append(idx)

    print(f"Empty results to fill: {len(empty_indices)}")

    # Get unique words to generate
    seen = set()
    unique_words = []
    for idx in empty_indices:
        w = results[idx].get("w", "").lower()
        if w not in seen:
            seen.add(w)
            info = word_info.get(w, {})
            unique_words.append({
                "english": results[idx].get("w", ""),
                "korean": info.get("korean", ""),
                "pos": info.get("pos", ""),
            })

    print(f"Unique words to generate: {len(unique_words)}")

    # Generate for unique words
    generated = {}  # word_lower -> result
    total_batches = (len(unique_words) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(unique_words), BATCH_SIZE):
        batch = unique_words[i: i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"  [{batch_num}/{total_batches}] {batch[0]['english'][:25]}...", end=" ", flush=True)

        api_results = generate_batch(batch)
        if api_results:
            for r in api_results:
                if r.get("1"):
                    generated[r.get("w", "").lower()] = r
            print(f"OK ({len([r for r in api_results if r.get('1')])})")
        else:
            print("FAILED")

        if i + BATCH_SIZE < len(unique_words):
            time.sleep(DELAY)

    print(f"\nGenerated {len(generated)} unique results")

    # Fill all empty slots (including duplicates) using generated results
    filled = 0
    for idx in empty_indices:
        w = results[idx].get("w", "").lower()
        if w in generated:
            results[idx] = generated[w]
            filled += 1

    # Save
    progress["results"] = results
    with open(os.path.join(DATA_DIR, "progress.json"), "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False)

    still_empty = sum(1 for r in results if not r.get("1"))
    print(f"Filled: {filled} | Still empty: {still_empty}")

    if filled > 0:
        print("\nUpdating markdown files...")
        from generate_all_areas import save_markdown_files
        save_markdown_files(results, all_words)
        print("All 6 markdown files updated!")


if __name__ == "__main__":
    main()
