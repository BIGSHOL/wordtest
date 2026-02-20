"""Engine: listen_type (리스닝T) - Hear pronunciation, type English word.

Level test name : (N/A)
Mastery name    : listen_and_type
Card            : ListeningCard + TypingInput
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool


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
        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=word.english,
            choices=None,
            is_typing=True,
        )
