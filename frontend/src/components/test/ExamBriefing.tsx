/**
 * ExamBriefing - shown before the exam starts.
 * Displays exam metadata and instructions, then lets the student begin.
 */
import { memo } from 'react';

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
  questionTypes?: string; // comma-separated canonical names
  onStart: () => void;
}

const QUESTION_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  en_to_ko: { label: '영한 선택', icon: '🇬🇧→🇰🇷', color: '#3B82F6' },
  ko_to_en: { label: '한영 선택', icon: '🇰🇷→🇬🇧', color: '#8B5CF6' },
  listen_en: { label: '듣기 영어', icon: '🎧🇬🇧', color: '#10B981' },
  listen_ko: { label: '듣기 한국어', icon: '🎧🇰🇷', color: '#14B8A6' },
  listen_type: { label: '듣기 타이핑', icon: '⌨️🎧', color: '#F59E0B' },
  ko_type: { label: '한영 타이핑', icon: '⌨️🇬🇧', color: '#EF4444' },
  emoji: { label: '이모지', icon: '😊🍎', color: '#EC4899' },
  sentence: { label: '예문 빈칸', icon: '📝✏️', color: '#6366F1' },
};

function formatKoreanDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
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
  const today = formatKoreanDate(new Date());
  const rangeText = formatRange(bookName, bookNameEnd, lessonStart, lessonEnd);
  const timeText = timeMode === 'total'
    ? formatTime(totalTimeSeconds)
    : `문제당 ${perQuestionTime}초`;

  // Parse question types
  const types = questionTypes
    ? questionTypes.split(',').map(t => t.trim()).filter(t => t in QUESTION_TYPE_LABELS)
    : [];

  return (
    <div className="min-h-screen bg-bg-cream flex items-center justify-center px-5 py-8">
      <div
        className="w-full max-w-md bg-white rounded-3xl px-8 py-10 flex flex-col gap-7"
        style={{ boxShadow: '0 4px 32px #1A191810' }}
      >
        {/* Title */}
        <div className="text-center">
          <h1
            className="font-display text-2xl font-bold"
            style={{ color: '#3D3D3C' }}
          >
            시험 안내
          </h1>
        </div>

        {/* Exam Info */}
        <div
          className="rounded-2xl px-6 py-5 flex flex-col gap-3"
          style={{ background: '#F8F8F6', border: '1px solid #E8E8E6' }}
        >
          <InfoRow label="날짜" value={today} />
          <InfoRow label="학생" value={studentName} />
          <InfoRow label="범위" value={rangeText} />
          <div
            className="flex items-start justify-between gap-3"
          >
            <span
              className="font-display text-sm shrink-0"
              style={{ color: '#9C9B99' }}
            >
              문항 / 시간
            </span>
            <span
              className="font-display text-sm font-semibold text-right"
              style={{ color: '#3D3D3C' }}
            >
              {questionCount}문제 | {timeText}
            </span>
          </div>
        </div>

        {/* Question Types */}
        {types.length > 0 && (
          <div className="flex flex-col gap-3">
            <p
              className="font-display text-xs font-semibold uppercase tracking-wider"
              style={{ color: '#9C9B99' }}
            >
              출제 유형
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {types.map((type) => {
                const info = QUESTION_TYPE_LABELS[type];
                return (
                  <div
                    key={type}
                    className="rounded-xl px-4 py-3 flex items-center gap-2.5 transition-all hover:scale-[1.02]"
                    style={{
                      background: `${info.color}10`,
                      border: `1.5px solid ${info.color}30`,
                    }}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{info.icon}</span>
                    <span
                      className="font-display text-sm font-semibold"
                      style={{ color: info.color }}
                    >
                      {info.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="flex flex-col gap-2">
          <p
            className="font-display text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#9C9B99' }}
          >
            답변 방법
          </p>
          <ul className="flex flex-col gap-1.5">
            {(timeMode === 'total' ? [
              '보기를 클릭하거나 숫자키(1~4)로 선택',
              '◀ 이전 / 다음 ▶ 버튼으로 이동',
              '답을 바꿀 수 있습니다',
              '모든 문제를 풀면 \'제출\' 클릭',
            ] : [
              '보기를 클릭하거나 숫자키(1~4)로 선택',
              '각 문제마다 제한 시간이 있습니다',
              '정답을 선택하면 자동으로 다음 문제로',
              '시간 초과 시 오답 처리됩니다',
            ]).map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span style={{ color: '#4F46E5', fontSize: 14, lineHeight: '20px' }}>•</span>
                <span
                  className="font-display text-sm"
                  style={{ color: '#6D6C6A', lineHeight: '20px' }}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Warning */}
        <div
          className="rounded-2xl px-5 py-3.5 flex items-center gap-3"
          style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}
        >
          <span style={{ fontSize: 18 }}>⚠</span>
          <p
            className="font-display text-sm"
            style={{ color: '#92400E' }}
          >
            시험을 시작하면 취소할 수 없습니다
          </p>
        </div>

        {/* Start Button */}
        <button
          onClick={onStart}
          className="w-full h-14 rounded-2xl font-display text-[16px] font-bold text-white transition-opacity active:opacity-80"
          style={{
            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
            boxShadow: '0 4px 16px #4F46E540',
          }}
        >
          시험 시작
        </button>
      </div>
    </div>
  );
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span
        className="font-display text-sm shrink-0"
        style={{ color: '#9C9B99' }}
      >
        {label}
      </span>
      <span
        className="font-display text-sm font-semibold text-right"
        style={{ color: '#3D3D3C' }}
      >
        {value}
      </span>
    </div>
  );
}
