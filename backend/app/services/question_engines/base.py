"""Base types and protocols for the modular question engine system.

QuestionSpec  - Unified question output format
DistractorPool - Pre-computed word pools shared across engines
QuestionEngine - Protocol that all engine modules implement
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from app.models.word import Word


@dataclass
class QuestionSpec:
    """Unified question output, engine-agnostic."""

    question_type: str              # canonical name: 'en_to_ko', 'ko_to_en', etc.
    word: Word                      # source word
    correct_answer: str             # correct answer string
    choices: list[str] | None       # 4-choice list (None for typing)
    is_typing: bool = False         # True for typing-input questions
    context_mode: str = "word"      # "word" | "sentence"
    sentence_blank: str | None = None  # e.g. "He ____ the door."
    sentence_en: str | None = None  # selected example sentence (English)
    sentence_ko: str | None = None  # selected example sentence (Korean)
    emoji: str | None = None        # emoji string for emoji questions
    hint: str | None = None          # first-letter hint for typing questions


def make_typing_hint(word: str) -> str | None:
    """Generate typing hint: first letter of each word + underscores.

    Single word:  'fill'               → 'f___'
    Multi-word:   'for the first time' → 'f__ t__ f____ t___'
    """
    if not word:
        return None
    parts = word.split(' ')
    hint_parts = []
    for part in parts:
        if part:
            hint_parts.append(part[0] + '_' * (len(part) - 1))
    return ' '.join(hint_parts)


@dataclass
class DistractorPool:
    """Pre-computed pools for distractor generation.

    Built once per question batch; shared across all engines.
    """

    all_korean: list[str] = field(default_factory=list)   # unique korean meanings
    all_english: list[str] = field(default_factory=list)   # unique english words
    all_words: list[Word] = field(default_factory=list)    # full word list


@runtime_checkable
class QuestionEngine(Protocol):
    """Protocol for per-type question engines."""

    question_type: str

    def can_generate(self, word: Word) -> bool:
        """Return True if this engine can generate a question for the given word."""
        ...

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        """Generate a single question for the given word."""
        ...
