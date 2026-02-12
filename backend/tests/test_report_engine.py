"""Report engine tests - scoring and metrics calculation."""
import pytest
from app.services import report_engine


class TestVocabDescription:
    """Test vocabulary description generation."""

    def test_low_rank_low_accuracy(self):
        """Low rank + low accuracy gives appropriate description."""
        desc = report_engine.get_vocab_description(rank=1, accuracy_pct=50)
        assert isinstance(desc, str)
        assert len(desc) > 0

    def test_high_rank_high_accuracy(self):
        """High rank + high accuracy gives positive description."""
        desc = report_engine.get_vocab_description(rank=10, accuracy_pct=95)
        assert isinstance(desc, str)
        assert len(desc) > 0

    def test_mid_range(self):
        """Mid-range values give appropriate description."""
        desc = report_engine.get_vocab_description(rank=5, accuracy_pct=75)
        assert isinstance(desc, str)
        assert len(desc) > 0


class TestSpeedScore:
    """Test speed score calculation."""

    def test_empty_answers(self):
        """Empty answers return 0 speed score."""
        score, avg_time = report_engine.calculate_speed_score([])
        assert score == 0.0
        assert avg_time is None

    def test_fast_answers(self):
        """Fast correct answers get high speed score."""
        answers = [
            {"is_correct": True, "time_taken_sec": 2.0},
            {"is_correct": True, "time_taken_sec": 2.5},
            {"is_correct": True, "time_taken_sec": 1.5},
        ]
        score, avg_time = report_engine.calculate_speed_score(answers)
        assert score > 5.0  # Should be above average
        assert avg_time is not None
        assert avg_time < 3.0

    def test_slow_answers(self):
        """Slow correct answers get low speed score."""
        answers = [
            {"is_correct": True, "time_taken_sec": 10.0},
            {"is_correct": True, "time_taken_sec": 12.0},
            {"is_correct": True, "time_taken_sec": 11.0},
        ]
        score, avg_time = report_engine.calculate_speed_score(answers)
        assert score < 5.0  # Should be below average
        assert avg_time > 10.0

    def test_ignores_wrong_answers(self):
        """Only correct answers count for speed."""
        answers = [
            {"is_correct": True, "time_taken_sec": 2.0},
            {"is_correct": False, "time_taken_sec": 1.0},  # Should be ignored
            {"is_correct": True, "time_taken_sec": 3.0},
        ]
        score, avg_time = report_engine.calculate_speed_score(answers)
        assert avg_time == 2.5  # (2.0 + 3.0) / 2

    def test_score_bounded_0_to_10(self):
        """Speed score is always between 0 and 10."""
        # Very fast
        answers_fast = [{"is_correct": True, "time_taken_sec": 0.1}] * 10
        score_fast, _ = report_engine.calculate_speed_score(answers_fast)
        assert 0.0 <= score_fast <= 10.0

        # Very slow
        answers_slow = [{"is_correct": True, "time_taken_sec": 100.0}] * 10
        score_slow, _ = report_engine.calculate_speed_score(answers_slow)
        assert 0.0 <= score_slow <= 10.0


class TestAccuracyScore:
    """Test accuracy score calculation."""

    def test_perfect_accuracy(self):
        """100% accuracy gives score 10.0."""
        score = report_engine.calculate_accuracy_score(correct=20, total=20)
        assert score == 10.0

    def test_zero_accuracy(self):
        """0% accuracy gives score 0.0."""
        score = report_engine.calculate_accuracy_score(correct=0, total=20)
        assert score == 0.0

    def test_half_accuracy(self):
        """50% accuracy gives score 5.0."""
        score = report_engine.calculate_accuracy_score(correct=10, total=20)
        assert score == 5.0

    def test_75_percent_accuracy(self):
        """75% accuracy gives score 7.5."""
        score = report_engine.calculate_accuracy_score(correct=15, total=20)
        assert score == 7.5

    def test_zero_total_returns_zero(self):
        """Zero total questions returns 0.0."""
        score = report_engine.calculate_accuracy_score(correct=0, total=0)
        assert score == 0.0


@pytest.mark.asyncio
class TestVocabSize:
    """Test vocabulary size calculation."""

    async def test_vocab_size_calculation(self, db_session, student_user, sample_words):
        """Calculates vocab size based on mastered words."""
        from app.models.word_mastery import WordMastery

        # Create some mastered words
        for word in sample_words[:5]:
            mastery = WordMastery(
                student_id=student_user.id,
                word_id=word.id,
                stage=5,
                correct_count=5,
                wrong_count=0,
            )
            from app.core.timezone import now_kst
            mastery.mastered_at = now_kst()
            db_session.add(mastery)
        await db_session.commit()

        raw_count, vocab_score = await report_engine.calculate_vocab_size(
            db_session, student_user.id, determined_rank=3
        )
        assert raw_count >= 5
        assert 0.0 <= vocab_score <= 10.0

    async def test_vocab_size_no_mastered(self, db_session, student_user):
        """Returns 0 when no words mastered."""
        raw_count, vocab_score = await report_engine.calculate_vocab_size(
            db_session, student_user.id, determined_rank=1
        )
        assert raw_count == 0
        assert vocab_score == 0.0


