/**
 * ExamBriefing - shown before the exam starts.
 * Multi-step flow: exam info → answer guide → start button.
 * Shows skill area breakdown with question counts.
 */
import { memo, useState, useCallback } from 'react';
import { ENGINE_TO_SKILL, SKILL_AREA_OPTIONS } from '../../constants/engineLabels';

interface ExamBriefingProps {
  studentName: string;
  bookName: string | null;
  bookNameEnd: string | null;
  lessonStart: string | null;
  lessonEnd: string | null;
  questionCount: number;
  totalTimeSeconds: number;
  timeMode?: 'per_question' | 'total';
  perQuestionTime?: number;
  questionTypes?: string; // comma-separated canonical engine names
  onStart: () => void;
}

function formatKoreanDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

function formatRange(
  bookName: string | null,
  bookNameEnd: string | null,
  lessonStart: string | null,
  lessonEnd: string | null,
): string {
  if (!bookName && !lessonStart) return '전체 범위';

  const startBook = bookName || '';
  const endBook = bookNameEnd || startBook;
  const startLesson = lessonStart || '';
  const endLesson = lessonEnd || startLesson;

  if (startBook === endBook) {
    if (startLesson === endLesson) {
      return `${startBook} ${startLesson}`;
    }
    return `${startBook} ${startLesson} ~ ${endLesson}`;
  }
  return `${startBook} ${startLesson} ~ ${endBook} ${endLesson}`;
}

/** Count questions per skill area from engine type list */
function countBySkillArea(
  types: string[],
  totalQuestions: number,
): { skill: string; label: string; icon: string; count: number }[] {
  // Count engines per skill area
  const skillCounts: Record<string, number> = {};
  for (const engine of types) {
    const skill = ENGINE_TO_SKILL[engine];
    if (skill) {
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    }
  }

  const totalEngines = Object.values(skillCounts).reduce((s, c) => s + c, 0);
  if (totalEngines === 0) return [];

  // Distribute totalQuestions proportionally
  const areas: { skill: string; label: string; icon: string; count: number }[] = [];
  let distributed = 0;

  const skillEntries = Object.entries(skillCounts);
  for (let i = 0; i < skillEntries.length; i++) {
    const [skill, engineCount] = skillEntries[i];
    const option = SKILL_AREA_OPTIONS.find(o => o.value === skill);
    if (!option) continue;

    const isLast = i === skillEntries.length - 1;
    const count = isLast
      ? totalQuestions - distributed
      : Math.round((engineCount / totalEngines) * totalQuestions);
    distributed += count;

    areas.push({ skill, label: option.label, icon: option.icon, count });
  }

  return areas.filter(a => a.count > 0);
}

function PageDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-all"
          style={{
            backgroundColor: i === current ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
            transform: i === current ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

export const ExamBriefing = memo(function ExamBriefing({
  studentName,
  bookName,
  bookNameEnd,
  lessonStart,
  lessonEnd,
  questionCount,
  totalTimeSeconds,
  timeMode = 'total',
  perQuestionTime = 10,
  questionTypes,
  onStart,
}: ExamBriefingProps) {
  const [step, setStep] = useState(0);
  const today = formatKoreanDate(new Date());
  const rangeText = formatRange(bookName, bookNameEnd, lessonStart, lessonEnd);
  const timeText = timeMode === 'total'
    ? `${perQuestionTime}초`
    : `${perQuestionTime}초/문제`;
  const totalMinutes = timeMode === 'total'
    ? Math.ceil(totalTimeSeconds / 60)
    : Math.ceil((perQuestionTime * questionCount) / 60);

  const engines = questionTypes
    ? questionTypes.split(',').map(t => t.trim()).filter(Boolean)
    : [];
  const skillBreakdown = countBySkillArea(engines, questionCount);
  const hasTyping = engines.some(e => ['listen_type', 'ko_type', 'antonym_type'].includes(e));

  const TOTAL_STEPS = 3;

  const goNext = useCallback(() => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)), []);
  const goPrev = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 py-8"
      style={{ background: 'linear-gradient(135deg, #7C6FE0 0%, #9B8FEF 50%, #B0A4F5 100%)' }}
    >
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* ── Step 0: Exam Info ── */}
        {step === 0 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <p className="text-white/70 text-sm">{today} | {studentName}</p>
              <h1 className="text-white font-bold text-xl">{rangeText}</h1>
            </div>

            <div className="text-center text-white">
              <p className="text-white/80 text-sm mb-3">전체 문제 수와 제한 시간은 다음과 같습니다</p>
              <div className="flex items-center justify-center gap-10">
                <div>
                  <div className="text-5xl font-bold">{questionCount}</div>
                  <div className="text-white/70 text-sm mt-1">문제</div>
                </div>
                <div>
                  <div className="text-5xl font-bold">{totalMinutes}</div>
                  <div className="text-white/70 text-sm mt-1">분</div>
                </div>
              </div>
            </div>

            {skillBreakdown.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
              >
                {skillBreakdown.map((area, i) => (
                  <div
                    key={area.skill}
                    className="flex items-center justify-between px-6 py-3"
                    style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white/60 text-sm font-semibold w-5">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span className="text-white font-semibold text-sm">
                        {area.label}
                      </span>
                    </div>
                    <span className="text-white font-bold text-sm">
                      {area.count} 문제
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Answer Guide ── */}
        {step === 1 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <h2 className="text-white text-xl font-bold text-center">
              정답을 입력하는 방법을 알아보세요
            </h2>

            <div
              className="rounded-2xl p-6 flex items-center gap-5"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                <span style={{ fontSize: 28 }}>👆</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-base mb-1">선택형 문제</h3>
                <p className="text-white/70 text-sm">번호를 터치하여 답을 선택합니다</p>
              </div>
            </div>

            {hasTyping && (
              <div
                className="rounded-2xl p-6 flex items-center gap-5"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
                  <span style={{ fontSize: 28 }}>⌨️</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base mb-1">타이핑 문제</h3>
                  <p className="text-white/70 text-sm">밑줄에 맞게 타이핑합니다</p>
                </div>
              </div>
            )}

            <div
              className="rounded-2xl p-6"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}
            >
              <h3 className="text-white font-bold text-base mb-3">버튼들의 쓰임새를 알아보세요</h3>
              <div className="space-y-3">
                {timeMode === 'total' ? (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="text-white/60 text-sm">◀▶</span>
                      <p className="text-white/80 text-sm">이전/다음 버튼으로 한 문제씩 이동합니다</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-white/60 text-sm">📤</span>
                      <p className="text-white/80 text-sm">문제를 다 풀면 제출 버튼을 터치하여 시험을 마칩니다</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <span className="text-white/60 text-sm">⏱️</span>
                      <p className="text-white/80 text-sm">각 문제마다 제한 시간({timeText})이 있습니다</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-white/60 text-sm">➡️</span>
                      <p className="text-white/80 text-sm">정답을 선택하면 자동으로 다음 문제로 넘어갑니다</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Start ── */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-8 animate-fadeIn">
            <h2 className="text-white text-xl font-bold text-center">
              시작 버튼을 눌러 시험을 시작합니다
            </h2>

            <button
              onClick={onStart}
              className="w-48 h-16 rounded-2xl font-bold text-lg transition-all active:scale-95 hover:shadow-lg"
              style={{
                backgroundColor: 'rgba(255,255,255,0.9)',
                color: '#7C6FE0',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              }}
            >
              시작 &gt;
            </button>

            <p className="text-white/60 text-sm">
              시험을 시작하면 취소할 수 없습니다
            </p>
          </div>
        )}

        {/* ── Navigation + Page Dots ── */}
        <div className="flex flex-col items-center gap-4 mt-2">
          <PageDots total={TOTAL_STEPS} current={step} />
          <div className="flex items-center gap-4">
            {step > 0 && (
              <button
                onClick={goPrev}
                className="text-white/70 text-sm font-semibold px-5 py-2 rounded-xl transition-all hover:bg-white/10"
              >
                ◀ 이전
              </button>
            )}
            {step < TOTAL_STEPS - 1 && (
              <button
                onClick={goNext}
                className="text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all hover:bg-white/10"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                다음 ▶
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
});
