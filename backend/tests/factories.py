"""Factory Boy factories for test data generation."""
import uuid
from datetime import datetime

import factory

from app.models.user import User
from app.models.word import Word
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.core.security import get_password_hash


class UserFactory(factory.Factory):
    class Meta:
        model = User

    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    email = factory.Sequence(lambda n: f"user{n}@test.com")
    username = None
    password_hash = factory.LazyFunction(lambda: get_password_hash("password123"))
    name = factory.Faker("name")
    role = "teacher"
    teacher_id = None
    created_at = factory.LazyFunction(datetime.utcnow)
    updated_at = factory.LazyFunction(datetime.utcnow)


class StudentFactory(UserFactory):
    email = None
    username = factory.Sequence(lambda n: f"student{n:03d}")
    role = "student"


class WordFactory(factory.Factory):
    class Meta:
        model = Word

    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    english = factory.Faker("word")
    korean = factory.Sequence(lambda n: f"단어{n}")
    level = factory.Faker("random_int", min=1, max=15)
    category = "noun"
    created_at = factory.LazyFunction(datetime.utcnow)


class TestSessionFactory(factory.Factory):
    class Meta:
        model = TestSession

    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    test_type = "placement"
    total_questions = 20
    correct_count = 0
    determined_level = None
    score = None
    started_at = factory.LazyFunction(datetime.utcnow)
    completed_at = None


class TestAnswerFactory(factory.Factory):
    class Meta:
        model = TestAnswer

    id = factory.LazyFunction(lambda: str(uuid.uuid4()))
    selected_answer = None
    correct_answer = factory.Faker("word")
    is_correct = False
    question_order = factory.Sequence(lambda n: n + 1)
    answered_at = None