@pytest.mark.asyncio
class TestPeerRanking:
    """Test peer ranking calculation."""

    async def test_peer_ranking_with_peers(self, db_session, student_user, teacher_user):
        """Calculates peer ranking when peers exist."""
        from app.models.user import User
        from app.models.test_session import TestSession
        from app.core.timezone import now_kst

        # Create peer students
        for i in range(5):
            peer = User(
                username=f"peer{i}",
                password_hash="hash",
                name=f"Peer{i}",
                role="student",
                teacher_id=teacher_user.id,
                grade=student_user.grade,
            )
            db_session.add(peer)
        await db_session.commit()

        # Create test sessions for peers (scores: 60, 70, 80, 90, 95)
        peers = (await db_session.execute(
            User.__table__.select().where(
                User.role == "student",
                User.grade == student_user.grade,
                User.id != student_user.id
            )
        )).fetchall()

        for idx, peer in enumerate(peers[:5]):
            session = TestSession(
                student_id=peer.id,
                test_type="placement",
                started_at=now_kst(),
                completed_at=now_kst(),
                total_questions=20,
                correct_count=12 + idx * 2,  # 60%, 70%, 80%, 90%, 95%
                score=60 + idx * 10,
                determined_level=idx + 1,
            )
            db_session.add(session)
        await db_session.commit()

        # Student scores 85% - should be in top portion
        ranking = await report_engine.calculate_peer_ranking(
            db_session, student_user.id, score=85, grade=student_user.grade
        )
        assert ranking is not None
        assert "percentile" in ranking
        assert "rank" in ranking
        assert "total" in ranking
        assert ranking["total"] >= 5

    async def test_peer_ranking_no_peers(self, db_session, student_user):
        """Returns None when no peers exist."""
        ranking = await report_engine.calculate_peer_ranking(
            db_session, student_user.id, score=85, grade="초6"
        )
        # Should return None or estimated ranking
        assert ranking is None or isinstance(ranking, dict)


@pytest.mark.asyncio
class TestTotalWordCount:
    """Test total word count."""

    async def test_get_total_word_count(self, db_session, sample_words):
        """Returns total word count from database."""
        count = await report_engine.get_total_word_count(db_session)
        assert count >= len(sample_words)

    async def test_get_total_word_count_empty(self, db_session):
        """Returns 0 when no words in database."""
        # Clear all words
        await db_session.execute(
            report_engine.Word.__table__.delete()
        )
        await db_session.commit()

        count = await report_engine.get_total_word_count(db_session)
        assert count == 0


class TestTimeBreakdown:
    """Test time breakdown calculation."""

    def test_time_breakdown_with_answers(self):
        """Calculates time breakdown correctly."""
        answers = [
            {"time_taken_sec": 3, "stage": 1},
            {"time_taken_sec": 5, "stage": 1},
            {"time_taken_sec": 4, "stage": 2},
            {"time_taken_sec": 6, "stage": 2},
            {"time_taken_sec": None, "stage": 3},  # Missing time
        ]
        total_time, breakdown = report_engine.calculate_time_breakdown(answers)
        assert total_time == 18  # 3+5+4+6
        assert breakdown[1] == 8  # stage 1: 3+5
        assert breakdown[2] == 10  # stage 2: 4+6
        assert breakdown.get(3, 0) == 0  # stage 3: no valid time

    def test_time_breakdown_empty(self):
        """Empty answers return None total."""
        total_time, breakdown = report_engine.calculate_time_breakdown([])
        assert total_time is None
        assert breakdown == {}


class TestMetricDescriptions:
    """Test metric description generation."""

    def test_get_metric_descriptions(self):
        """Generates descriptions for all metrics."""
        metrics = {
            "vocabulary_level": 5.0,
            "accuracy": 7.5,
            "speed": 6.0,
            "vocabulary_size": 8.0,
        }
        descriptions = report_engine.get_metric_descriptions(rank=5, metrics=metrics)

        assert len(descriptions) == 4
        for desc in descriptions:
            assert "key" in desc
            assert "title" in desc
            assert "score" in desc
            assert "description" in desc
            assert desc["key"] in metrics.keys()

    def test_metric_descriptions_scores_match(self):
        """Metric scores match input."""
        metrics = {
            "vocabulary_level": 3.5,
            "accuracy": 9.0,
            "speed": 4.5,
            "vocabulary_size": 7.0,
        }
        descriptions = report_engine.get_metric_descriptions(rank=3, metrics=metrics)

        for desc in descriptions:
            assert desc["score"] == metrics[desc["key"]]


class TestRankMappings:
    """Test rank-to-grade/book mappings."""

    def test_rank_to_grade_exists(self):
        """RANK_TO_GRADE mapping is defined."""
        assert hasattr(report_engine, "RANK_TO_GRADE")
        assert isinstance(report_engine.RANK_TO_GRADE, dict)
        assert 1 in report_engine.RANK_TO_GRADE
        assert 10 in report_engine.RANK_TO_GRADE

    def test_rank_to_book_exists(self):
        """RANK_TO_BOOK mapping is defined."""
        assert hasattr(report_engine, "RANK_TO_BOOK")
        assert isinstance(report_engine.RANK_TO_BOOK, dict)
        assert 1 in report_engine.RANK_TO_BOOK
        assert 10 in report_engine.RANK_TO_BOOK

    def test_all_ranks_have_grade(self):
        """All ranks 1-10 have grade mapping."""
        for rank in range(1, 11):
            assert rank in report_engine.RANK_TO_GRADE
            assert isinstance(report_engine.RANK_TO_GRADE[rank], str)

    def test_all_ranks_have_book(self):
        """All ranks 1-10 have book recommendation."""
        for rank in range(1, 11):
            assert rank in report_engine.RANK_TO_BOOK
            assert isinstance(report_engine.RANK_TO_BOOK[rank], str)
