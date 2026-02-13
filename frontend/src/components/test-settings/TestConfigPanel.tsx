/**
 * Test configuration panel for test assignment.
 * Unified card design with sectioned layout.
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
  wordCount?: number;
}

const QUESTION_COUNT_OPTIONS = [10, 20, 30, 50];
const TIME_OPTIONS = [
  { label: '5초', value: 5 },
  { label: '10초', value: 10 },
  { label: '15초', value: 15 },
  { label: '20초', value: 20 },
  { label: '30초', value: 30 },
];
const ENGINE_MODE_OPTIONS = [
  {
    value: 'word',
    label: '워드 모드',
    desc: '영어↔한국어 4지선다 (단어→뜻, 뜻→단어)',
  },
  {
    value: 'stage',
    label: '스테이지 모드',
    desc: '5단계 순환 학습 (선다형 → 듣기 → 타이핑)',
  },
  {
    value: 'listen',
    label: '리스닝 모드',
    desc: '듣기 중심 학습 (발음 듣고 뜻 고르기 / 타이핑)',
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

/** Styled option pill */
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
      className="flex items-center justify-center rounded-lg text-[13px] transition-all"
      style={{
        padding: '8px 16px',
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

/** Section divider */
function Divider() {
  return <div style={{ borderTop: '1px solid #F0F0EE', margin: '0 24px' }} />;
}

const selectStyle = { border: '1px solid #E8E8E6' };

export function TestConfigPanel({ config, onConfigChange, books, lessonsStart, lessonsEnd, wordCount = 0 }: Props) {
  const update = (partial: Partial<TestConfigState>) => {
    onConfigChange({ ...config, ...partial });
  };

  const effectiveCount =
    config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;

  const selectMode = (mode: string) => {
    update({ questionTypes: [mode] });
  };

  const isSameBook = config.bookStart === config.bookEnd;

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8E8E6' }}>
      {/* Panel header */}
      <div
        className="flex items-center gap-3"
        style={{ padding: '16px 24px', borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
      >
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#2D9CAE' }} />
        <div>
          <h2 className="text-[15px] font-bold text-text-primary font-display">테스트 설정</h2>
          <p className="text-[11px] text-text-secondary mt-0.5">출제할 테스트의 세부 옵션을 설정합니다</p>
        </div>
      </div>

      {/* Section: Question Count */}
      <div style={{ padding: '18px 24px' }}>
        <h3 className="text-[13px] font-bold text-text-primary mb-3">문제 수</h3>
        <div className="flex flex-wrap gap-2">
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
            className="mt-3 w-28 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal"
            style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
          />
        )}
      </div>

      <Divider />

      {/* Section: Per-Question Time */}
      <div style={{ padding: '18px 24px' }}>
        <h3 className="text-[13px] font-bold text-text-primary mb-3">문제당 제한 시간</h3>
        <div className="flex flex-wrap gap-2">
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
            className="flex items-center gap-2 rounded-lg mt-3"
            style={{ backgroundColor: '#EBF8FA', padding: '10px 14px' }}
          >
            <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#2D9CAE' }} />
            <span className="text-[11px] font-medium" style={{ color: '#2D9CAE' }}>
              {effectiveCount}문제 × {config.perQuestionTime}초 = 총{' '}
              {formatTotalTime(effectiveCount, config.perQuestionTime)}
            </span>
          </div>
        )}
      </div>

      <Divider />

      {/* Section: Engine Mode */}
      <div style={{ padding: '18px 24px' }}>
        <h3 className="text-[13px] font-bold text-text-primary mb-3">문제 유형</h3>
        <div className="space-y-2">
          {ENGINE_MODE_OPTIONS.map((option) => {
            const isSelected = config.questionTypes[0] === option.value;
            return (
              <button
                key={option.value}
                onClick={() => selectMode(option.value)}
                className="w-full flex items-center gap-3 rounded-xl transition-all text-left"
                style={{
                  padding: '12px 16px',
                  backgroundColor: isSelected ? '#EBF8FA' : '#F8F8F6',
                  border: isSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                }}
              >
                <span
                  className="rounded-full flex items-center justify-center shrink-0"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: isSelected ? '#2D9CAE' : 'transparent',
                    border: isSelected ? 'none' : '2px solid #E8E8E6',
                  }}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12px] font-bold"
                    style={{ color: isSelected ? '#2D9CAE' : '#3D3D3C' }}
                  >
                    {option.label}
                  </div>
                  <div className="text-[11px] text-text-secondary mt-0.5">{option.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* Section: Scope */}
      <div style={{ padding: '18px 24px' }}>
        <h3 className="text-[13px] font-bold text-text-primary mb-3">출제 범위</h3>
        <div className="space-y-3">
          {/* Start: book + lesson */}
          <div>
            <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">시작</span>
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
                  style={{ ...selectStyle, width: 160 }}
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
            <span className="text-sm font-bold text-text-tertiary">~</span>
          </div>

          {/* End: book + lesson */}
          <div>
            <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">종료</span>
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
                  style={{ ...selectStyle, width: 160 }}
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
              style={{ backgroundColor: '#FFF8DC', padding: '10px 14px' }}
            >
              <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#B8860B' }} />
              <span className="text-[11px] font-medium" style={{ color: '#B8860B' }}>
                {isSameBook
                  ? `${config.bookStart} ${config.lessonStart}~${config.lessonEnd} 범위에서 총 ${wordCount}개 단어`
                  : `${config.bookStart} ${config.lessonStart} ~ ${config.bookEnd} ${config.lessonEnd} 범위에서 총 ${wordCount}개 단어`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TestConfigPanel;
