"""Engine: antonym_choice (반의어) - Show English word, pick its antonym from 4 choices.

Level test name : (N/A)
Mastery name    : antonym_and_choice
Card            : AntonymCard + ChoiceButton
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.question_engines.distractors import (
    pick_english_distractors,
    shuffle_choices,
)


class AntonymChoiceEngine:
    question_type = "antonym_choice"

    def can_generate(self, word: Word) -> bool:
        return bool(word.antonym)

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        antonym = word.antonym
        distractors = pick_english_distractors(
            antonym, pool.all_english, count=n_choices - 1
        )
        choices = shuffle_choices(antonym, distractors)
        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=antonym,
            choices=choices,
            is_typing=False,
        )
