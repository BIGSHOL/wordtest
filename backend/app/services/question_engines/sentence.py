"""Engine: sentence - Show sentence with blank, pick English word.

Level test name : sentence_blank
Mastery name    : (used as overlay via apply_sentence_overlay)
Card            : SentenceCard

Also provides apply_sentence_overlay() for converting any QuestionSpec
into sentence mode (used by mastery engine).
"""
import re
import random
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool, make_typing_hint
from app.services.question_engines.distractors import pick_english_distractors, shuffle_choices

# ── Irregular verb table ──────────────────────────────────────────────────
_IRREGULAR: dict[str, set[str]] = {
    "be": {"was", "were", "been", "being", "is", "am", "are"},
    "have": {"has", "had", "having"},
    "do": {"does", "did", "done", "doing"},
    "go": {"goes", "went", "gone", "going"},
    "take": {"takes", "took", "taken", "taking"},
    "make": {"makes", "made", "making"},
    "come": {"comes", "came", "coming"},
    "get": {"gets", "got", "gotten", "getting"},
    "give": {"gives", "gave", "given", "giving"},
    "find": {"finds", "found", "finding"},
    "know": {"knows", "knew", "known", "knowing"},
    "think": {"thinks", "thought", "thinking"},
    "say": {"says", "said", "saying"},
    "tell": {"tells", "told", "telling"},
    "see": {"sees", "saw", "seen", "seeing"},
    "put": {"puts", "putting"},
    "run": {"runs", "ran", "running"},
    "eat": {"eats", "ate", "eaten", "eating"},
    "drink": {"drinks", "drank", "drunk", "drinking"},
    "write": {"writes", "wrote", "written", "writing"},
    "read": {"reads", "reading"},
    "speak": {"speaks", "spoke", "spoken", "speaking"},
    "break": {"breaks", "broke", "broken", "breaking"},
    "grow": {"grows", "grew", "grown", "growing"},
    "keep": {"keeps", "kept", "keeping"},
    "hold": {"holds", "held", "holding"},
    "stand": {"stands", "stood", "standing"},
    "sit": {"sits", "sat", "sitting"},
    "lose": {"loses", "lost", "losing"},
    "pay": {"pays", "paid", "paying"},
    "meet": {"meets", "met", "meeting"},
    "set": {"sets", "setting"},
    "begin": {"begins", "began", "begun", "beginning"},
    "show": {"shows", "showed", "shown", "showing"},
    "hear": {"hears", "heard", "hearing"},
    "bring": {"brings", "brought", "bringing"},
    "buy": {"buys", "bought", "buying"},
    "lead": {"leads", "led", "leading"},
    "catch": {"catches", "caught", "catching"},
    "choose": {"chooses", "chose", "chosen", "choosing"},
    "fall": {"falls", "fell", "fallen", "falling"},
    "feel": {"feels", "felt", "feeling"},
    "leave": {"leaves", "left", "leaving"},
    "build": {"builds", "built", "building"},
    "send": {"sends", "sent", "sending"},
    "spend": {"spends", "spent", "spending"},
    "cut": {"cuts", "cutting"},
    "rise": {"rises", "rose", "risen", "rising"},
    "drive": {"drives", "drove", "driven", "driving"},
    "draw": {"draws", "drew", "drawn", "drawing"},
    "teach": {"teaches", "taught", "teaching"},
    "sing": {"sings", "sang", "sung", "singing"},
    "swim": {"swims", "swam", "swum", "swimming"},
    "throw": {"throws", "threw", "thrown", "throwing"},
    "wear": {"wears", "wore", "worn", "wearing"},
    "win": {"wins", "won", "winning"},
    "lie": {"lies", "lay", "lain", "lying", "lied"},
    "hang": {"hangs", "hung", "hanging"},
}

_POSSESSIVE_PAT = r"(?:my|your|his|her|its|our|their|one's)"
_REFLEXIVE_PAT = r"(?:myself|yourself|himself|herself|itself|ourselves|yourselves|themselves)"
_SUFFIX_PAT = r"(?:s|es|ed|ing|d|er|est|ly|tion|ment|ness|ful|less|ous|ive|al|able|ible)"
_STOP_TOKENS = {"one's", "oneself", "a", "an", "the", "~", "..."}


