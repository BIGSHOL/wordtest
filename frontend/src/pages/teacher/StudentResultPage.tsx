/**
 * Teacher view: student test results (enhanced version).
 */
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { LevelBadge } from '../../components/test/LevelBadge';
import { testService, type TestResultResponse, type TestSessionData } from '../../services/test';
import { studentService } from '../../services/student';
import { ArrowLeft, CircleCheck, CircleX, User } from 'lucide-react';
import type { User as UserType } from '../../types/auth';

export function StudentResultPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<UserType | null>(null);
  const [tests, setTests] = useState<TestSessionData[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<TestResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResult, setIsLoadingResult] = useState(false);

  useEffect(() => {
    if (!studentId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [studentsData, testsData] = await Promise.all([
          studentService.listStudents(),
          testService.listTests(studentId),
        ]);

        const foundStudent = studentsData.find((s) => s.id === studentId);
        setStudent(foundStudent || null);
        setTests(testsData.tests);
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

  // Calculate stats
  const wrongAnswers = selectedResult?.answers.filter((a) => !a.is_correct) || [];
  const correctPercentage = selectedResult
    ? Math.round(
        (selectedResult.test_session.correct_count / selectedResult.test_session.total_questions) * 100
      )
    : 0;

  return (
    <TeacherLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Student Info Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/students"
            className="p-2 rounded-lg hover:bg-bg-muted transition-colors text-text-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-3 flex-1">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-teal-light flex items-center justify-center">
              <span className="text-lg font-semibold text-teal">
                {student?.name?.charAt(0) || <User className="w-6 h-6" />}
              </span>
            </div>

            {/* Student Name + Test Count */}
            <div>
              <h1 className="text-2xl font-display font-bold text-text-primary">
                {isLoading ? '로딩 중...' : student?.name || '학생'}
              </h1>
              <p className="text-sm text-text-secondary">
                총 {tests.length}개의 테스트
              </p>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - Test History List */}
          <div className="lg:col-span-2">
            <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border-subtle">
                <h2 className="text-lg font-semibold text-text-primary">테스트 이력</h2>
              </div>

              {isLoading ? (
                <div className="p-8 text-center text-text-secondary">로딩 중...</div>
              ) : tests.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">
                  테스트 기록이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {tests.map((test) => (
                    <div
                      key={test.id}
                      onClick={() => viewResult(test.id)}
                      className={`px-5 py-4 cursor-pointer transition-colors ${
                        selectedTestId === test.id
                          ? 'bg-teal-light'
                          : 'hover:bg-bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full font-medium ${
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
                          <p className="text-xs text-text-secondary">
                            {new Date(test.started_at).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>

                        {test.determined_level && (
                          <LevelBadge level={test.determined_level} size="sm" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Selected Test Detail */}
          <div className="lg:col-span-3">
            {isLoadingResult ? (
              <div className="bg-surface border border-border-subtle rounded-xl p-12 text-center">
                <p className="text-text-secondary">결과를 불러오는 중...</p>
              </div>
            ) : selectedResult ? (
              <div className="space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Accuracy */}
                  <div className="bg-surface border border-border-subtle rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <CircleCheck className="w-6 h-6 text-teal" />
                    </div>
                    <p className="text-2xl font-bold text-text-primary">{correctPercentage}%</p>
                    <p className="text-xs text-text-secondary mt-1">정답률</p>
                  </div>

                  {/* Correct Count */}
                  <div className="bg-surface border border-border-subtle rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <CircleCheck className="w-6 h-6 text-correct" />
                    </div>
                    <p className="text-2xl font-bold text-correct">
                      {selectedResult.test_session.correct_count}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">맞힌 문제</p>
                  </div>

                  {/* Wrong Count */}
                  <div className="bg-surface border border-border-subtle rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <CircleX className="w-6 h-6 text-wrong" />
                    </div>
                    <p className="text-2xl font-bold text-wrong">{wrongAnswers.length}</p>
                    <p className="text-xs text-text-secondary mt-1">틀린 문제</p>
                  </div>

                  {/* Level */}
                  <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col items-center justify-center">
                    {selectedResult.test_session.determined_level ? (
                      <>
                        <LevelBadge
                          level={selectedResult.test_session.determined_level}
                          size="sm"
                        />
                        <p className="text-xs text-text-secondary mt-2">측정 레벨</p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-text-tertiary">-</p>
                        <p className="text-xs text-text-secondary mt-1">레벨</p>
                      </>
                    )}
                  </div>
                </div>

                {/* O/X Grid */}
                <div className="bg-surface border border-border-subtle rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">문제별 정답 현황</h3>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                    {selectedResult.answers.map((answer) => (
                      <div
                        key={answer.question_order}
                        className={`flex flex-col items-center justify-center rounded-lg h-14 transition-colors ${
                          answer.is_correct
                            ? 'bg-correct-light hover:bg-correct-light/80'
                            : 'bg-wrong-light hover:bg-wrong-light/80'
                        }`}
                        title={`${answer.question_order}. ${answer.word_english}`}
                      >
                        <span
                          className={`text-xs font-bold ${
                            answer.is_correct ? 'text-[#065F46]' : 'text-[#991B1B]'
                          }`}
                        >
                          {answer.question_order}
                        </span>
                        {answer.is_correct ? (
                          <CircleCheck className="w-4 h-4 text-correct" />
                        ) : (
                          <CircleX className="w-4 h-4 text-wrong" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Wrong Words Table */}
                {wrongAnswers.length > 0 && (
                  <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border-subtle">
                      <h3 className="text-lg font-semibold text-text-primary">틀린 단어</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-bg-muted">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary w-16">
                              #
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                              단어
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                              학생 답
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                              정답
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {wrongAnswers.map((answer) => (
                            <tr key={answer.question_order} className="hover:bg-bg-muted/50">
                              <td className="px-4 py-3 text-sm text-text-secondary">
                                {answer.question_order}
                              </td>
                              <td className="px-4 py-3 text-sm font-word font-medium text-text-primary">
                                {answer.word_english}
                              </td>
                              <td className="px-4 py-3 text-sm text-wrong font-medium line-through">
                                {answer.selected_answer || '미응답'}
                              </td>
                              <td className="px-4 py-3 text-sm text-correct font-medium">
                                {answer.correct_answer}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* All Answers Table */}
                <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border-subtle">
                    <h3 className="text-lg font-semibold text-text-primary">전체 답안</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary w-16">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                            단어
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                            학생 답
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                            정답
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary w-16">
                            결과
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {selectedResult.answers.map((answer) => (
                          <tr
                            key={answer.question_order}
                            className={`hover:bg-bg-muted/50 ${
                              answer.is_correct ? '' : 'bg-wrong-light/30'
                            }`}
                          >
                            <td className="px-4 py-3 text-sm text-text-secondary">
                              {answer.question_order}
                            </td>
                            <td className="px-4 py-3 text-sm font-word font-medium text-text-primary">
                              {answer.word_english}
                            </td>
                            <td
                              className={`px-4 py-3 text-sm font-medium ${
                                answer.is_correct
                                  ? 'text-text-primary'
                                  : 'text-wrong line-through'
                              }`}
                            >
                              {answer.selected_answer || '미응답'}
                            </td>
                            <td className="px-4 py-3 text-sm text-text-primary font-medium">
                              {answer.correct_answer}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {answer.is_correct ? (
                                <CircleCheck className="w-5 h-5 text-correct inline" />
                              ) : (
                                <CircleX className="w-5 h-5 text-wrong inline" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border-subtle rounded-xl p-12 text-center">
                <p className="text-text-secondary">
                  테스트를 선택하여 상세 결과를 확인하세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default StudentResultPage;
