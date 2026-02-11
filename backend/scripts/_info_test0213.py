"""Show detailed info about TEST0213 assignment."""
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

async def main():
    from app.core.config import settings
    engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args={"statement_cache_size": 0})
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as s:
        # 1. Assignment info
        r = await s.execute(text("""
            SELECT ta.id, ta.test_code, ta.assignment_type, ta.status, ta.assigned_at,
                   tc.id as config_id, tc.name, tc.test_type, tc.question_count,
                   tc.time_limit_seconds, tc.per_question_time_seconds,
                   tc.level_range_min, tc.level_range_max,
                   tc.question_types, tc.book_name,
                   tc.lesson_range_start, tc.lesson_range_end, tc.is_active,
                   u.name as student_name, u.username as student_username,
                   t.name as teacher_name, t.username as teacher_username
            FROM test_assignments ta
            JOIN test_configs tc ON ta.test_config_id = tc.id
            JOIN users u ON ta.student_id = u.id
            JOIN users t ON ta.teacher_id = t.id
            WHERE ta.test_code = :code
        """), {"code": "TEST0213"})
        row = r.first()
        if not row:
            print("[ERROR] TEST0213 not found")
            return

        print("=" * 60)
        print("  TEST0213 상세 정보")
        print("=" * 60)
        print(f"\n  [과제 정보]")
        print(f"  Assignment ID : {row.id}")
        print(f"  Test Code     : {row.test_code}")
        print(f"  Assignment Type: {row.assignment_type}")
        print(f"  Status        : {row.status}")
        print(f"  Assigned At   : {row.assigned_at}")

        print(f"\n  [설정 정보]")
        print(f"  Config Name   : {row.name}")
        print(f"  Test Type     : {row.test_type}")
        print(f"  Questions     : {row.question_count}")
        print(f"  Time/Question : {row.per_question_time_seconds}s")
        print(f"  Total Time    : {row.time_limit_seconds}s")
        print(f"  Level Range   : {row.level_range_min} ~ {row.level_range_max}")
        print(f"  Question Types: {row.question_types}")
        print(f"  Book Name     : {row.book_name or '(전체)'}")
        print(f"  Lesson Range  : {row.lesson_range_start or '-'} ~ {row.lesson_range_end or '-'}")
        print(f"  Active        : {row.is_active}")

        print(f"\n  [사용자 정보]")
        print(f"  Student       : {row.student_name} ({row.student_username})")
        print(f"  Teacher       : {row.teacher_name} ({row.teacher_username})")

        # 2. Word distribution by level
        r2 = await s.execute(text("""
            SELECT level, COUNT(*) as cnt
            FROM words
            WHERE level >= :lv_min AND level <= :lv_max
            GROUP BY level ORDER BY level
        """), {"lv_min": row.level_range_min, "lv_max": row.level_range_max})
        levels = r2.all()
        total_words = sum(lv.cnt for lv in levels)

        print(f"\n  [대상 단어 분포] (총 {total_words}개)")
        print(f"  {'Level':>5} | {'단어수':>6} | {'예문확률':>8} | {'필요streak':>10}")
        print(f"  " + "-" * 45)

        def sentence_prob(lv):
            if lv <= 3: return 0.0
            elif lv <= 5: return 0.2
            elif lv <= 7: return 0.4
            elif lv <= 9: return 0.6
            elif lv <= 12: return 0.8
            else: return 1.0

        def required_streak(lv):
            if lv <= 3: return 2
            elif lv <= 6: return 3
            elif lv <= 9: return 4
            elif lv <= 12: return 5
            else: return 6

        for lv in levels:
            sp = sentence_prob(lv.level)
            rs = required_streak(lv.level)
            min_master = rs * 5
            print(f"  {lv.level:>5} | {lv.cnt:>6} | {sp*100:>6.0f}%  | {rs}회 (마스터 최소 {min_master}정답)")

        # 3. Mastery progress (if any)
        r3 = await s.execute(text("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN mastered_at IS NOT NULL THEN 1 ELSE 0 END) as mastered,
                   SUM(CASE WHEN stage = 1 THEN 1 ELSE 0 END) as s1,
                   SUM(CASE WHEN stage = 2 THEN 1 ELSE 0 END) as s2,
                   SUM(CASE WHEN stage = 3 THEN 1 ELSE 0 END) as s3,
                   SUM(CASE WHEN stage = 4 THEN 1 ELSE 0 END) as s4,
                   SUM(CASE WHEN stage = 5 THEN 1 ELSE 0 END) as s5
            FROM word_mastery wm
            JOIN test_assignments ta ON wm.assignment_id = ta.id
            WHERE ta.test_code = :code
        """), {"code": "TEST0213"})
        prog = r3.first()
        if prog and prog.total and prog.total > 0:
            print(f"\n  [학습 진행 현황]")
            print(f"  총 mastery 레코드: {prog.total}")
            print(f"  Stage 1 (씨앗) : {prog.s1}")
            print(f"  Stage 2 (새싹) : {prog.s2}")
            print(f"  Stage 3 (묘목) : {prog.s3}")
            print(f"  Stage 4 (나무) : {prog.s4}")
            print(f"  Stage 5 (열매) : {prog.s5}")
            print(f"  Mastered       : {prog.mastered}")
        else:
            print(f"\n  [학습 진행 현황] 아직 시작 전")

        # 4. Session info
        r4 = await s.execute(text("""
            SELECT ls.id, ls.current_stage, ls.words_practiced, ls.words_advanced,
                   ls.words_demoted, ls.best_combo, ls.started_at, ls.completed_at
            FROM learning_sessions ls
            JOIN test_assignments ta ON ls.assignment_id = ta.id
            WHERE ta.test_code = :code
            ORDER BY ls.started_at DESC LIMIT 1
        """), {"code": "TEST0213"})
        sess = r4.first()
        if sess:
            print(f"\n  [최근 세션]")
            print(f"  Session ID    : {sess.id}")
            print(f"  Current Stage : {sess.current_stage}")
            print(f"  Practiced     : {sess.words_practiced}")
            print(f"  Advanced      : {sess.words_advanced}")
            print(f"  Demoted       : {sess.words_demoted}")
            print(f"  Best Combo    : {sess.best_combo}")
            print(f"  Started       : {sess.started_at}")
            print(f"  Completed     : {sess.completed_at or '진행 중'}")

        print("\n" + "=" * 60)

    await engine.dispose()

asyncio.run(main())
