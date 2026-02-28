/**
 * ExamBriefing - shown before the exam starts.
 * Multi-step flow: exam info → answer guide → start button.
 * Shows skill area breakdown with question counts.
 */
import { memo, useState, useCallback } from 'react';
import {
  BookOpen, Clock, MousePointerClick, Keyboard,
  ChevronLeft, ChevronRight, Send, Play, ArrowRight,
  Volume2,
} from 'lucide-react';
import {
  ENGINE_TO_SKILL, SKILL_AREA_OPTIONS,
  ENGINE_DESCRIPTIONS, QUESTION_TYPE_OPTIONS,
} from '../../constants/engineLabels';

interface ExamBriefingProps {
  studentName: string;
  studentSchool?: string;
  studentGrade?: string;
  bookName: string | null;
  bookNameEnd: string | null;
  lessonStart: string | null;
  lessonEnd: string | null;
  questionCount: number;
  totalTimeSeconds: number;
  timeMode?: 'per_question' | 'total';
  perQuestionTime?: number;
  questionTypes?: string; // comma-separated canonical engine names
  configName?: string;
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

function GuideRow({ icon, bg, text }: { icon: React.ReactNode; bg: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: bg }}
      >
        {icon}
      </div>
      <p className="font-display text-[13px] font-medium text-text-secondary">{text}</p>
    </div>
  );
}

function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <kbd
        className="inline-flex items-center justify-center min-w-[42px] h-7 px-2 rounded-md text-[12px] font-bold font-mono shrink-0"
        style={{ backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB' }}
      >
        {keys}
      </kbd>
      <span className="font-display text-[13px] font-medium text-text-secondary">{desc}</span>
    </div>
  );
}

