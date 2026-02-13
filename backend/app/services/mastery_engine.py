"""Mastery engine - generates stage-specific questions for the 5-stage system."""
import re
import random
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher

from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.schemas.mastery import (
    MasteryQuestion, MasteryQuestionWord, STAGE_TIMERS, STAGE_QUESTION_TYPES,
)


# ── Loanword (외래어) Detection ─────────────────────────────────────────────

# Korean jamo ranges
_HANGUL_BASE = 0xAC00
_INITIALS = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")  # 19
_FINALS = [""] + list("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")  # 28

# Korean consonant → romanised normalised form
_KO_CONSONANT_MAP: dict[str, str] = {
    "ㄱ": "K", "ㄲ": "K", "ㅋ": "K",
    "ㄴ": "N",
    "ㄷ": "T", "ㄸ": "T", "ㅌ": "T",
    "ㄹ": "R",
    "ㅁ": "M",
    "ㅂ": "P", "ㅃ": "P", "ㅍ": "P",
    "ㅅ": "S", "ㅆ": "S",
    "ㅇ": "",  # silent initial / NG final handled below
    "ㅈ": "C", "ㅉ": "C", "ㅊ": "C",
    "ㅎ": "H",
}

# Double-final consonants decomposition
_KO_DOUBLE_FINAL: dict[str, list[str]] = {
    "ㄳ": ["K", "S"], "ㄵ": ["N", "C"], "ㄶ": ["N", "H"],
    "ㄺ": ["R", "K"], "ㄻ": ["R", "M"], "ㄼ": ["R", "P"],
    "ㄽ": ["R", "S"], "ㄾ": ["R", "T"], "ㄿ": ["R", "P"],
    "ㅀ": ["R", "H"], "ㅄ": ["P", "S"],
}


def _korean_consonant_skeleton(text: str) -> str:
    """Extract consonant skeleton from Korean text (초성 + 종성)."""
    result: list[str] = []
    for ch in text:
        cp = ord(ch)
        if _HANGUL_BASE <= cp <= 0xD7A3:
            idx = cp - _HANGUL_BASE
            initial_idx = idx // (21 * 28)
            final_idx = idx % 28
            # initial consonant
            init = _INITIALS[initial_idx]
            mapped = _KO_CONSONANT_MAP.get(init, "")
            if mapped:
                result.append(mapped)
            # final consonant
            if final_idx > 0:
                final = _FINALS[final_idx]
                if final in _KO_DOUBLE_FINAL:
                    result.extend(_KO_DOUBLE_FINAL[final])
                elif final == "ㅇ":
                    result.append("NK")  # 종성 ㅇ = ng sound
                else:
                    mapped_f = _KO_CONSONANT_MAP.get(final, "")
                    if mapped_f:
                        result.append(mapped_f)
    return "".join(result)


# English digraphs → normalised consonant
_EN_DIGRAPHS: list[tuple[str, str]] = [
    ("tion", "SN"), ("sion", "SN"), ("ght", "T"),
    ("ph", "P"), ("sh", "S"), ("ch", "C"), ("th", "S"),
    ("ck", "K"), ("ng", "NK"), ("wh", "H"), ("wr", "R"),
    ("kn", "N"), ("qu", "K"),
]

_EN_CONSONANT_MAP: dict[str, str] = {
    "b": "P", "c": "K", "d": "T", "f": "P", "g": "K",
    "h": "H", "j": "C", "k": "K", "l": "R", "m": "M",
    "n": "N", "p": "P", "q": "K", "r": "R", "s": "S",
    "t": "T", "v": "P", "w": "", "x": "KS", "y": "",
    "z": "S",
}

_EN_VOWELS = set("aeiou")


def _english_consonant_skeleton(word: str) -> str:
    """Extract consonant skeleton from English word with digraph handling."""
    w = word.lower().strip()
    result: list[str] = []
    i = 0
    while i < len(w):
        matched = False
        # Try digraphs (longest first)
        for digraph, mapped in _EN_DIGRAPHS:
            if w[i:i + len(digraph)] == digraph:
                if mapped:
                    result.append(mapped)
                i += len(digraph)
                matched = True
                break
        if matched:
            continue
        ch = w[i]
        if ch in _EN_VOWELS or not ch.isalpha():
            i += 1
            continue
        mapped = _EN_CONSONANT_MAP.get(ch, "")
        if mapped:
            result.append(mapped)
        i += 1
    return "".join(result)


