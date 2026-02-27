"""Engine: listen_en (리스닝E) - Hear pronunciation, pick English word.

Level test name : listening
Mastery name    : (N/A - mastery uses listen_and_type or listen_to_meaning)
Card            : ListeningCard
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.question_engines.distractors import pick_english_distractors, shuffle_choices


class ListenEnEngine:
    question_type = "listen_en"

    def can_generate(self, word: Word) -> bool:
        return bool(word.english)

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        correct = word.english
        distractors = pick_english_distractors(correct, pool, n_choices - 1, source_word=word)
        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=correct,
            choices=shuffle_choices(correct, distractors),
        )