export const ExamBriefing = memo(function ExamBriefing({
  studentName,
  studentSchool = '',
  studentGrade = '',
  bookName,
  bookNameEnd,
  lessonStart,
  lessonEnd,
  questionCount,
  totalTimeSeconds,
  timeMode = 'total',
  perQuestionTime = 10,
  questionTypes,
  configName,
  onStart,
}: ExamBriefingProps) {
  const [step, setStep] = useState(0);
  const today = formatKoreanDate(new Date());
  const rangeText = formatRange(bookName, bookNameEnd, lessonStart, lessonEnd);
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
      <div className="w-full flex flex-col gap-6" style={{ maxWidth: step === 1 ? 680 : 480 }}>
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
                  {configName || rangeText}
                </h1>
                <p className="font-display text-sm font-medium text-text-secondary">
                  {today}
                </p>
                <p className="font-display text-sm font-medium text-text-secondary">
                  {[studentName, studentSchool, studentGrade].filter(Boolean).join(' | ')}
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
                    {timeMode === 'per_question' ? perQuestionTime : totalMinutes}
                  </div>
                  <div className="font-display text-sm font-medium text-text-tertiary mt-1.5">
                    {timeMode === 'per_question' ? '초/문제' : '분'}
                  </div>
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

        {/* ── Step 1: Comprehensive Guide (2-column on desktop) ── */}
        {step === 1 && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <h2
              className="font-display text-[22px] font-bold text-text-primary text-center pt-1"
              style={{ letterSpacing: -0.3 }}
            >
              정답 입력 방법
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left column: 출제 문제 유형 */}
              <div
                className="rounded-2xl bg-bg-surface p-4 md:self-start"
                style={{ boxShadow: '0 2px 12px #1A191808' }}
              >
                <h3 className="font-display text-[14px] font-bold text-text-primary mb-3">
                  출제 문제 유형
                </h3>
                <div className="flex flex-col gap-2.5">
                  {engines.length > 0 ? (
                    engines.map(engine => {
                      const isType = ['listen_type', 'ko_type', 'antonym_type', 'sentence_type'].includes(engine);
                      const isListen = engine.startsWith('listen');
                      const desc = ENGINE_DESCRIPTIONS[engine] || engine;
                      const opt = QUESTION_TYPE_OPTIONS.find(o => o.value === engine);
                      return (
                        <div key={engine} className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: isType ? '#FEF3C7' : isListen ? '#D1FAE5' : '#EEF2FF' }}
                          >
                            {isType ? (
                              <Keyboard className="w-3.5 h-3.5" style={{ color: '#D97706' }} />
                            ) : isListen ? (
                              <Volume2 className="w-3.5 h-3.5" style={{ color: '#059669' }} />
                            ) : (
                              <MousePointerClick className="w-3.5 h-3.5" style={{ color: '#4F46E5' }} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-display text-[13px] font-semibold text-text-primary">
                              {opt?.label || engine}
                            </span>
                            <span className="font-display text-[11px] text-text-tertiary ml-1.5">
                              {desc}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="font-display text-[12px] text-text-secondary">
                      선택형 문제가 출제됩니다
                    </p>
                  )}
                </div>
              </div>

              {/* Right column: 풀이 방법 + 키보드 단축키 */}
              <div className="flex flex-col gap-4">
                <div
                  className="rounded-2xl bg-bg-surface p-4"
                  style={{ boxShadow: '0 2px 12px #1A191808' }}
                >
                  <h3 className="font-display text-[14px] font-bold text-text-primary mb-3">
                    풀이 방법
                  </h3>
                  <div className="flex flex-col gap-2.5">
                    <GuideRow
                      icon={<MousePointerClick className="w-3.5 h-3.5 text-accent-indigo" />}
                      bg="#EEF2FF"
                      text="선택형: 보기를 터치하여 정답 선택"
                    />
                    {hasTyping && (
                      <GuideRow
                        icon={<Keyboard className="w-3.5 h-3.5" style={{ color: '#D97706' }} />}
                        bg="#FEF3C7"
                        text="타이핑형: 영어 입력 후 Enter 제출"
                      />
                    )}
                    {engines.some(e => e.startsWith('listen')) && (
                      <GuideRow
                        icon={<Volume2 className="w-3.5 h-3.5" style={{ color: '#059669' }} />}
                        bg="#D1FAE5"
                        text="듣기형: 자동 재생, 다시 듣기 가능"
                      />
                    )}
                    {timeMode === 'total' ? (
                      <>
                        <GuideRow
                          icon={<div className="flex items-center gap-0.5"><ChevronLeft className="w-3 h-3 text-accent-indigo" /><ChevronRight className="w-3 h-3 text-accent-indigo" /></div>}
                          bg="#EEF2FF"
                          text="이전/다음 버튼으로 자유 이동"
                        />
                        <GuideRow
                          icon={<Send className="w-3.5 h-3.5 text-accent-indigo" />}
                          bg="#EEF2FF"
                          text="완료 후 제출 버튼으로 종료"
                        />
                      </>
                    ) : (
                      <GuideRow
                        icon={<ArrowRight className="w-3.5 h-3.5 text-accent-indigo" />}
                        bg="#EEF2FF"
                        text="정답 선택 시 자동 다음 문제"
                      />
                    )}
                  </div>
                </div>

                <div
                  className="rounded-2xl bg-bg-surface p-4"
                  style={{ boxShadow: '0 2px 12px #1A191808' }}
                >
                  <h3 className="font-display text-[14px] font-bold text-text-primary mb-3">
                    키보드 단축키
                  </h3>
                  <div className="flex flex-col gap-2">
                    <ShortcutRow keys="1~4" desc="보기 번호 선택" />
                    {hasTyping && <ShortcutRow keys="Enter" desc="타이핑 답안 제출" />}
                    {engines.some(e => e.startsWith('listen')) && <ShortcutRow keys="0" desc="다시 듣기" />}
                    {timeMode === 'total' && <ShortcutRow keys="← →" desc="문제 이동" />}
                  </div>
                </div>
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
              <button
                onClick={goPrev}
                disabled={step === 0}
                className={`flex items-center gap-1.5 font-display text-sm font-semibold text-text-tertiary px-4 py-2.5 rounded-xl transition-colors hover:bg-gray-100 ${step === 0 ? 'invisible' : ''}`}
              >
                <ChevronLeft className="w-4 h-4" />
                이전
              </button>
              <button
                onClick={goNext}
                disabled={step >= TOTAL_STEPS - 1}
                className={`flex items-center gap-1.5 font-display text-sm font-semibold text-accent-indigo bg-accent-indigo-light px-5 py-2.5 rounded-xl transition-colors hover:opacity-80 ${step >= TOTAL_STEPS - 1 ? 'invisible' : ''}`}
              >
                다음
                <ChevronRight className="w-4 h-4" />
              </button>
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
