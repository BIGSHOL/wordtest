"""All models must be imported here for Alembic to detect them."""
from app.models.user import User
from app.models.word import Word
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.auth_token import AuthToken
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.tts_cache import TtsCache

__all__ = ["User", "Word", "TestSession", "TestAnswer", "AuthToken", "TestConfig", "TestAssignment", "TtsCache"]