def _build_word_re(word: str) -> str:
    """Build regex alternation for a word including irregular forms and suffixes."""
    base = word.lower()
    forms = {re.escape(base)}
    if base in _IRREGULAR:
        for f in _IRREGULAR[base]:
            forms.add(re.escape(f))
    escaped = re.escape(base)
    forms.add(escaped + _SUFFIX_PAT)
    # Handle silent-e doubling: e.g. "make" -> "making" (strip e + ing)
    if base.endswith("e") and len(base) > 2:
        stem = re.escape(base[:-1])
        forms.add(stem + r"(?:ing|ed|er|est)")
    # Handle consonant doubling: e.g. "run" -> "running"
    if len(base) >= 2 and base[-1] not in "aeiouywx" and base[-2] in "aeiou":
        doubled = re.escape(base + base[-1])
        forms.add(doubled + r"(?:ing|ed|er|est)")
    return r"(?:" + "|".join(forms) + r")"


def _token_re(token: str) -> str | None:
    """Convert a phrase token into a regex pattern, or None to skip."""
    low = token.lower().strip()
    if low in _STOP_TOKENS or not low:
        return None
    if low == "one's":
        return _POSSESSIVE_PAT
    if low == "oneself":
        return _REFLEXIVE_PAT
    return _build_word_re(low)


def _clean_phrase(phrase: str) -> str:
    """Remove annotations from a phrase: ~, ..., (), "", -ing suffix."""
    cleaned = phrase
    cleaned = re.sub(r'\(.*?\)', '', cleaned)  # remove parenthesized
    cleaned = re.sub(r'".*?"', '', cleaned)     # remove quoted
    cleaned = cleaned.replace('~', '').replace('...', '')
    cleaned = re.sub(r'-ing\b', '', cleaned)    # "keep-ing" -> "keep"
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def _try_exact(sentence: str, word: str) -> str | None:
    """Try exact + inflected match (Phase 1 logic)."""
    if not word:
        return None
    # Exact
    pat = re.compile(r'\b' + re.escape(word) + r'\b', re.IGNORECASE)
    if pat.search(sentence):
        return pat.sub('____', sentence, count=1)
    # Inflected
    ipat = re.compile(
        r'\b' + re.escape(word) + r'(?:' + _SUFFIX_PAT + r')?\b',
        re.IGNORECASE,
    )
    if ipat.search(sentence):
        return ipat.sub('____', sentence, count=1)
    return None


def _try_phrase_match(sentence: str, phrase: str, blank_all: bool = True) -> str | None:
    """Try matching content words of a phrase.

    When blank_all=True (standalone phrasal verbs like "give off"),
    blanks all consecutive content tokens as one ____.
    When blank_all=False (phrases with ~ like "go to ~"),
    blanks only the first content word for context.
    """
    tokens = phrase.split()
    content_tokens = []
    for t in tokens:
        low = t.lower().strip()
        if low in _STOP_TOKENS or not low:
            continue
        content_tokens.append(t)

    if not content_tokens:
        return None

    # Blank all consecutive content tokens as a single unit
    if blank_all and len(content_tokens) >= 2:
        parts = []
        for t in content_tokens:
            p = _build_word_re(t.lower().strip())
            parts.append(r'\b' + p + r'\b')
        full_pat = re.compile(r'\s+'.join(parts), re.IGNORECASE)
        m = full_pat.search(sentence)
        if m:
            return sentence[:m.start()] + '____' + sentence[m.end():]

    # Blank only first content word (with context for disambiguation)
    for i, token in enumerate(content_tokens):
        word_pat = _build_word_re(token.lower().strip())
        if i + 1 < len(content_tokens):
            next_tok = content_tokens[i + 1].lower().strip()
            next_re = _token_re(next_tok)
            if next_re:
                ctx_pat = re.compile(
                    r'\b' + word_pat + r'\b\s+' + r'\b' + next_re + r'\b',
                    re.IGNORECASE,
                )
                if ctx_pat.search(sentence):
                    single = re.compile(r'\b' + word_pat + r'\b', re.IGNORECASE)
                    return single.sub('____', sentence, count=1)

        single = re.compile(r'\b' + word_pat + r'\b', re.IGNORECASE)
        if single.search(sentence):
            return single.sub('____', sentence, count=1)

    return None


