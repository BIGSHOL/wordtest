"""Engine: emoji - Show emoji, pick English word.

Level test name : emoji_word
Mastery name    : emoji_to_word
Card            : EmojiCard
"""
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.emoji_engine import get_emoji, get_emoji_distractors
from app.services.question_engines.distractors import shuffle_choices


class EmojiEngine:
    question_type = "emoji"

    def can_generate(self, word: Word) -> bool:
        return bool(get_emoji(word.english))

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        emoji = get_emoji(word.english)
        correct = word.english
        distractors = get_emoji_distractors(correct, pool.all_english, n_choices - 1)
        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=correct,
            choices=shuffle_choices(correct, distractors),
            emoji=emoji,
        )
