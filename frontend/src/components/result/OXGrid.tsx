import { useMemo } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';
import type { AnswerDetail, TestSessionData } from '../../services/test';

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-2 rounded bg-[#E5E4E1] overflow-hidden">
      <div className={`h-full rounded ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function OXGrid({
  answers,
  session,
}: {
  answers: AnswerDetail[];
  session: TestSessionData;
}) {
  const stats = useMemo(() => {
    const times = answers
      .map((a) => a.time_taken_seconds)
      .filter((t): t is number => t != null && t > 0);
    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const minTime = times.length > 0 ? Math.min(...times) : 0;
    const maxTime = times.length > 0 ? Math.max(...times) : 0;
    const minIdx = times.length > 0 ? answers.findIndex((a) => a.time_taken_seconds === minTime) : -1;
    const maxIdx = times.length > 0 ? answers.findIndex((a) => a.time_taken_seconds === maxTime) : -1;

    const correctTimes = answers.filter((a) => a.is_correct && a.time_taken_seconds != null && a.time_taken_seconds > 0).map((a) => a.time_taken_seconds!);
    const wrongTimes = answers.filter((a) => !a.is_correct && a.time_taken_seconds != null && a.time_taken_seconds > 0).map((a) => a.time_taken_seconds!);
    const avgCorrectTime = correctTimes.length > 0 ? correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length : 0;
    const avgWrongTime = wrongTimes.length > 0 ? wrongTimes.reduce((a, b) => a + b, 0) / wrongTimes.length : 0;

    const basic = answers.filter((a) => a.word_level <= 3);
    const mid = answers.filter((a) => a.word_level >= 4 && a.word_level <= 5);
    const adv = answers.filter((a) => a.word_level >= 6);

    return {
      avgTime: avgTime.toFixed(1),
      minTime: minTime.toFixed(1),
      maxTime: maxTime.toFixed(1),
      minLabel: minIdx >= 0 ? `#${answers[minIdx].question_order}` : '-',
      maxLabel: maxIdx >= 0 ? `#${answers[maxIdx].question_order}` : '-',
      avgCorrectTime: avgCorrectTime.toFixed(1),
      avgWrongTime: avgWrongTime.toFixed(1),
      basic: { correct: basic.filter((a) => a.is_correct).length, total: basic.length },
      mid: { correct: mid.filter((a) => a.is_correct).length, total: mid.length },
      adv: { correct: adv.filter((a) => a.is_correct).length, total: adv.length },
      maxBarTime: Math.max(avgCorrectTime, avgWrongTime, 1),
      hasTimeData: times.length > 0,
    };
  }, [answers]);

  const gridRows: AnswerDetail[][] = [];
  for (let i = 0; i < answers.length; i += 6) {
    gridRows.push(answers.slice(i, i + 6));
  }

  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-5 lg:p-6 w-full">
      <div className="flex items-center gap-2.5 mb-4">
        <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
          문제별 결과
        </h3>
        <span className="text-[13px] font-medium text-text-tertiary font-display">
          {session.correct_count}/{session.total_questions} 정답
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: OX Grid */}
        <div className="flex flex-col gap-2 shrink-0">
          {gridRows.map((row, ri) => (
            <div key={ri} className="flex gap-2">
              {row.map((a) => (
                <div
                  key={a.question_order}
                  className={`flex flex-col items-center justify-center rounded-[10px] w-11 h-12 lg:w-[52px] lg:h-16 gap-0.5 ${
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
          ))}
        </div>

        {/* Right: Stats Panel (PC only) */}
        {stats.hasTimeData && (
          <div className="hidden lg:flex flex-col gap-5 rounded-xl bg-[#F8F8F6] p-6 flex-1 min-w-[300px]">
            {/* Time Analysis */}
            <div>
              <h4 className="text-sm font-bold text-text-primary font-display mb-3">풀이 시간 분석</h4>
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary font-display w-24">평균 풀이시간</span>
                  <span className="text-sm font-bold text-text-primary">{stats.avgTime}초</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary font-display w-24">가장 빠른 문항</span>
                  <span className="text-sm font-bold text-teal">{stats.minLabel} — {stats.minTime}초</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary font-display w-24">가장 느린 문항</span>
                  <span className="text-sm font-bold text-wrong">{stats.maxLabel} — {stats.maxTime}초</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Correct vs Wrong Time */}
            <div>
              <h4 className="text-sm font-bold text-text-primary font-display mb-3">정답 vs 오답 시간</h4>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary font-display w-16">정답 평균</span>
                  <span className="text-xs font-bold text-correct">{stats.avgCorrectTime}초</span>
                </div>
                <ProgressBar value={parseFloat(stats.avgCorrectTime)} max={stats.maxBarTime} color="bg-correct" />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-text-tertiary font-display w-16">오답 평균</span>
                  <span className="text-xs font-bold text-wrong">{stats.avgWrongTime}초</span>
                </div>
                <ProgressBar value={parseFloat(stats.avgWrongTime)} max={stats.maxBarTime} color="bg-wrong" />
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Accuracy by Difficulty */}
            <div>
              <h4 className="text-sm font-bold text-text-primary font-display mb-3">난이도별 정답률</h4>
              <div className="flex flex-col gap-3">
                {stats.basic.total > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-text-tertiary font-display">기초(Lv.1-3)</span>
                      <span className="text-xs font-bold text-correct">
                        {Math.round((stats.basic.correct / stats.basic.total) * 100)}%
                      </span>
                      <span className="text-[11px] text-text-tertiary ml-auto">
                        {stats.basic.correct}/{stats.basic.total}
                      </span>
                    </div>
                    <ProgressBar value={stats.basic.correct} max={stats.basic.total} color="bg-correct" />
                  </div>
                )}
                {stats.mid.total > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-text-tertiary font-display">중급(Lv.4-5)</span>
                      <span className="text-xs font-bold text-[#D97706]">
                        {Math.round((stats.mid.correct / stats.mid.total) * 100)}%
                      </span>
                      <span className="text-[11px] text-text-tertiary ml-auto">
                        {stats.mid.correct}/{stats.mid.total}
                      </span>
                    </div>
                    <ProgressBar value={stats.mid.correct} max={stats.mid.total} color="bg-[#F59E0B]" />
                  </div>
                )}
                {stats.adv.total > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-text-tertiary font-display">고급(Lv.6+)</span>
                      <span className="text-xs font-bold text-[#EF4444]">
                        {Math.round((stats.adv.correct / stats.adv.total) * 100)}%
                      </span>
                      <span className="text-[11px] text-text-tertiary ml-auto">
                        {stats.adv.correct}/{stats.adv.total}
                      </span>
                    </div>
                    <ProgressBar value={stats.adv.correct} max={stats.adv.total} color="bg-[#EF4444]" />
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Legend */}
            <div className="flex items-center justify-center gap-5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-correct" />
                <span className="text-[11px] text-text-tertiary">정답</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-wrong" />
                <span className="text-[11px] text-text-tertiary">오답</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
