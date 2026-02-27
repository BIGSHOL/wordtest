"""Engine: listen_ko (리스닝K) - Hear pronunciation, pick Korean meaning.

Level test name : (N/A)
Mastery name    : listen_to_meaning
Card            : ListeningCard (choices are Korean)
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.question_engines.distractors import pick_korean_distractors, shuffle_choices


class ListenKoEngine:
    question_type = "listen_ko"

    def can_generate(self, word: Word) -> bool:
        return bool(word.korean)

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        correct = word.korean
        distractors = pick_korean_distractors(correct, pool, n_choices - 1, source_word=word)
        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=correct,
            choices=shuffle_choices(correct, distractors),
        )