def is_likely_loanword(english: str, korean: str) -> bool:
    """Detect if a word pair is likely a loanword (외래어) via consonant skeleton matching.

    Returns True if the Korean pronunciation is a transliteration of the English word.
    """
    if not english or not korean:
        return False

    # Use only the first meaning (before comma/semicolon)
    first_meaning = re.split(r"[,;]", korean)[0].strip()

    # Remove parenthetical notes like (하다), (~의)
    first_meaning = re.sub(r"\(.*?\)", "", first_meaning).strip()
    first_meaning = re.sub(r"~", "", first_meaning).strip()

    # Skip if it's a pure Korean phrase (contains spaces → likely definition, not transliteration)
    if " " in first_meaning:
        return False

    # Korean grammatical suffixes → not a transliteration (loanwords are bare nouns)
    _KO_NATIVE_SUFFIXES = ("하다", "되다", "시키다", "적인", "적", "스런", "롭다")
    for suffix in _KO_NATIVE_SUFFIXES:
        if first_meaning.endswith(suffix):
            return False

    # Adjective/possessive endings: 의, 은, 는, 인, 한 (only if 3+ syllables, to avoid short loanwords)
    ko_syllables = sum(1 for ch in first_meaning if _HANGUL_BASE <= ord(ch) <= 0xD7A3)
    _KO_SHORT_SUFFIXES = ("의", "은", "는", "인", "한", "던", "런")
    if ko_syllables >= 3:
        for suffix in _KO_SHORT_SUFFIXES:
            if first_meaning.endswith(suffix):
                return False

    # Verb infinitive ending 다 (빌리다, 쓰다, etc.)
    if first_meaning.endswith("다") and ko_syllables >= 2:
        return False

    # Must have at least 2 Korean syllables
    if ko_syllables < 2:
        return False

    ko_skel = _korean_consonant_skeleton(first_meaning)
    en_skel = _english_consonant_skeleton(english)

    if not ko_skel or not en_skel:
        return False

    ratio = SequenceMatcher(None, en_skel, ko_skel).ratio()
    return ratio >= 0.5


def _word_difficulty_score(word: Word) -> float:
    """Calculate intra-book difficulty score. Higher = harder."""
    score = 0.0
    # 단어 길이 (longer = harder): 0~30점
    score += min(len(word.english), 15) / 15.0 * 30
    # 구(phrase)는 단일 단어보다 어려움: +15점
    if ' ' in word.english.strip():
        score += 15
    # 한국어 의미 개수 (다의어 = harder): 0~20점
    if word.korean:
        meaning_count = word.korean.count(',') + 1
        score += min(meaning_count, 4) * 5
    # 단원 번호 (같은 교재 내 후반 = harder): 0~20점
    try:
        lesson_num = int(word.lesson)
        score += min(lesson_num, 25) / 25.0 * 20
    except (ValueError, TypeError):
        pass
    # 예문 없으면 학습 어려움: +10점
    if not word.example_en:
        score += 10
    return round(score, 1)


# --- Level-based minimum difficulty ---
# Higher-level words get harder question types even at low mastery stages.

def _min_stage_for_level(word_level: int) -> int:
    """Minimum effective stage based on word level.

    Aggressive thresholds so difficulty is felt from book 3 onwards.
    Stage 1-2: multiple choice (easy), Stage 3: listen+type, Stage 4: listen+choice, Stage 5: type
    """
    if word_level <= 2:
        return 1   # 전부 허용 (객관식)
    elif word_level <= 4:
        return 2   # 최소 meaning_to_word (여전히 객관식이지만 역방향)
    elif word_level <= 6:
        return 3   # 최소 listen_and_type (타이핑 시작!)
    elif word_level <= 9:
        return 4   # 최소 listen_to_meaning (듣기+선택)
    else:  # 10-15
        return 5   # 최소 meaning_and_type (한→영 타이핑)


# --- Level-based choice count ---
# Higher levels get more distractors to make multiple choice harder.

