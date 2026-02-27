/**
 * ExamBriefing - shown before the exam starts.
 * Multi-step flow: exam info → answer guide → start button.
 * Shows skill area breakdown with question counts.
 */
import { memo, useState, useCallback } from 'react';
import {
  BookOpen, Clock, MousePointerClick, Keyboard, Timer,
  ChevronLeft, ChevronRight, Send, Play, ArrowRight,
} from 'lucide-react';
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
            backgroundColor: i === current ? '#4F46E5' : '#D1D5DB',
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
    <div className="min-h-screen bg-bg-cream flex flex-col items-center md:justify-center lg:justify-center px-5 py-8">
      <div className="w-full md:w-[480px] lg:w-[480px] flex flex-col gap-6">
        {/* ── Step 0: Exam Info ── */}
        {step === 0 && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col items-center gap-4 pt-2">
              <div
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
                  boxShadow: '0 4px 20px #4F46E530',
                }}
              >
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div className="text-center space-y-1.5">
                <h1
                  className="font-display text-[26px] font-bold text-text-primary"
                  style={{ letterSpacing: -0.5 }}
                >
                  {rangeText}
                </h1>
                <p className="font-display text-sm font-medium text-text-secondary">
                  {today} | {studentName}
                </p>
              </div>
            </div>

            {/* Question count & Time */}
            <div
              className="rounded-2xl bg-bg-surface p-6"
              style={{ boxShadow: '0 2px 12px #1A191808' }}
            >
              <p className="font-display text-sm font-medium text-text-tertiary text-center mb-5">
                전체 문제 수와 제한 시간은 다음과 같습니다
              </p>
              <div className="flex items-center justify-center gap-12">
                <div className="text-center">
                  <div className="font-display text-[48px] font-bold text-text-primary leading-none">
                    {questionCount}
                  </div>
                  <div className="font-display text-sm font-medium text-text-tertiary mt-1.5">문제</div>
                </div>
                <div className="w-px h-14 bg-border-default" />
                <div className="text-center">
                  <div className="font-display text-[48px] font-bold text-text-primary leading-none">
                    {totalMinutes}
                  </div>
                  <div className="font-display text-sm font-medium text-text-tertiary mt-1.5">분</div>
                </div>
              </div>
            </div>

            {/* Skill area breakdown */}
            {skillBreakdown.length > 0 && (
              <div
                className="rounded-2xl bg-bg-surface overflow-hidden"
                style={{ boxShadow: '0 2px 12px #1A191808' }}
              >
                <div className="flex items-center gap-2 px-5 pt-4 pb-3">
                  <Clock className="w-[18px] h-[18px] text-accent-indigo" />
                  <span className="font-display text-[15px] font-semibold text-text-primary">
                    출제 영역
                  </span>
                </div>
                <div className="flex flex-col">
                  {skillBreakdown.map((area, i) => (
                    <div
                      key={area.skill}
                      className="flex items-center justify-between px-5 py-3"
                      style={{ borderTop: i > 0 ? '1px solid #E5E4E1' : 'none' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-display text-sm font-semibold text-text-tertiary w-5">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span className="font-display text-sm font-semibold text-text-primary">
                          {area.label}
                        </span>
                      </div>
                      <span className="font-display text-sm font-bold text-accent-indigo">
                        {area.count}문제
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Answer Guide ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5 animate-fadeIn">
            <h2
              className="font-display text-xl font-bold text-text-primary text-center pt-2"
              style={{ letterSpacing: -0.3 }}
            >
              정답을 입력하는 방법을 알아보세요
            </h2>

            {/* Choice guide */}
            <div
              className="rounded-2xl bg-bg-surface p-5 flex items-center gap-5"
              style={{ boxShadow: '0 2px 12px #1A191808' }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
                  boxShadow: '0 4px 16px #4F46E530',
                }}
              >
                <MousePointerClick className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-display text-[15px] font-bold text-text-primary mb-1">선택형 문제</h3>
                <p className="font-display text-[13px] font-medium text-text-secondary">
                  번호를 터치하여 답을 선택합니다
                </p>
              </div>
            </div>

            {/* Typing guide */}
            {hasTyping && (
              <div
                className="rounded-2xl bg-bg-surface p-5 flex items-center gap-5"
                style={{ boxShadow: '0 2px 12px #1A191808' }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
                    boxShadow: '0 4px 16px #4F46E530',
                  }}
                >
                  <Keyboard className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-display text-[15px] font-bold text-text-primary mb-1">타이핑 문제</h3>
                  <p className="font-display text-[13px] font-medium text-text-secondary">
                    밑줄에 맞게 타이핑합니다
                  </p>
                </div>
              </div>
            )}

            {/* Button usage guide */}
            <div
              className="rounded-2xl bg-bg-surface p-5"
              style={{ boxShadow: '0 2px 12px #1A191808' }}
            >
              <h3 className="font-display text-[15px] font-bold text-text-primary mb-4">
                버튼들의 쓰임새를 알아보세요
              </h3>
              <div className="flex flex-col gap-3.5">
                {timeMode === 'total' ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-indigo-light flex items-center justify-center shrink-0 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          <ChevronLeft className="w-3.5 h-3.5 text-accent-indigo" />
                          <ChevronRight className="w-3.5 h-3.5 text-accent-indigo" />
                        </div>
                      </div>
                      <p className="font-display text-[13px] font-medium text-text-secondary leading-relaxed pt-1.5">
                        이전/다음 버튼으로 한 문제씩 이동합니다
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-indigo-light flex items-center justify-center shrink-0 mt-0.5">
                        <Send className="w-4 h-4 text-accent-indigo" />
                      </div>
                      <p className="font-display text-[13px] font-medium text-text-secondary leading-relaxed pt-1.5">
                        문제를 다 풀면 제출 버튼을 터치하여 시험을 마칩니다
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-indigo-light flex items-center justify-center shrink-0 mt-0.5">
                        <Timer className="w-4 h-4 text-accent-indigo" />
                      </div>
                      <p className="font-display text-[13px] font-medium text-text-secondary leading-relaxed pt-1.5">
                        각 문제마다 제한 시간({timeText})이 있습니다
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-indigo-light flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowRight className="w-4 h-4 text-accent-indigo" />
                      </div>
                      <p className="font-display text-[13px] font-medium text-text-secondary leading-relaxed pt-1.5">
                        정답을 선택하면 자동으로 다음 문제로 넘어갑니다
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Start ── */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-8 animate-fadeIn pt-4">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
                  boxShadow: '0 4px 20px #4F46E530',
                }}
              >
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
              <h2
                className="font-display text-xl font-bold text-text-primary text-center"
                style={{ letterSpacing: -0.3 }}
              >
                시작 버튼을 눌러 시험을 시작합니다
              </h2>
            </div>

            <button
              onClick={onStart}
              className="flex items-center justify-center gap-2.5 w-full h-14 rounded-2xl text-white transition-all active:scale-95"
              style={{
                background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                boxShadow: '0 4px 16px #4F46E540',
              }}
            >
              <Play className="w-5 h-5" />
              <span className="font-display text-[17px] font-bold">시험 시작하기</span>
            </button>

            <p className="font-display text-xs font-medium text-text-tertiary">
              시험을 시작하면 취소할 수 없습니다
            </p>
          </div>
        )}

        {/* ── Navigation + Page Dots ── */}
        <div className="flex flex-col items-center gap-4 mt-2">
          <PageDots total={TOTAL_STEPS} current={step} />
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={goPrev}
                className="flex items-center gap-1.5 font-display text-sm font-semibold text-text-tertiary px-4 py-2.5 rounded-xl transition-colors hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4" />
                이전
              </button>
            )}
            {step < TOTAL_STEPS - 1 && (
              <button
                onClick={goNext}
                className="flex items-center gap-1.5 font-display text-sm font-semibold text-accent-indigo bg-accent-indigo-light px-5 py-2.5 rounded-xl transition-colors hover:opacity-80"
              >
                다음
                <ChevronRight className="w-4 h-4" />
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
