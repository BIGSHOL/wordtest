/**
 * Teacher view: student test result report.
 * Matches design screens ZDcZ1 (PC) and fZm1C (Mobile).
 */
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { RankBadge } from '../../components/test/RankBadge';
import { getLevelRank, RANKS } from '../../types/rank';
import {
  testService,
  type TestResultResponse,
  type TestSessionData,
  type AnswerDetail,
} from '../../services/test';
import { studentService } from '../../services/student';
import { statsService, type TestHistoryItem } from '../../services/stats';
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
} from 'lucide-react';
import type { User } from '../../types/auth';

/* ────────────────── helpers ────────────────── */

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}분 ${s}초`;
}

function computeDuration(session: TestSessionData): number | null {
  if (!session.completed_at || !session.started_at) return null;
  const diff =
    new Date(session.completed_at).getTime() -
    new Date(session.started_at).getTime();
  return Math.round(diff / 1000);
}

/* ────────────────── sub-components ────────────────── */

/** Student info card matching design o0TbN (PC) / AZDrN (mobile) */
function StudentInfoCard({
  student,
  session,
}: {
  student: User | null;
  session: TestSessionData;
}) {
  const initial = student?.name?.charAt(0) || '?';
  const schoolGrade = [student?.school_name, student?.grade ? `${student.grade}` : null]
    .filter(Boolean)
    .join(' · ');
  const testDate = session.started_at
    ? new Date(session.started_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '-';

  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-5 lg:p-6 w-full">
      {/* Top row: avatar + name */}
      <div className="flex items-center gap-3 lg:gap-4">
        <div
          className="w-11 h-11 lg:w-14 lg:h-14 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)',
          }}
        >
          <span className="text-white font-display text-lg lg:text-[22px] font-bold">
            {initial}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-base lg:text-xl font-bold text-text-primary truncate">
            {student?.name || '학생'}
          </h2>
          {schoolGrade && (
            <p className="text-xs lg:text-sm text-text-secondary">{schoolGrade}</p>
          )}
        </div>

        {/* PC: test info inline */}
        <div className="hidden lg:flex items-center gap-6">
          <InfoPill label="응시일" value={testDate} />
          <InfoPill label="문제수" value={`${session.total_questions}문제`} />
        </div>
      </div>

      {/* Mobile: test info row */}
      <div className="lg:hidden flex items-center gap-0 mt-3 pt-3 border-t border-[#E5E4E1]">
        <InfoPill label="응시일" value={testDate} className="flex-1" />
        <InfoPill label="문제수" value={`${session.total_questions}문제`} className="flex-1" />
      </div>
    </div>
  );
}

function InfoPill({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] lg:text-[11px] text-text-tertiary font-display font-medium">
        {label}
      </span>
      <span className="text-[13px] lg:text-sm font-display font-semibold text-text-primary">
        {value}
      </span>
    </div>
  );
}

/** 5-stat row matching design Bm6wq (PC) / 16V3a (mobile) */
function StatsRow({ session }: { session: TestSessionData }) {
  const accuracy =
    session.total_questions > 0
      ? Math.round((session.correct_count / session.total_questions) * 100)
      : 0;
  const wrongCount = session.total_questions - session.correct_count;
  const duration = computeDuration(session);
  const rank = session.determined_level ? getLevelRank(session.determined_level) : null;

  const stats = [
    {
      value: `${accuracy}%`,
      label: '정답률',
      color: '#4F46E5',
    },
    {
      value: `${session.correct_count}/${session.total_questions}`,
      label: '맞힌 문제',
      color: '#10B981',
    },
    {
      value: `${wrongCount}/${session.total_questions}`,
      label: '틀린 문제',
      color: '#EF4444',
    },
    {
      value: rank
        ? `Lv.${session.determined_level} ${rank.name}`
        : '-',
      label: '레벨/랭크',
      color: rank ? rank.colors[1] : '#6D6C6A',
      isRank: true,
      rank,
      level: session.determined_level,
    },
    {
      value: formatDuration(duration),
      label: '소요 시간',
      color: '#2D9CAE',
    },
  ];

  return (
    <>
      {/* PC: 5 in a row */}
      <div className="hidden lg:flex gap-4 w-full">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1.5 rounded-2xl bg-white border border-border-subtle py-5 px-4"
          >
            {s.isRank && s.rank && s.level ? (
              <div className="flex items-center gap-2">
                <RankBadge rank={s.rank} size="sm" />
                <span
                  className="font-display text-lg font-bold"
                  style={{ color: s.color }}
                >
                  Lv.{s.level} {s.rank.name}
                </span>
              </div>
            ) : (
              <span
                className="font-display text-[28px] lg:text-[32px] font-bold"
                style={{ color: s.color, letterSpacing: -1 }}
              >
                {s.value}
              </span>
            )}
            <span className="font-display text-xs text-text-tertiary font-medium">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile: grid layout (2-2-1) */}
      <div className="lg:hidden flex flex-col gap-2.5 w-full">
        <div className="flex gap-2.5">
          {stats.slice(0, 2).map((s, i) => (
            <MobileStatCard key={i} {...s} />
          ))}
        </div>
        <div className="flex gap-2.5">
          {stats.slice(2, 4).map((s, i) => (
            <MobileStatCard key={i + 2} {...s} />
          ))}
        </div>
        <MobileStatCard {...stats[4]} />
      </div>
    </>
  );
}

function MobileStatCard({
  value,
  label,
  color,
  isRank,
  rank,
  level,
}: {
  value: string;
  label: string;
  color: string;
  isRank?: boolean;
  rank?: ReturnType<typeof getLevelRank> | null;
  level?: number | null;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 rounded-[14px] bg-white py-3.5 px-3">
      {isRank && rank && level ? (
        <span className="font-display text-xl font-extrabold" style={{ color }}>
          Lv.{level} {rank.name}
        </span>
      ) : (
        <span
          className="font-display text-2xl font-extrabold"
          style={{ color, letterSpacing: -1 }}
        >
          {value}
        </span>
      )}
      <span className="font-display text-[11px] text-text-secondary font-medium">
        {label}
      </span>
    </div>
  );
}

/** Accuracy trend bar chart matching design i99gz (PC) / xjuDR (mobile) */
function AccuracyChart({ history }: { history: TestHistoryItem[] }) {
  if (history.length < 2) return null;

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const diff = latest.accuracy - prev.accuracy;
  const diffText =
    diff >= 0 ? `+${diff}% 상승` : `${diff}% 하락`;
  const diffColor = diff >= 0 ? '#2D9CAE' : '#EF4444';
  const diffBg = diff >= 0 ? '#EBF8FA' : '#FEF2F2';

  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-4 lg:p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
          정답률 추이
        </h3>
        <span
          className="text-[11px] lg:text-xs font-display font-semibold px-2.5 py-1 rounded-lg"
          style={{ color: diffColor, backgroundColor: diffBg }}
        >
          {diffText}
        </span>
      </div>
      <div className="flex items-end gap-0 h-[120px] lg:h-[160px]">
        {history.slice(-5).map((item, i) => {
          const barH = Math.max(item.accuracy * 1.1, 10);
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-8 lg:w-9 rounded-t-lg"
                style={{
                  height: `${barH}%`,
                  background:
                    'linear-gradient(180deg, #818CF8, #4F46E5)',
                }}
              />
              <span className="text-[10px] font-bold text-accent-indigo">
                {item.accuracy}%
              </span>
              <span className="text-[9px] text-text-tertiary">
                {item.test_date}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Level progression chart matching design sTc4H (PC) */
function LevelChart({ history }: { history: TestHistoryItem[] }) {
  const leveled = history.filter((h) => h.determined_level != null);
  if (leveled.length < 2) return null;

  const latest = leveled[leveled.length - 1];
  const latestRank = latest.determined_level
    ? getLevelRank(latest.determined_level)
    : null;

  const barColors: Record<number, { bg: string; fill: string }> = {};
  for (let i = 1; i <= 10; i++) {
    const r = RANKS[Math.min(i - 1, RANKS.length - 1)];
    barColors[i] = {
      bg: `${r.colors[0]}20`,
      fill: r.colors[0],
    };
  }

  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-4 lg:p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
          레벨 변화
        </h3>
        {latestRank && (
          <span
            className="text-[11px] lg:text-xs font-display font-semibold px-2.5 py-1 rounded-lg"
            style={{
              color: latestRank.colors[1],
              backgroundColor: `${latestRank.colors[0]}20`,
            }}
          >
            {latestRank.name} 달성
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {leveled.slice(-5).map((item, i) => {
          const level = item.determined_level || 1;
          const pct = Math.round((level / 10) * 100);
          const colors = barColors[level] || barColors[1];
          const rank = getLevelRank(level);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[11px] text-text-tertiary font-display font-medium w-10 shrink-0">
                {item.test_date}
              </span>
              <div
                className="flex-1 h-7 rounded-lg relative overflow-hidden"
                style={{ backgroundColor: colors.bg }}
              >
                <div
                  className="h-full rounded-lg flex items-center px-2"
                  style={{
                    width: `${Math.max(pct, 15)}%`,
                    backgroundColor: colors.fill,
                  }}
                >
                  <span className="text-[11px] text-white font-display font-semibold whitespace-nowrap">
                    Lv.{level} {rank.name}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Wrong words analysis table matching design gXsvX (PC) / AFpi3 (mobile) */
function WrongAnalysis({ answers }: { answers: AnswerDetail[] }) {
  const wrong = answers.filter((a) => !a.is_correct);
  if (wrong.length === 0) return null;

  return (
    <>
      {/* PC: Table */}
      <div className="hidden lg:block rounded-2xl bg-white border border-border-subtle overflow-hidden w-full">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-base font-bold text-text-primary">
              틀린 단어 분석
            </h3>
            <span className="text-xs font-bold text-wrong bg-wrong-light px-2.5 py-0.5 rounded-full">
              {wrong.length}개
            </span>
          </div>
        </div>
        <div className="bg-[#F8F8F6] flex items-center h-11 px-6 border-y border-border-subtle">
          <span className="w-12 text-xs font-semibold text-text-tertiary">#</span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">단어</span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">
            뜻 (정답)
          </span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">학생 답변</span>
        </div>
        {wrong.map((a) => (
          <div
            key={a.question_order}
            className="flex items-center h-12 px-6 border-b border-border-subtle last:border-b-0"
          >
            <span className="w-12 text-sm font-bold text-text-secondary font-mono">
              {a.question_order}.
            </span>
            <span className="flex-1 text-sm font-semibold text-text-primary font-word">
              {a.word_english}
            </span>
            <span className="flex-1 text-[13px] font-medium text-correct font-display">
              {a.correct_answer}
            </span>
            <span className="flex-1 text-[13px] font-medium text-wrong font-display">
              {a.selected_answer || '미응답'}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile: Card layout */}
      <div className="lg:hidden flex flex-col gap-2.5 w-full">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-bold text-text-primary">
            틀린 단어 분석
          </h3>
          <span className="text-[11px] font-bold text-wrong bg-wrong-light px-2 py-0.5 rounded-lg">
            {wrong.length}개
          </span>
        </div>
        {wrong.map((a) => (
          <div
            key={a.question_order}
            className="rounded-xl bg-white p-3 px-3.5 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-wrong font-word">
                {a.word_english}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-tertiary">
                학생: {a.selected_answer || '미응답'}
              </span>
              <span className="text-text-tertiary">&rarr;</span>
              <span className="text-correct font-semibold">{a.correct_answer}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** O/X Grid matching design eDl6m (PC) / soooi (mobile) */
function OXGrid({
  answers,
  session,
}: {
  answers: AnswerDetail[];
  session: TestSessionData;
}) {
  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-5 lg:p-6 w-full">
      <div className="flex items-center gap-2.5 mb-4">
        <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
          문제별 결과
        </h3>
        <span className="text-[11px] font-bold text-teal bg-teal-light px-2 py-0.5 rounded-lg font-display">
          {session.total_questions}문제
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 lg:gap-2">
        {answers.map((a) => (
          <div
            key={a.question_order}
            className={`flex flex-col items-center justify-center rounded-lg lg:rounded-[10px] w-11 h-12 lg:w-[52px] lg:h-16 ${
              a.is_correct ? 'bg-[#ECFDF5]' : 'bg-[#FEF2F2]'
            }`}
            title={`${a.question_order}. ${a.word_english}`}
          >
            <span
              className={`text-[9px] font-display font-semibold ${
                a.is_correct ? 'text-[#065F46]' : 'text-[#991B1B]'
              }`}
            >
              {a.question_order}
            </span>
            {a.is_correct ? (
              <CircleCheck className="w-3.5 h-3.5 text-correct" />
            ) : (
              <CircleX className="w-3.5 h-3.5 text-wrong" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────── main page ────────────────── */

export function StudentResultPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<User | null>(null);
  const [tests, setTests] = useState<TestSessionData[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<TestResultResponse | null>(null);
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsLoadingResult] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [studentsData, testsData] = await Promise.all([
          studentService.listStudents(),
          testService.listTests(studentId),
        ]);
        const foundStudent = studentsData.find((s) => s.id === studentId);
        setStudent(foundStudent || null);
        setTests(testsData.tests);

        // Load history for charts
        try {
          const histData = await statsService.getStudentHistory(studentId);
          setHistory(histData.history);
        } catch {
          // stats endpoint might not exist yet
        }

        // Auto-select latest test
        if (testsData.tests.length > 0) {
          viewResult(testsData.tests[0].id);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [studentId]);

  const viewResult = async (testId: string) => {
    setIsLoadingResult(true);
    setSelectedTestId(testId);
    try {
      const result = await testService.getTestResult(testId);
      setSelectedResult(result);
    } catch (error) {
      console.error('Failed to load result:', error);
    } finally {
      setIsLoadingResult(false);
    }
  };

  /* ── PC layout (sidebar already in TeacherLayout) ── */
  return (
    <TeacherLayout>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/students"
                className="w-9 h-9 rounded-[10px] bg-white border border-border-subtle flex items-center justify-center hover:bg-bg-muted transition-colors"
              >
                <ArrowLeft className="w-[18px] h-[18px] text-text-primary" />
              </Link>
              <div>
                <h1 className="font-display text-lg font-bold text-text-primary">
                  학생 리포트
                </h1>
                <p className="text-[13px] text-text-secondary">
                  {student?.name || '학생'}
                  {student?.school_name ? ` · ${student.school_name}` : ''}
                  {student?.grade ? ` ${student.grade}` : ''}
                </p>
              </div>
            </div>
          </div>

          {selectedResult ? (
            <div className="space-y-4 lg:space-y-6">
              {/* Student info card */}
              <StudentInfoCard
                student={student}
                session={selectedResult.test_session}
              />

              {/* Stats row */}
              <StatsRow session={selectedResult.test_session} />

              {/* Charts row (PC: side by side, Mobile: stacked) */}
              {history.length >= 2 && (
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <AccuracyChart history={history} />
                  </div>
                  <div className="flex-1">
                    <LevelChart history={history} />
                  </div>
                </div>
              )}

              {/* Wrong word analysis */}
              <WrongAnalysis answers={selectedResult.answers} />

              {/* O/X Grid */}
              <OXGrid
                answers={selectedResult.answers}
                session={selectedResult.test_session}
              />

              {/* Test history selector (if multiple tests) */}
              {tests.length > 1 && (
                <div className="rounded-2xl bg-white border border-border-subtle overflow-hidden">
                  <div className="px-5 py-4 border-b border-border-subtle">
                    <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
                      다른 테스트 결과 보기
                    </h3>
                  </div>
                  <div className="divide-y divide-border-subtle max-h-60 overflow-y-auto">
                    {tests.map((test) => (
                      <button
                        key={test.id}
                        onClick={() => viewResult(test.id)}
                        className={`w-full text-left px-5 py-3 flex items-center justify-between transition-colors ${
                          selectedTestId === test.id
                            ? 'bg-teal-light'
                            : 'hover:bg-bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                              test.test_type === 'placement'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {test.test_type === 'placement' ? '배치' : '정기'}
                          </span>
                          <span className="text-sm font-semibold text-text-primary">
                            {test.correct_count}/{test.total_questions}
                          </span>
                          {test.score !== null && (
                            <span className="text-sm text-text-secondary">
                              ({test.score}점)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-text-secondary">
                          {new Date(test.started_at).toLocaleDateString('ko-KR')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-border-subtle rounded-2xl p-12 text-center">
              <p className="text-text-secondary font-display">
                {tests.length === 0
                  ? '테스트 기록이 없습니다.'
                  : '결과를 불러오는 중...'}
              </p>
            </div>
          )}

          {/* Mobile bottom button */}
          <div className="lg:hidden pb-6">
            <Link
              to="/students"
              className="flex items-center justify-center h-[52px] rounded-2xl bg-teal text-white font-display text-base font-bold w-full"
            >
              돌아가기
            </Link>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}

export default StudentResultPage;
