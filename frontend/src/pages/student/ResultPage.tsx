/**
 * Student test result page - redesigned to match Pencil design style.
 * Uses same report components as teacher view but with student-specific layout.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { List, ChevronRight, LogIn } from 'lucide-react';
import { useTestStore } from '../../stores/testStore';
import { useAuthStore } from '../../stores/auth';
import { statsService } from '../../services/stats';
import { playSound } from '../../hooks/useSound';
import type { EnhancedTestReport } from '../../types/report';

import { ReportHeader } from '../../components/report/ReportHeader';
import { OverallResult } from '../../components/report/OverallResult';
import { RadarChart } from '../../components/report/RadarChart';
import { TimeBreakdown } from '../../components/report/TimeBreakdown';
import { LevelChartTable } from '../../components/report/LevelChartTable';
import { MetricDetailSection } from '../../components/report/MetricDetailSection';

export function ResultPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { wrongAnswers } = useTestStore();
  const user = useAuthStore((s) => s.user);
  const isCodeOnlyUser = !user?.username;
  const homePath = isCodeOnlyUser ? '/test/start' : '/student';
  const [report, setReport] = useState<EnhancedTestReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const soundPlayed = useRef(false);

  useEffect(() => {
    if (!testId || !user) return;
    setIsLoading(true);
    statsService
      .getEnhancedReport(user.id, testId)
      .then(setReport)
      .catch((err) => {
        setError(err.response?.data?.detail || '결과를 불러올 수 없습니다.');
      })
      .finally(() => setIsLoading(false));
  }, [testId, user]);

  // Play result sound once
  useEffect(() => {
    if (!report || soundPlayed.current) return;
    soundPlayed.current = true;
    const { test_session: s } = report;
    const total = s.total_questions;
    const correct = s.correct_count;
    if (total > 0 && correct === total) {
      playSound('perfect');
    } else if (total > 0 && correct / total >= 0.7) {
      playSound('lvlup');
    } else {
      playSound('lvldown');
    }
  }, [report]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#CC0000] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-wrong font-display font-medium">
            {error || '결과를 찾을 수 없습니다.'}
          </p>
          <button
            onClick={() => navigate(homePath, { replace: true })}
            className="px-4 py-2 bg-[#CC0000] text-white rounded-lg font-display hover:opacity-90 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const { test_session: session, answers } = report;
  const wrongItems =
    wrongAnswers.length > 0
      ? wrongAnswers.map((w) => ({ ...w, timeTaken: undefined as number | undefined }))
      : answers
          .filter((a) => !a.is_correct)
          .map((a) => ({
            english: a.word_english,
            correctAnswer: a.correct_answer,
            selectedAnswer: a.selected_answer || '',
            timeTaken: a.time_taken_seconds ?? undefined,
          }));
  const previewWrong = wrongItems.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F9F9F7] flex flex-col md:items-center">
      <div className="flex-1 overflow-y-auto w-full md:max-w-[900px] p-6 space-y-6">
        {/* Report card */}
        <div className="bg-white rounded-2xl border border-[#E5E4E1] p-6 md:p-8 space-y-6">
          {/* Header */}
          <ReportHeader
            student={user ? { ...user, name: user.name } as any : null}
            session={session}
          />

          {/* Main assessment (stacked on mobile, 3-col on desktop) */}
          <div className="flex flex-col md:flex-row gap-4">
            <OverallResult report={report} />
            <RadarChart metrics={report.radar_metrics} />
            <TimeBreakdown
              totalTime={report.total_time_seconds}
              categories={report.category_times}
            />
          </div>

          {/* Level Chart */}
          <div className="overflow-x-auto">
            <LevelChartTable currentRank={session.determined_level} />
          </div>

          {/* Metric Details */}
          <MetricDetailSection details={report.metric_details} />
        </div>

        {/* Wrong Words Summary */}
        {wrongItems.length > 0 && (
          <div className="space-y-3">
            <span className="font-display text-[15px] font-semibold text-text-primary">
              틀린 단어 미리보기
            </span>

            <div
              className="rounded-2xl bg-white overflow-hidden"
              style={{ boxShadow: '0 2px 8px #1A191808' }}
            >
              {previewWrong.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{
                    borderBottom:
                      i < previewWrong.length - 1
                        ? '1px solid #E5E4E1'
                        : undefined,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-wrong font-bold">✕</span>
                    <span className="font-word text-sm font-semibold text-text-primary">
                      {item.english}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.timeTaken != null && (
                      <span className={`font-display text-xs ${item.timeTaken > 12 ? 'text-wrong font-semibold' : 'text-text-tertiary'}`}>
                        {item.timeTaken}초
                      </span>
                    )}
                    <span className="font-display text-sm text-text-tertiary">
                      {item.correctAnswer}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate(`/result/${testId}/wrong`)}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-wrong-light w-full"
              style={{ border: '1px solid #EF444420' }}
            >
              <List className="w-4 h-4 text-wrong" />
              <span className="font-display text-sm font-semibold text-wrong">
                틀린 단어 전체보기
              </span>
              <ChevronRight className="w-4 h-4 text-wrong" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="px-6 pt-3 pb-10 w-full md:max-w-[900px] flex flex-col items-center gap-3">
        <button
          onClick={() => navigate(homePath, { replace: true })}
          className="flex items-center justify-center gap-2 w-full h-[52px] rounded-2xl text-white bg-[#CC0000] hover:bg-[#CC0000]/90 transition-colors"
          style={{ boxShadow: '0 4px 16px #CC000040' }}
        >
          <span className="font-display text-base font-bold">
            홈으로 돌아가기
          </span>
        </button>
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="flex items-center justify-center gap-2"
        >
          <LogIn className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="font-display text-sm font-medium text-text-tertiary hover:text-text-secondary transition-colors">
            로그인 화면으로
          </span>
        </button>
      </div>
    </div>
  );
}

export default ResultPage;
