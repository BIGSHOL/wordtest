/**
 * Teacher view: student test result report.
 * Redesigned to match MasteryReportPage design (logo header, rank badge, collapsible sections).
 */
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import {
  testService,
  type TestSessionData,
} from '../../services/test';
import { studentService } from '../../services/student';
import { statsService } from '../../services/stats';
import {
  ArrowLeft, Printer, Shield, Sword, Award, Crown, Gem, Diamond, Star, Flame, Trophy,
  ChevronDown,
} from 'lucide-react';
import type { User } from '../../types/auth';
import type { EnhancedTestReport } from '../../types/report';
import { getLevelRank } from '../../types/rank';
import { RadarChart } from '../../components/report/RadarChart';
import { LevelChartTable } from '../../components/report/LevelChartTable';
import { MetricDetailSection } from '../../components/report/MetricDetailSection';
import { logger } from '../../utils/logger';

const RANK_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  shield: Shield, sword: Sword, award: Award, crown: Crown, gem: Gem,
  diamond: Diamond, star: Star, flame: Flame, trophy: Trophy,
};

const LEVEL_NAMES: Record<number, string> = {
  1: 'Iron', 2: 'Bronze', 3: 'Silver', 4: 'Gold', 5: 'Platinum',
  6: 'Emerald', 7: 'Diamond', 8: 'Master', 9: 'Grandmaster',
  10: 'Challenger',
  11: 'LEGEND', 12: 'LEGEND', 13: 'LEGEND', 14: 'LEGEND', 15: 'LEGEND',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full group"
      >
        <h3 className="text-base font-semibold text-[#0D0D0D]">{title}</h3>
        <ChevronDown
          className="w-5 h-5 text-[#7A7A7A] transition-transform duration-200 group-hover:text-[#0D0D0D]"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function StudentResultPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<User | null>(null);
  const [tests, setTests] = useState<TestSessionData[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [report, setReport] = useState<EnhancedTestReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

        if (testsData.tests.length > 0) {
          loadReport(studentId, testsData.tests[0].id);
        }
      } catch (error) {
        logger.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [studentId]);

  const loadReport = async (sid: string, testId: string) => {
    setSelectedTestId(testId);
    try {
      const data = await statsService.getEnhancedReport(sid, testId);
      setReport(data);
    } catch (error) {
      logger.error('Failed to load report:', error);
    }
  };

  const level = report?.test_session.determined_level || 1;
  const levelName = LEVEL_NAMES[level] || '';

  return (
    <TeacherLayout>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-[900px] min-w-[860px] mx-auto space-y-6 py-6 px-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/students"
                className="w-9 h-9 rounded-[10px] bg-white border border-border-subtle flex items-center justify-center hover:bg-bg-muted transition-colors"
              >
                <ArrowLeft className="w-[18px] h-[18px] text-text-primary" />
              </Link>
              <h1 className="font-display text-lg font-bold text-text-primary">
                학생 리포트
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="h-9 px-[14px] rounded-lg bg-white border border-border-subtle text-text-secondary text-sm font-semibold flex items-center gap-2 hover:bg-bg-muted transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>인쇄</span>
              </button>
            </div>
          </div>

          {report ? (
            <div className="bg-white rounded-2xl border border-border-subtle p-8 space-y-8">
              {/* 1. Header with logo + student info table */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col items-start gap-1">
                    <img src="/images/logo-joshua.png" alt="Logo" className="h-10 w-auto" />
                    <span className="text-[#0D0D0D] text-sm font-medium tracking-tight">
                      조슈아 영단어 레벨테스트
                    </span>
                  </div>
                  <table className="border-collapse border border-[#D0D0D0] text-xs">
                    <tbody>
                      <tr>
                        <td className="bg-[#F5F5F5] px-3 py-1.5 font-semibold text-[#333] border-r border-[#D0D0D0] whitespace-nowrap w-[60px]">이름</td>
                        <td className="px-3 py-1.5 text-[#0D0D0D] border-r border-[#D0D0D0] whitespace-nowrap min-w-[80px]">{student?.name || '-'}</td>
                        <td className="bg-[#F5F5F5] px-3 py-1.5 font-semibold text-[#333] border-r border-[#D0D0D0] whitespace-nowrap w-[60px]">학년</td>
                        <td className="px-3 py-1.5 text-[#0D0D0D] whitespace-nowrap min-w-[60px]">{student?.grade || '-'}</td>
                      </tr>
                      <tr className="border-t border-[#D0D0D0]">
                        <td className="bg-[#F5F5F5] px-3 py-1.5 font-semibold text-[#333] border-r border-[#D0D0D0] whitespace-nowrap">소속학원</td>
                        <td className="px-3 py-1.5 text-[#0D0D0D] border-r border-[#D0D0D0] whitespace-nowrap">{student?.school_name || '조슈아 영어 학원'}</td>
                        <td className="bg-[#F5F5F5] px-3 py-1.5 font-semibold text-[#333] border-r border-[#D0D0D0] whitespace-nowrap">응시일</td>
                        <td className="px-3 py-1.5 text-[#0D0D0D] whitespace-nowrap">
                          {report.test_session.started_at
                            ? new Date(report.test_session.started_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                            : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="h-[2px] bg-[#CC0000]" />
              </div>

              {/* 2. Overview row */}
              <CollapsibleSection title="종합 학습 결과">
                <div className="flex gap-5">
                  {/* Left: Overall result */}
                  <div className="flex-1 border border-[#E8E8E8] rounded-sm p-5 space-y-4 bg-[#FAFAFA]">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-[#7A7A7A]">추천 교재</p>
                        <p className="text-sm font-semibold text-[#CC0000]">{report.recommended_book}</p>
                      </div>
                      {(() => {
                        const rank = getLevelRank(level);
                        const Icon = RANK_ICON_MAP[rank.icon] || Award;
                        const [c0, c1] = rank.colors;
                        return (
                          <div className="relative flex flex-col items-center gap-1">
                            <div className="relative w-[76px] h-[76px] flex items-center justify-center">
                              <div
                                className="absolute inset-0 rounded-full animate-[spin_8s_linear_infinite]"
                                style={{
                                  background: `conic-gradient(from 0deg, ${c0}00, ${c0}BB, ${c1}BB, ${c0}00)`,
                                  mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
                                  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
                                }}
                              />
                              <div
                                className="absolute rounded-full animate-[pulse_3s_ease-in-out_infinite]"
                                style={{ inset: 4, background: `radial-gradient(circle, ${c0}20 0%, ${c0}00 70%)` }}
                              />
                              <div
                                className="w-[68px] h-[68px] rounded-full flex flex-col items-center justify-center relative z-10"
                                style={{ background: `linear-gradient(160deg, ${c0}28, ${c1}18)`, border: `2.5px solid ${c1}90` }}
                              >
                                <Icon style={{ color: c1, width: 20, height: 20 }} />
                                <span className="text-[11px] font-bold leading-none mt-0.5" style={{ color: c1 }}>Lv.{level}</span>
                              </div>
                            </div>
                            <span className="text-[9px] font-semibold" style={{ color: c1 }}>{levelName}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 border border-[#CC0000] rounded p-2.5 text-center space-y-1">
                        <p className="text-xs font-bold text-[#CC0000]">학년수준</p>
                        <p className="text-xs font-semibold text-[#0D0D0D] leading-tight">{report.grade_level}</p>
                      </div>
                      <div className="flex-1 border border-[#CC0000] rounded p-2.5 text-center space-y-1">
                        <p className="text-xs font-bold text-[#CC0000]">어휘수준</p>
                        <p className="text-xs font-semibold text-[#0D0D0D] leading-tight">{report.vocab_description}</p>
                      </div>
                      <div className="flex-1 border border-[#CC0000] rounded p-2.5 text-center space-y-1">
                        <p className="text-xs font-bold text-[#CC0000]">동학년순위</p>
                        <p className="text-xs font-semibold text-[#0D0D0D] leading-tight">
                          {report.peer_ranking ? `상위 ${report.peer_ranking.percentile}%` : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Center: Radar chart */}
                  <RadarChart metrics={report.radar_metrics} />

                  {/* Right: Stats summary */}
                  <div className="w-[180px] shrink-0 border border-[#E8E8E8] rounded-sm p-5 space-y-3 bg-[#FAFAFA]">
                    <h3 className="text-base font-semibold text-[#0D0D0D]">학습 통계</h3>
                    <div className="space-y-1">
                      <p className="text-xs text-[#7A7A7A]">소요시간</p>
                      <p className="text-lg font-bold text-[#CC0000]">
                        {report.total_time_seconds != null ? formatTime(report.total_time_seconds) : '-'}
                      </p>
                    </div>
                    <div className="h-px bg-[#E8E8E8]" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#7A7A7A]">총 문제수</span>
                      <span className="text-xs font-medium text-[#0D0D0D]">{report.test_session.total_questions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#7A7A7A]">정답률</span>
                      <span className="text-xs font-medium text-[#0D0D0D]">{report.test_session.score}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#7A7A7A]">정답수</span>
                      <span className="text-xs font-medium text-[#0D0D0D]">{report.test_session.correct_count}개</span>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* 3. Level Chart */}
              <CollapsibleSection title="레벨 차트">
                <LevelChartTable currentRank={level} />
              </CollapsibleSection>

              {/* 4. Metric Detail Section */}
              <CollapsibleSection title="학습 역량 분석">
                <MetricDetailSection details={report.metric_details} />
              </CollapsibleSection>

              {/* 5. Wrong answers analysis */}
              {(() => {
                const wrongAnswers = report.answers.filter((a) => !a.is_correct);
                return wrongAnswers.length > 0 && (
                  <CollapsibleSection title="오답 분석">
                    <div className="border border-[#E8E8E8] rounded overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#FEF2F2]">
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#DC2626]">번호</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#DC2626]">단어</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#DC2626]">정답</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#DC2626]">내 답</th>
                            <th className="px-3 py-2.5 text-center text-xs font-semibold text-[#DC2626]">소요시간</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wrongAnswers.map((a) => (
                            <tr key={a.question_order} className="border-t border-[#F0F0F0]">
                              <td className="px-3 py-2 text-[#7A7A7A]">{a.question_order}</td>
                              <td className="px-3 py-2 font-medium text-[#0D0D0D]">{a.word_english}</td>
                              <td className="px-3 py-2 text-green-600">{a.correct_answer}</td>
                              <td className="px-3 py-2 text-red-500">{a.selected_answer || '(시간초과)'}</td>
                              <td className="px-3 py-2 text-center text-[#7A7A7A]">
                                {a.time_taken_seconds != null ? `${a.time_taken_seconds}초` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                );
              })()}
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

          {/* Test history selector */}
          {tests.length > 1 && (
            <div className="rounded-2xl bg-white border border-border-subtle overflow-hidden">
              <div className="px-5 py-4 border-b border-border-subtle">
                <h3 className="font-display text-sm font-bold text-text-primary">
                  다른 테스트 결과 보기
                </h3>
              </div>
              <div className="divide-y divide-border-subtle max-h-60 overflow-y-auto">
                {tests.map((test) => (
                  <button
                    key={test.id}
                    onClick={() =>
                      studentId && loadReport(studentId, test.id)
                    }
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
      )}
    </TeacherLayout>
  );
}

export default StudentResultPage;