def _choice_count_for_level(word_level: int) -> int:
    """Number of choices (including correct) for multiple choice questions."""
    if word_level <= 2:
        return 3   # 쉬움: 3지선다
    elif word_level <= 4:
        return 4   # 기본: 4지선다
    elif word_level <= 7:
        return 5   # 중간: 5지선다
    else:  # 8-15
        return 6   # 어려움: 6지선다


# --- Level-based base timer ---
# Higher levels get shorter time per question (more pressure).

def _base_timer_for_level(word_level: int, stage: int) -> int:
    """Base timer (seconds) considering both level and question type.

    Typing questions (stage 3,5) always get 15s.
    Choice questions get shorter time at higher levels.
    """
    if stage in (3, 5):
        # Typing: always generous
        if word_level <= 4:
            return 15
        elif word_level <= 8:
            return 12
        else:
            return 10
    else:
        # Multiple choice: pressure increases with level
        if word_level <= 2:
            return 8
        elif word_level <= 4:
            return 7
        elif word_level <= 6:
            return 6
        elif word_level <= 9:
            return 5
        else:  # 10-15
            return 4


# --- Level-based typing probability ---
# At stage 1-2, higher levels have a chance to get typing instead of choice.

def _typing_probability(word_level: int) -> float:
    """Probability [0..1] of upgrading a choice question to typing at stage 1-2."""
    if word_level <= 3:
        return 0.0
    elif word_level <= 5:
        return 0.15
    elif word_level <= 7:
        return 0.3
    elif word_level <= 9:
        return 0.45
    else:  # 10-15
        return 0.6


# --- Level-based sentence probability ---
# Higher levels → more sentence/context-based questions

def _sentence_probability(word_level: int) -> float:
    """Return probability [0..1] of using sentence mode for a given word level.

    Capped at 0.5 max to keep most questions as pure word problems.
    """
    if word_level <= 3:
        return 0.0
    elif word_level <= 5:
        return 0.1
    elif word_level <= 7:
        return 0.2
    elif word_level <= 9:
        return 0.3
    elif word_level <= 12:
        return 0.4
    else:  # 13-15
        return 0.5


def _make_sentence_blank(sentence: str, target_word: str) -> str | None:
    """Replace the target word in the sentence with ____.

    Handles case-insensitive matching and common suffixes (s, ed, ing, etc.).
    Returns None if the word is not found.
    """
    if not sentence or not target_word:
        return None

    # Try exact (case-insensitive) word boundary match first
    pattern = re.compile(r'\b' + re.escape(target_word) + r'\b', re.IGNORECASE)
    if pattern.search(sentence):
        return pattern.sub('____', sentence, count=1)

    # Try matching common inflected forms: target + (s|es|ed|ing|d|er|est|ly|tion|ment)
    inflect_pattern = re.compile(
        r'\b' + re.escape(target_word) + r'(?:s|es|ed|ing|d|er|est|ly|tion|ment|ness|ful|less|ous|ive|al|able|ible)?\b',
        re.IGNORECASE,
    )
    if inflect_pattern.search(sentence):
        return inflect_pattern.sub('____', sentence, count=1)

    return None


def _is_phrase(text: str) -> bool:
    """Check if a word entry is a phrase/idiom (contains spaces)."""
    return ' ' in text.strip()


def _has_tilde(text: str) -> bool:
    """Check if Korean meaning starts with ~ (e.g. ~하다, ~을 먹다)."""
    return text.strip().startswith('~')


def _pick_korean_distractors(
    correct: str, all_korean: list[str], count: int = 3,
) -> list[str]:
    """Pick Korean meaning distractors matching the correct answer's pattern.

    If the correct answer starts with ~, prefer other ~ meanings as distractors
    so the ~ prefix doesn't give away the answer.
    """
    correct_has_tilde = _has_tilde(correct)
    same_type = [k for k in all_korean if k != correct and _has_tilde(k) == correct_has_tilde]
    if len(same_type) >= count:
        return random.sample(same_type, count)
    other_type = [k for k in all_korean if k != correct and _has_tilde(k) != correct_has_tilde]
    pool = same_type + other_type
    return random.sample(pool, min(count, len(pool)))


