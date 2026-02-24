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

__all__ = [
    "User", "Word", "WordExample", "TestSession", "TestAnswer", "AuthToken",
    "TestConfig", "TestAssignment", "TtsCache",
    "WordMastery", "LearningSession", "LearningAnswer",
]
