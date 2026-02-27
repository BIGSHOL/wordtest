"""All models must be imported here for Alembic to detect them."""
from app.models.user import User
from app.models.word import Word
from app.models.word_example import WordExample
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.auth_token import AuthToken
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.tts_cache import TtsCache
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.grammar_book import GrammarBook
from app.models.grammar_chapter import GrammarChapter
from app.models.grammar_point import GrammarPoint
from app.models.grammar_sentence import GrammarSentence
from app.models.grammar_question import GrammarQuestion
from app.models.grammar_config import GrammarConfig
from app.models.grammar_session import GrammarSession
from app.models.grammar_answer import GrammarAnswer

__all__ = [
    "User", "Word", "WordExample", "TestSession", "TestAnswer", "AuthToken",
    "TestConfig", "TestAssignment", "TtsCache",
    "WordMastery", "LearningSession", "LearningAnswer",
    "GrammarBook", "GrammarChapter", "GrammarPoint", "GrammarSentence",
    "GrammarQuestion", "GrammarConfig", "GrammarSession", "GrammarAnswer",
]