def _try_abbreviation(sentence: str, target_word: str) -> str | None:
    """Match abbreviations like a.m., p.m., P.E. without word boundaries."""
    if '.' not in target_word:
        return None
    pat = re.compile(re.escape(target_word), re.IGNORECASE)
    m = pat.search(sentence)
    if not m:
        return None
    # When an abbreviation ending with '.' sits at sentence end,
    # its period doubles as the sentence period — restore it.
    end_of_sent = m.end() >= len(sentence.rstrip())
    result = pat.sub('____', sentence, count=1)
    if target_word.endswith('.') and end_of_sent and not result.rstrip().endswith('.'):
        result = result.rstrip() + '.'
    return result


def make_sentence_blank(sentence: str, target_word: str) -> str | None:
    """Replace the target word in the sentence with ____.

    Phases:
    1. Exact / inflected word-boundary match
    2. Clean phrase (remove ~, ..., -ing, etc.) and retry
    3. Phrase match: split into tokens, match first content word with
       irregular verb support, possessive/reflexive pronoun patterns
    4. Abbreviation match (dots in word)
    """
    if not sentence or not target_word:
        return None

    # Phase 1: exact + inflected
    result = _try_exact(sentence, target_word)
    if result:
        return result

    # Phase 2: clean phrase and retry exact
    cleaned = _clean_phrase(target_word)
    if cleaned != target_word:
        result = _try_exact(sentence, cleaned)
        if result:
            return result

    # Phase 3: phrase token matching
    # Standalone phrasal verbs (no ~) blank entire phrase: "give off" → "gave off" → ____
    # Phrases with ~ blank only verb, keep prepositions: "go to ~" → "went" → ____
    blank_all = '~' not in target_word
    result = _try_phrase_match(sentence, cleaned, blank_all=blank_all)
    if result:
        return result

    # Phase 4: abbreviation
    result = _try_abbreviation(sentence, target_word)
    if result:
        return result

    return None


def _pick_example(word: Word) -> tuple[str, str] | None:
    """Pick an example sentence from word.examples or fall back to word.example_en/ko.

    Returns (example_en, example_ko) tuple or None if no usable example.
    """
    # Try word.examples first (1:N relationship)
    examples = getattr(word, 'examples', None)
    if examples:
        # Filter to examples where the word appears in the sentence
        usable = [
            ex for ex in examples
            if make_sentence_blank(ex.example_en, word.english) is not None
        ]
        if usable:
            chosen = random.choice(usable)
            return (chosen.example_en, chosen.example_ko)

    # Fallback to legacy columns
    if word.example_en and make_sentence_blank(word.example_en, word.english) is not None:
        return (word.example_en, word.example_ko or "")

    return None


class SentenceEngine:
    question_type = "sentence"

    def can_generate(self, word: Word) -> bool:
        return _pick_example(word) is not None

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        correct = word.english
        distractors = pick_english_distractors(correct, pool, n_choices - 1, source_word=word)

        example = _pick_example(word)
        ex_en = example[0] if example else word.example_en
        ex_ko = example[1] if example else (word.example_ko or "")
        blank = make_sentence_blank(ex_en, word.english)

        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=correct,
            choices=shuffle_choices(correct, distractors),
            context_mode="sentence",
            sentence_blank=blank,
            sentence_en=ex_en,
            sentence_ko=ex_ko,
        )


def apply_sentence_overlay(spec: QuestionSpec) -> QuestionSpec | None:
    """Convert an existing QuestionSpec into sentence mode.

    Returns a new QuestionSpec with context_mode="sentence" and sentence_blank set,
    or None if the word has no usable example sentence.
    Used by mastery engine to overlay sentence context onto choice questions.
    """
    word = spec.word
    example = _pick_example(word)
    if not example:
        return None

    ex_en, ex_ko = example
    blank = make_sentence_blank(ex_en, word.english)
    if not blank:
        return None

    # Preserve hint; generate one for typing questions if missing
    hint = spec.hint
    if not hint and spec.is_typing and spec.correct_answer:
        hint = make_typing_hint(spec.correct_answer)

    return QuestionSpec(
        question_type=spec.question_type,
        word=spec.word,
        correct_answer=spec.correct_answer,
        choices=spec.choices,
        is_typing=spec.is_typing,
        context_mode="sentence",
        sentence_blank=blank,
        sentence_en=ex_en,
        sentence_ko=ex_ko,
        emoji=spec.emoji,
        hint=hint,
    )
