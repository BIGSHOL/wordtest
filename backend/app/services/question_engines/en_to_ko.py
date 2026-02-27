"""Engine: en_to_ko (영한) - Show English word, pick Korean meaning.

Level test name : word_meaning
Mastery name    : word_to_meaning
Card            : WordCard (or SentenceCard in sentence mode)
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.question_engines.distractors import pick_korean_distractors, shuffle_choices


class EnToKoEngine:
    question_type = "en_to_ko"

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
