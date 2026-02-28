"""Engine: listen_type (리스닝T) - Hear pronunciation, type English word.

Level test name : (N/A)
Mastery name    : listen_and_type
Card            : ListeningCard + TypingInput
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool, make_typing_hint, clean_english_for_typing


class ListenTypeEngine:
    question_type = "listen_type"

    def can_generate(self, word: Word) -> bool:
        return bool(word.english)

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
