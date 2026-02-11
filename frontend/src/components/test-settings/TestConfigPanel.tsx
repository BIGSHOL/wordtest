/**
 * Test configuration panel for test assignment.
 * Supports cross-book range selection: start book/lesson ~ end book/lesson.
 */
import { Check, Info } from 'lucide-react';
import type { LessonInfo } from '../../services/word';

export interface TestConfigState {
  testType: 'placement' | 'periodic';
  questionCount: number;
  customQuestionCount: string;
  perQuestionTime: number;
  questionTypes: string[];
  bookStart: string;
  bookEnd: string;
  lessonStart: string;
  lessonEnd: string;
}

interface Props {
  config: TestConfigState;
  onConfigChange: (config: TestConfigState) => void;
  books: string[];
  lessonsStart: LessonInfo[];
  lessonsEnd: LessonInfo[];
}

const QUESTION_COUNT_OPTIONS = [10, 20, 30, 50];
const TIME_OPTIONS = [
  { label: '5초', value: 5 },
  { label: '10초', value: 10 },
  { label: '15초', value: 15 },
  { label: '20초', value: 20 },
  { label: '30초', value: 30 },
];
const QUESTION_TYPE_OPTIONS = [
  {
    value: 'word_meaning',
    label: '유형 1: 단어 → 뜻 고르기',
    desc: '영어 단어를 보고 올바른 한국어 뜻을 4개 보기 중 선택',
  },
  {
    value: 'meaning_word',
    label: '유형 2: 뜻 → 단어 고르기',
    desc: '한국어 뜻을 보고 올바른 영어 단어를 4개 보기 중 선택',
  },
  {
    value: 'sentence_blank',
    label: '유형 3: 예문 빈칸 채우기',
    desc: '예문의 빈칸에 들어갈 올바른 영어 단어를 4개 보기 중 선택',
  },
];