def _pick_english_distractors(
    correct: str, all_english: list[str], count: int = 3,
) -> list[str]:
    """Pick distractors that match the correct answer's type (phrase vs single word).

    If the correct answer is a phrase/idiom, prefer other phrases as distractors.
    If the correct answer is a single word, prefer other single words.
    Falls back to the full pool if not enough same-type distractors exist.
    """
    is_correct_phrase = _is_phrase(correct)
    same_type = [e for e in all_english if e != correct and _is_phrase(e) == is_correct_phrase]
    if len(same_type) >= count:
        return random.sample(same_type, count)
    # Not enough same-type distractors: use what we have + fill from other type
    other_type = [e for e in all_english if e != correct and _is_phrase(e) != is_correct_phrase]
    pool = same_type + other_type
    return random.sample(pool, min(count, len(pool)))


def _word_response(word: Word) -> MasteryQuestionWord:
    return MasteryQuestionWord(
        id=word.id,
        english=word.english,
        korean=word.korean,
        example_en=word.example_en,
        example_ko=word.example_ko,
        level=word.level,
        lesson=word.lesson,
        part_of_speech=word.part_of_speech,
    )


def generate_stage_questions(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    stage: int,
    all_words: list[Word],
) -> list[MasteryQuestion]:
    """Generate stage-appropriate questions for a batch of word masteries.

    Higher-level words get sentence/context-based questions more often.
    """
    if not masteries or not all_words:
        return []

    # Pre-compute distractor pools
    unique_korean = list({w.korean for w in all_words if w.korean})
    unique_english = list({w.english for w in all_words})

    question_type = STAGE_QUESTION_TYPES.get(stage, "word_to_meaning")
    timer = STAGE_TIMERS.get(stage, 5)

    questions: list[MasteryQuestion] = []

    for mastery in masteries:
        word = words_map.get(mastery.word_id)
        if not word:
            continue

        # Decide context mode based on word level
        prob = _sentence_probability(word.level)
        has_example = bool(word.example_en and word.example_ko)
        use_sentence = has_example and (random.random() < prob)

        # Pre-compute sentence blank if using sentence mode
        sentence_blank = None
        if use_sentence and word.example_en:
            sentence_blank = _make_sentence_blank(word.example_en, word.english)
            if not sentence_blank:
                use_sentence = False  # fallback to word mode

        context_mode = "sentence" if use_sentence else "word"

        choices = None
        correct_answer = ""

        if stage == 1:
            if use_sentence:
                # Sentence blank → always English word choices
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            else:
                # English → Korean meaning (4 choices)
                correct_answer = word.korean
                sampled = _pick_korean_distractors(word.korean, unique_korean)
                choices = [correct_answer] + sampled
                random.shuffle(choices)

        elif stage == 2:
            # Korean meaning → English word (4 choices)
            correct_answer = word.english
            sampled = _pick_english_distractors(word.english, unique_english)
            choices = [correct_answer] + sampled
            random.shuffle(choices)

        elif stage == 3:
            # Listen → Type English word
            correct_answer = word.english

        elif stage == 4:
            if use_sentence:
                # Sentence blank → always English word choices
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            else:
                # Listen → Korean meaning (4 choices)
                correct_answer = word.korean
                sampled = _pick_korean_distractors(word.korean, unique_korean)
                choices = [correct_answer] + sampled
                random.shuffle(choices)

        elif stage == 5:
            # Korean meaning → Type English word
            correct_answer = word.english

        questions.append(MasteryQuestion(
            word_mastery_id=mastery.id,
            word=_word_response(word),
            stage=stage,
            question_type=question_type,
            choices=choices,
            correct_answer=correct_answer,
            timer_seconds=timer,
            context_mode=context_mode,
            sentence_blank=sentence_blank,
        ))

    return questions


