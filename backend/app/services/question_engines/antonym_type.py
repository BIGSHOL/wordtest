"""Engine: antonym_type (반의어T) - Show English word, type its antonym.

Level test name : (N/A)
Mastery name    : antonym_and_type
Card            : AntonymCard + TypingInput
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool, make_typing_hint


class AntonymTypeEngine:
    question_type = "antonym_type"

    def can_generate(self, word: Word) -> bool:
        return bool(word.antonym)

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        antonym = word.antonym
        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=antonym,
            choices=None,
            is_typing=True,
            hint=make_typing_hint(antonym),
        )