function formatTotalTime(count: number, perQuestion: number): string {
  const total = count * perQuestion;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

function getWordCount(lessons: LessonInfo[], start: string, end: string): number {
  if (!start || !end) return 0;
  let counting = false;
  let total = 0;
  for (const l of lessons) {
    if (l.lesson === start) counting = true;
    if (counting) total += l.word_count;
    if (l.lesson === end) break;
  }
  return total;
}

function getTotalLessonWords(lessons: LessonInfo[], fromLesson: string, direction: 'from' | 'to'): number {
  let total = 0;
  if (direction === 'from') {
    let counting = false;
    for (const l of lessons) {
      if (l.lesson === fromLesson) counting = true;
      if (counting) total += l.word_count;
    }
  } else {
    for (const l of lessons) {
      total += l.word_count;
      if (l.lesson === fromLesson) break;
    }
  }
  return total;
}

/** Styled option pill - matches Pencil design */
function OptionPill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-[10px] text-[13px] transition-all"
      style={{
        padding: '10px 20px',
        backgroundColor: selected ? '#EBF8FA' : '#F8F8F6',
        border: selected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
        color: selected ? '#2D9CAE' : '#6D6C6A',
        fontWeight: selected ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

/** Config card wrapper */
function ConfigCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-2xl"
      style={{ padding: '24px 28px', border: '1px solid #E8E8E6' }}
    >
      <div className="mb-5">
        <h3 className="text-base font-bold text-text-primary font-display">{title}</h3>
        <p className="text-xs text-text-secondary mt-1.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

const selectStyle = { border: '1px solid #E8E8E6' };

export function TestConfigPanel({ config, onConfigChange, books, lessonsStart, lessonsEnd }: Props) {
  const update = (partial: Partial<TestConfigState>) => {
    onConfigChange({ ...config, ...partial });
  };

  const effectiveCount =
    config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;

  const toggleType = (type: string) => {
    const types = config.questionTypes.includes(type)
      ? config.questionTypes.filter((t) => t !== type)
      : [...config.questionTypes, type];
    if (types.length > 0) update({ questionTypes: types });
  };

  const isPlacement = config.testType === 'placement';
  const isSameBook = config.bookStart === config.bookEnd;

  // Word count calculation
  let wordCount = 0;
  if (config.bookStart && config.bookEnd && config.lessonStart && config.lessonEnd) {
    if (isSameBook) {
      wordCount = getWordCount(lessonsStart, config.lessonStart, config.lessonEnd);
    } else {
      // Cross-book: sum from start lesson to end of start book + end book start to end lesson
      const startWords = getTotalLessonWords(lessonsStart, config.lessonStart, 'from');
      const endWords = getTotalLessonWords(lessonsEnd, config.lessonEnd, 'to');
      wordCount = startWords + endWords;
    }
  }

  return (
    <div className="space-y-5">
      {/* Question Count */}
      <ConfigCard title="문제 수 설정" desc="학생에게 출제할 문제 수를 설정합니다">
        <div className="flex flex-wrap gap-3">
          {QUESTION_COUNT_OPTIONS.map((count) => (
            <OptionPill
              key={count}
              selected={config.questionCount === count}
              onClick={() => update({ questionCount: count })}
            >
              {count}문제
            </OptionPill>
          ))}
          <OptionPill
            selected={config.questionCount === -1}
            onClick={() => update({ questionCount: -1 })}
          >
            직접 입력
          </OptionPill>
        </div>
        {config.questionCount === -1 && (
          <input
            type="number"
            min={1}
            max={200}
            value={config.customQuestionCount}
            onChange={(e) => update({ customQuestionCount: e.target.value })}
            placeholder="문제 수 입력"
            className="mt-4 w-32 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
          />
        )}
      </ConfigCard>

      {/* Per-Question Time */}
      <ConfigCard
        title="문제당 제한 시간"
        desc="각 문제에 주어지는 답변 시간을 설정합니다 (총 시간 = 문제 수 × 제한 시간)"
      >
        <div className="flex flex-wrap gap-3">
          {TIME_OPTIONS.map((option) => (
            <OptionPill
              key={option.value}
              selected={config.perQuestionTime === option.value}
              onClick={() => update({ perQuestionTime: option.value })}
            >
              {option.label}
            </OptionPill>
          ))}
        </div>
        {effectiveCount > 0 && (
          <div
            className="flex items-center gap-2 rounded-lg mt-4"
            style={{ backgroundColor: '#EBF8FA', padding: '12px 16px' }}
          >
            <Info className="w-4 h-4 shrink-0" style={{ color: '#2D9CAE' }} />
            <span className="text-xs font-medium" style={{ color: '#2D9CAE' }}>
              현재 설정: {effectiveCount}문제 × {config.perQuestionTime}초 = 총{' '}
              {effectiveCount * config.perQuestionTime}초 ({formatTotalTime(effectiveCount, config.perQuestionTime)})
            </span>
          </div>
        )}
      </ConfigCard>

      {/* Question Types */}
      <ConfigCard title="문제 유형" desc="출제할 문제 유형을 선택합니다 (복수 선택 가능)">
        <div className="space-y-3">
          {QUESTION_TYPE_OPTIONS.map((option) => {
            const isSelected = config.questionTypes.includes(option.value);
            return (
              <button
                key={option.value}
                onClick={() => toggleType(option.value)}
                className="w-full flex items-center gap-3 rounded-xl transition-all text-left"
                style={{
                  padding: '16px 20px',
                  backgroundColor: isSelected ? '#EBF8FA' : '#F8F8F6',
                  border: isSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                }}
              >
                <span
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isSelected ? '#2D9CAE' : 'transparent',
                    border: isSelected ? 'none' : '2px solid #E8E8E6',
                  }}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-bold"
                    style={{ color: isSelected ? '#2D9CAE' : '#3D3D3C' }}
                  >
                    {option.label}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">{option.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </ConfigCard>

      {/* Test Type */}
      <ConfigCard title="테스트 유형" desc="문제 출제 방식을 선택합니다">
        <div className="flex gap-3">
          <OptionPill
            selected={config.testType === 'periodic'}
            onClick={() => update({ testType: 'periodic' })}
          >
            정기형
          </OptionPill>
          <OptionPill
            selected={config.testType === 'placement'}
            onClick={() => update({ testType: 'placement' })}
          >
            적응형
          </OptionPill>
        </div>
        {isPlacement && (
          <div
            className="flex items-center gap-2 rounded-lg mt-4"
            style={{ backgroundColor: '#EEF2FF', padding: '12px 16px' }}
          >
            <Info className="w-4 h-4 shrink-0" style={{ color: '#4F46E5' }} />
            <span className="text-xs font-medium" style={{ color: '#4F46E5' }}>
              적응형 모드에서는 정답률과 응답 속도에 따라 문제 난이도가 자동 조절됩니다.
            </span>
          </div>
        )}
      </ConfigCard>

      {/* Scope - Cross-book range */}
      <ConfigCard title="출제 범위" desc="시작 교재/레슨부터 종료 교재/레슨까지 범위를 설정합니다">
        <div className="space-y-4">
          {/* Start: book + lesson */}
          <div>
            <span className="text-[11px] font-semibold text-text-secondary mb-2 block">시작</span>
            <div className="flex items-center gap-2">
              <select
                value={config.bookStart}
                onChange={(e) => update({ bookStart: e.target.value, lessonStart: '', bookEnd: config.bookEnd || e.target.value, lessonEnd: config.bookEnd ? config.lessonEnd : '' })}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                style={selectStyle}
              >
                <option value="">교재 선택</option>
                {books.map((book) => (
                  <option key={book} value={book}>{book}</option>
                ))}
              </select>
              {config.bookStart && lessonsStart.length > 0 && (
                <select
                  value={config.lessonStart}
                  onChange={(e) => update({ lessonStart: e.target.value })}
                  className="px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                  style={{ ...selectStyle, width: 80 }}
                >
                  <option value="">레슨</option>
                  {lessonsStart.map((l) => (
                    <option key={l.lesson} value={l.lesson}>{l.lesson}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Separator */}
          <div className="flex justify-center">
            <span className="text-base font-bold text-text-tertiary">~</span>
          </div>

          {/* End: book + lesson */}
          <div>
            <span className="text-[11px] font-semibold text-text-secondary mb-2 block">종료</span>
            <div className="flex items-center gap-2">
              <select
                value={config.bookEnd}
                onChange={(e) => update({ bookEnd: e.target.value, lessonEnd: '' })}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                style={selectStyle}
              >
                <option value="">교재 선택</option>
                {books.map((book) => (
                  <option key={book} value={book}>{book}</option>
                ))}
              </select>
              {config.bookEnd && lessonsEnd.length > 0 && (
                <select
                  value={config.lessonEnd}
                  onChange={(e) => update({ lessonEnd: e.target.value })}
                  className="px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                  style={{ ...selectStyle, width: 80 }}
                >
                  <option value="">레슨</option>
                  {lessonsEnd.map((l) => (
                    <option key={l.lesson} value={l.lesson}>{l.lesson}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {wordCount > 0 && (
            <div
              className="flex items-center gap-2 rounded-lg"
              style={{ backgroundColor: '#FFF8DC', padding: '12px 16px' }}
            >
              <Info className="w-4 h-4 shrink-0" style={{ color: '#B8860B' }} />
              <span className="text-xs font-medium" style={{ color: '#B8860B' }}>
                {isSameBook
                  ? `${config.bookStart} ${config.lessonStart}~${config.lessonEnd} 범위에서 총 ${wordCount}개 단어 중 출제됩니다`
                  : `${config.bookStart} ${config.lessonStart} ~ ${config.bookEnd} ${config.lessonEnd} 범위에서 약 ${wordCount}개 단어 중 출제됩니다`}
              </span>
            </div>
          )}
        </div>
      </ConfigCard>
    </div>
  );
}

export default TestConfigPanel;
