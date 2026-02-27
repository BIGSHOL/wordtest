"""Engine: ko_to_en (한영) - Show Korean meaning, pick English word.

Level test name : meaning_word
Mastery name    : meaning_to_word
Card            : MeaningCard (or SentenceCard in sentence mode)
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.question_engines.distractors import pick_english_distractors, shuffle_choices


class KoToEnEngine:
    question_type = "ko_to_en"

    def can_generate(self, word: Word) -> bool:
        return bool(word.korean)

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
