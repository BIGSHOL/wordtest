"""Engine: ko_type (한영T) - Show Korean meaning, type English word.

Level test name : (N/A)
Mastery name    : meaning_and_type
Card            : MeaningCard + TypingInput
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool, make_typing_hint, clean_english_for_typing


class KoTypeEngine:
    question_type = "ko_type"

    def can_generate(self, word: Word) -> bool:
        return bool(word.korean)

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        cleaned = clean_english_for_typing(word.english)
        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=cleaned,
            choices=None,
            is_typing=True,
            hint=make_typing_hint(word.english),
        )