def generate_mixed_questions(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    all_words: list[Word],
    timer_override: int | None = None,
) -> list[MasteryQuestion]:
    """Generate mixed-type questions based on each word's internal mastery stage.

    Stages are internal only - not shown to user. Question types are mixed:
    - Stage 1-2: randomly word_to_meaning OR meaning_to_word (50:50), timer=5s
    - Stage 3: listen_and_type, timer=15s
    - Stage 4: listen_to_meaning, timer=10s
    - Stage 5: meaning_and_type, timer=15s

    Sentence mode based on word level (higher = more sentences).
    """
    if not masteries or not all_words:
        return []

    # Pre-compute distractor pools
    unique_korean = list({w.korean for w in all_words if w.korean})
    unique_english = list({w.english for w in all_words})

    questions: list[MasteryQuestion] = []

    for mastery in masteries:
        word = words_map.get(mastery.word_id)
        if not word:
            continue

        # Get effective stage: max of mastery stage and level-based minimum
        stage = max(mastery.stage, _min_stage_for_level(word.level))

        # Decide context mode based on word level
        prob = _sentence_probability(word.level)
        has_example = bool(word.example_en and word.example_ko)
        use_sentence = has_example and (random.random() < prob)

        # Pre-compute sentence blank if using sentence mode
        sentence_blank = None
        if use_sentence and word.example_en:
            sentence_blank = _make_sentence_blank(word.example_en, word.english)
            if not sentence_blank:
                use_sentence = False  # fallback to word mode

        context_mode = "sentence" if use_sentence else "word"

        choices = None
        correct_answer = ""
        question_type = ""
        timer = 5

        # Level-based choice count (distractors = n_choices - 1)
        n_choices = _choice_count_for_level(word.level)
        n_distractors = n_choices - 1

        # Determine question type based on internal stage
        if stage == 1 or stage == 2:
            # Typing probability: high-level words may get typing even at stage 1-2
            if random.random() < _typing_probability(word.level):
                # Upgrade to typing (meaning_and_type)
                question_type = "meaning_and_type"
                correct_answer = word.english
                timer = _base_timer_for_level(word.level, 5)
            elif use_sentence:
                # Sentence blank → always English word choices
                question_type = "meaning_to_word"
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english, n_distractors)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
                timer = _base_timer_for_level(word.level, stage)
            elif random.random() < 0.5:
                # word_to_meaning: English → Korean meaning
                question_type = "word_to_meaning"
                correct_answer = word.korean
                sampled = _pick_korean_distractors(word.korean, unique_korean, n_distractors)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
                timer = _base_timer_for_level(word.level, stage)
            else:
                # meaning_to_word: Korean meaning → English word
                question_type = "meaning_to_word"
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english, n_distractors)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
                timer = _base_timer_for_level(word.level, stage)

        elif stage == 3:
            # listen_and_type: Listen → Type English word
            question_type = "listen_and_type"
            correct_answer = word.english
            timer = _base_timer_for_level(word.level, stage)

        elif stage == 4:
            if use_sentence:
                # Sentence blank → always English word choices
                question_type = "listen_to_meaning"
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english, n_distractors)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            else:
                # listen_to_meaning: Listen → Korean meaning
                question_type = "listen_to_meaning"
                correct_answer = word.korean
                sampled = _pick_korean_distractors(word.korean, unique_korean, n_distractors)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            timer = _base_timer_for_level(word.level, stage)

        elif stage == 5:
            # meaning_and_type: Korean meaning → Type English word
            question_type = "meaning_and_type"
            correct_answer = word.english
            timer = _base_timer_for_level(word.level, stage)

        questions.append(MasteryQuestion(
            word_mastery_id=mastery.id,
            word=_word_response(word),
            stage=stage,
            question_type=question_type,
            choices=choices,
            correct_answer=correct_answer,
            timer_seconds=timer_override if timer_override else timer,
            context_mode=context_mode,
            sentence_blank=sentence_blank,
        ))

    return questions


def edit_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return edit_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev_row = list(range(len(s2) + 1))

    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


