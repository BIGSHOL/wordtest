/**
 * Test configuration panel for test assignment.
 */
import type { LessonInfo } from '../../services/word';

export interface TestConfigState {
  questionCount: number;
  customQuestionCount: string;
  perQuestionTime: number;
  questionTypes: string[];
  bookName: string;
  lessonStart: string;
  lessonEnd: string;
}

interface Props {
  config: TestConfigState;
  onConfigChange: (config: TestConfigState) => void;
  books: string[];
  lessons: LessonInfo[];
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
  { value: 'word_meaning', label: '단어 > 뜻' },
  { value: 'sentence_blank', label: '예문 빈칸' },
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

export function TestConfigPanel({ config, onConfigChange, books, lessons }: Props) {
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

  const wordCount = getWordCount(lessons, config.lessonStart, config.lessonEnd);

  return (
    <div className="space-y-4">
      {/* Question Count */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">문제 수 설정</h3>
        <div className="flex flex-wrap gap-2">
          {QUESTION_COUNT_OPTIONS.map((count) => (
            <label key={count} className="flex items-center cursor-pointer">
              <input
                type="radio"
                checked={config.questionCount === count}
                onChange={() => update({ questionCount: count })}
                className="sr-only peer"
              />
              <span className="px-3 py-1.5 border border-border-subtle rounded-lg text-sm peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors">
                {count}문제
              </span>
            </label>
          ))}
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              checked={config.questionCount === -1}
              onChange={() => update({ questionCount: -1 })}
              className="sr-only peer"
            />
            <span className="px-3 py-1.5 border border-border-subtle rounded-lg text-sm peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors">
              직접입력
            </span>
          </label>
        </div>
        {config.questionCount === -1 && (
          <input
            type="number"
            min={1}
            max={200}
            value={config.customQuestionCount}
            onChange={(e) => update({ customQuestionCount: e.target.value })}
            placeholder="문제 수 입력"
            className="mt-3 w-32 px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
          />
        )}
      </div>

      {/* Per-Question Time */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">문제당 제한 시간</h3>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                checked={config.perQuestionTime === option.value}
                onChange={() => update({ perQuestionTime: option.value })}
                className="sr-only peer"
              />
              <span className="px-3 py-1.5 border border-border-subtle rounded-lg text-sm peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        {effectiveCount > 0 && (
          <p className="mt-3 text-xs text-text-tertiary">
            총 시간: {formatTotalTime(effectiveCount, config.perQuestionTime)}
          </p>
        )}
      </div>

      {/* Question Types */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">문제 유형</h3>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.questionTypes.includes(option.value)}
                onChange={() => toggleType(option.value)}
                className="sr-only peer"
              />
              <span className="px-3 py-1.5 border border-border-subtle rounded-lg text-sm peer-checked:bg-teal peer-checked:text-white peer-checked:border-teal transition-colors">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Scope */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">출제 범위</h3>
        <div className="space-y-3">
          {/* Book Selection */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">교재</label>
            <select
              value={config.bookName}
              onChange={(e) => update({ bookName: e.target.value, lessonStart: '', lessonEnd: '' })}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent bg-white"
            >
              <option value="">교재 선택</option>
              {books.map((book) => (
                <option key={book} value={book}>
                  {book}
                </option>
              ))}
            </select>
          </div>

          {/* Lesson Range */}
          {config.bookName && lessons.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  시작 레슨
                </label>
                <select
                  value={config.lessonStart}
                  onChange={(e) => update({ lessonStart: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent bg-white"
                >
                  <option value="">선택</option>
                  {lessons.map((l) => (
                    <option key={l.lesson} value={l.lesson}>
                      {l.lesson} ({l.word_count}개)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  끝 레슨
                </label>
                <select
                  value={config.lessonEnd}
                  onChange={(e) => update({ lessonEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent bg-white"
                >
                  <option value="">선택</option>
                  {lessons.map((l) => (
                    <option key={l.lesson} value={l.lesson}>
                      {l.lesson} ({l.word_count}개)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {wordCount > 0 && (
            <p className="text-xs text-text-tertiary">
              선택 범위: <span className="font-semibold text-teal">{wordCount}개</span> 단어
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TestConfigPanel;
