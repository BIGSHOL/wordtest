"""Engine: sentence_type (예문T) - Show sentence with blank, type English word.

Level test name : (N/A)
Mastery name    : sentence_and_type
Card            : SentenceBlankCard + TypingInput

Combines sentence blank context with typing input.
Shows first letter + underscores as hint.
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool, make_typing_hint
from app.services.question_engines.sentence import _pick_example, make_sentence_blank


class SentenceTypeEngine:
    question_type = "sentence_type"

    def can_generate(self, word: Word) -> bool:
        return _pick_example(word) is not None

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        correct = word.english

        example = _pick_example(word)
        ex_en = example[0] if example else word.example_en
        ex_ko = example[1] if example else (word.example_ko or "")
        blank = make_sentence_blank(ex_en, word.english)

        hint = make_typing_hint(correct)

        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=correct,
            choices=None,
            is_typing=True,
            context_mode="sentence",
            sentence_blank=blank,
            sentence_en=ex_en,
            sentence_ko=ex_ko,
            hint=hint,
        )