def generate_word_questions(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    all_words: list[Word],
    timer_override: int | None = None,
) -> list[MasteryQuestion]:
    """Generate word-only questions (no listen/audio).

    Question types: word_to_meaning, meaning_to_word, meaning_and_type (based on level).
    Used by xp_word and legacy_word engines.
    """
    if not masteries or not all_words:
        return []

    unique_korean = list({w.korean for w in all_words if w.korean})
    unique_english = list({w.english for w in all_words})

    questions: list[MasteryQuestion] = []

    for mastery in masteries:
        word = words_map.get(mastery.word_id)
        if not word:
            continue

        # Sentence mode probability based on word level
        prob = _sentence_probability(word.level)
        has_example = bool(word.example_en and word.example_ko)
        use_sentence = has_example and (random.random() < prob)

        sentence_blank = None
        if use_sentence and word.example_en:
            sentence_blank = _make_sentence_blank(word.example_en, word.english)
            if not sentence_blank:
                use_sentence = False

        context_mode = "sentence" if use_sentence else "word"

        # Word mode is always 4지선다 minimum
        n_choices = max(4, _choice_count_for_level(word.level))
        n_distractors = n_choices - 1

        choices = None
        correct_answer = ""
        question_type = ""

        # Word engine: choice-only (no typing) — typing is stage-only
        if use_sentence:
            question_type = "meaning_to_word"
            correct_answer = word.english
            sampled = _pick_english_distractors(word.english, unique_english, n_distractors)
            choices = [correct_answer] + sampled
            random.shuffle(choices)
            timer = _base_timer_for_level(word.level, 2)
        elif random.random() < 0.5:
            question_type = "word_to_meaning"
            correct_answer = word.korean
            sampled = _pick_korean_distractors(word.korean, unique_korean, n_distractors)
            choices = [correct_answer] + sampled
            random.shuffle(choices)
            timer = _base_timer_for_level(word.level, 1)
        else:
            question_type = "meaning_to_word"
            correct_answer = word.english
            sampled = _pick_english_distractors(word.english, unique_english, n_distractors)
            choices = [correct_answer] + sampled
            random.shuffle(choices)
            timer = _base_timer_for_level(word.level, 2)

        questions.append(MasteryQuestion(
            word_mastery_id=mastery.id,
            word=_word_response(word),
            stage=mastery.stage,
            question_type=question_type,
            choices=choices,
            correct_answer=correct_answer,
            timer_seconds=timer_override if timer_override else timer,
            context_mode=context_mode,
            sentence_blank=sentence_blank,
        ))

    return questions


def generate_listen_questions(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    all_words: list[Word],
    timer_override: int | None = None,
) -> list[MasteryQuestion]:
    """Generate listen-only questions (audio-focused).

    Question types: listen_and_type, listen_to_meaning (50:50).
    Used by xp_listen and legacy_listen engines.
    """
    if not masteries or not all_words:
        return []

    unique_korean = list({w.korean for w in all_words if w.korean})
    unique_english = list({w.english for w in all_words})

    questions: list[MasteryQuestion] = []

    for mastery in masteries:
        word = words_map.get(mastery.word_id)
        if not word:
            continue

        # Sentence mode probability based on word level
        prob = _sentence_probability(word.level)
        has_example = bool(word.example_en and word.example_ko)
        use_sentence = has_example and (random.random() < prob)

        sentence_blank = None
        if use_sentence and word.example_en:
            sentence_blank = _make_sentence_blank(word.example_en, word.english)
            if not sentence_blank:
                use_sentence = False

        context_mode = "sentence" if use_sentence else "word"

        n_choices = _choice_count_for_level(word.level)
        n_distractors = n_choices - 1

        choices = None
        correct_answer = ""

        # 50:50 between listen_and_type and listen_to_meaning
        if random.random() < 0.5:
            # listen_and_type: hear pronunciation → type English word
            question_type = "listen_and_type"
            correct_answer = word.english
            timer = _base_timer_for_level(word.level, 3)
        else:
            # listen_to_meaning: hear pronunciation → pick Korean meaning
            question_type = "listen_to_meaning"
            if use_sentence:
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english, n_distractors)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            else:
                correct_answer = word.korean
                sampled = _pick_korean_distractors(word.korean, unique_korean, n_distractors)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            timer = _base_timer_for_level(word.level, 4)

        questions.append(MasteryQuestion(
            word_mastery_id=mastery.id,
            word=_word_response(word),
            stage=mastery.stage,
            question_type=question_type,
            choices=choices,
            correct_answer=correct_answer,
            timer_seconds=timer_override if timer_override else timer,
            context_mode=context_mode,
            sentence_blank=sentence_blank,
        ))

    return questions


def check_typing_answer(submitted: str, correct: str) -> tuple[bool, bool]:
    """Check a typed answer against the correct answer.

    Returns:
        (is_correct, is_almost) tuple.
        is_correct: exact match (case-insensitive, trimmed).
        is_almost: edit distance == 1 (close but not exact).
    """
    submitted_clean = submitted.strip().lower()
    correct_clean = correct.strip().lower()

    if submitted_clean == correct_clean:
        return (True, False)

    dist = edit_distance(submitted_clean, correct_clean)
    if dist == 1 and len(correct_clean) >= 3:
        return (False, True)

    return (False, False)
