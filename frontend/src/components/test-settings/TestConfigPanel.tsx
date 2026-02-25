/**
 * Test configuration panel - page-based wizard (up to 8 pages).
 *
 * Page 0: 학생 선택 (Student selection)
 * Page 1: 출제 범위 (Book/Lesson + Engine + Word count)
 * Page 2: 시간 설정 (Time type + value)
 * Page 3: 문제 수 (count picker + time summary)
 * Page 4: 문제 유형 (Engine 8 / Skill 6)
 * Page 5: 출제 순서 (drag reorder) - only when 2+ types selected
 * Page 6: 유형별 배분 (equal / manual) - only when 2+ types selected
 * Page 7: 설정 확인 (review & assign) - always shown as last step
 */
import { useState } from 'react';
import { Check, Info, Clock, Timer, Hash, Layers, ChevronLeft, ChevronRight, SplitSquareHorizontal, GripVertical, ArrowUpDown, Users, Search } from 'lucide-react';
import type { LessonInfo } from '../../services/word';
import type { User } from '../../types/auth';

// ── State ────────────────────────────────────────────────────────────────────

export interface TestConfigState {
  // Page 1: 시간 유형
  timeMode: 'per_question' | 'total';
  // Page 1: 시간 선택
  perQuestionTime: number;     // seconds (timeMode='per_question')
  customPerQuestionTime: string; // custom input (seconds string)
  totalTime: number;           // seconds (timeMode='total')
  customTotalTime: string;     // custom input (minutes string)
  // Page 2: 문제 수
  questionCount: number;
  customQuestionCount: string;
  // Page 3: 유형 선택 모드
  questionSelectionMode: 'engine' | 'skill';
  questionTypes: string[];     // 테스트유형 (8 engines)
  skillAreas: string[];        // 문제유형 (6 skill areas)
  // Engine
  engine: 'levelup' | 'legacy';
  // Scope
  bookStart: string;
  bookEnd: string;
  lessonStart: string;
  lessonEnd: string;
  // Page 4: 배분 설정
  distributionMode: 'equal' | 'manual';
  manualCounts: Record<string, number>;
  // Test name (optional, auto-generated if empty)
  configName: string;
}

interface Props {
  config: TestConfigState;
  onConfigChange: (config: TestConfigState) => void;
  books: string[];
  lessonsStart: LessonInfo[];
  lessonsEnd: LessonInfo[];
  wordCount?: number;
  compatibleCounts?: Record<string, number>;
  // Student selection (Step 0)
  students: User[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_COMPATIBLE_WORDS = 4;

const PER_QUESTION_TIME_OPTIONS = [
  { label: '5초', value: 5 },
  { label: '10초', value: 10 },
  { label: '15초', value: 15 },
  { label: '20초', value: 20 },
  { label: '30초', value: 30 },
];

const TOTAL_TIME_OPTIONS = [
  { label: '10분', value: 600 },
  { label: '20분', value: 1200 },
  { label: '30분', value: 1800 },
  { label: '50분', value: 3000 },
  { label: '80분', value: 4800 },
];

const QUESTION_COUNT_OPTIONS = [10, 20, 30, 50];

const QUESTION_TYPE_OPTIONS = [
  { value: 'en_to_ko', label: '영한', desc: '영어 단어 보고 한국어 뜻 고르기' },
  { value: 'ko_to_en', label: '한영', desc: '한국어 뜻 보고 영어 단어 고르기' },
  { value: 'listen_en', label: '듣기 영어', desc: '발음 듣고 영어 단어 고르기' },
  { value: 'listen_ko', label: '듣기 한국어', desc: '발음 듣고 한국어 뜻 고르기' },
  { value: 'listen_type', label: '듣기 타이핑', desc: '발음 듣고 영어 타이핑' },
  { value: 'ko_type', label: '한영 타이핑', desc: '한국어 뜻 보고 영어 타이핑' },
  { value: 'emoji', label: '이모지', desc: '이모지 보고 영어 단어 고르기' },
  { value: 'sentence', label: '예문 빈칸', desc: '예문의 빈칸에 맞는 단어 고르기' },
  { value: 'antonym_type', label: '반의어 타이핑', desc: '반의어를 영어로 타이핑' },
  { value: 'antonym_choice', label: '반의어 고르기', desc: '반의어를 4지선다로 고르기' },
];

const ENGINE_PRESETS = [
  { label: '기본', types: ['en_to_ko', 'ko_to_en'] },
  { label: '리스닝', types: ['listen_en', 'listen_ko', 'listen_type'] },
  { label: '전체', types: QUESTION_TYPE_OPTIONS.map(o => o.value) },
];

const SKILL_AREA_OPTIONS = [
  { value: 'meaning', label: '의미파악력', desc: '뜻을 파악할 수 있는 문장', icon: '📖' },
  { value: 'association', label: '단어연상력', desc: '연관 단어들', icon: '🔗' },
  { value: 'listening', label: '발음청취력', desc: '발음 혼동 단어/음성 힌트', icon: '👂' },
  { value: 'inference', label: '어휘추론력', desc: '문맥으로 추론하는 빈칸 문장', icon: '🧠' },
  { value: 'spelling', label: '철자기억력', desc: '철자 패턴/빈칸 철자', icon: '✏️' },
  { value: 'comprehensive', label: '종합응용력', desc: '실전 응용 문장', icon: '⭐' },
];

const PAGE_META = [
  { title: '학생 선택', icon: <Users className="w-3.5 h-3.5" /> },
  { title: '출제 범위', icon: <Layers className="w-3.5 h-3.5" /> },
  { title: '시간 설정', icon: <Clock className="w-3.5 h-3.5" /> },
  { title: '문제 수', icon: <Hash className="w-3.5 h-3.5" /> },
  { title: '문제 유형', icon: <Timer className="w-3.5 h-3.5" /> },
  { title: '출제 순서', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
  { title: '유형별 배분', icon: <SplitSquareHorizontal className="w-3.5 h-3.5" /> },
];

const RANK_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  Iron: { bg: '#E8E8E8', text: '#6D6C6A' },
  Bronze: { bg: '#CD7F3233', text: '#CD7F32' },
  Silver: { bg: '#C0C0C020', text: '#808080' },
  Gold: { bg: '#FFF8DC', text: '#B8860B' },
  Platinum: { bg: '#EBF8FA', text: '#2D9CAE' },
  Emerald: { bg: '#E8FAF0', text: '#5A8F6B' },
  Diamond: { bg: '#E0F0FF', text: '#4A7AB5' },
  Master: { bg: '#F0E8FF', text: '#7C3AED' },
  Grandmaster: { bg: '#FEF2F2', text: '#DC2626' },
  Challenger: { bg: '#FFF8DC', text: '#D4A843' },
  LEGEND: { bg: '#FFF5F5', text: '#999999' },
};

function getRankBadgeStyle(rank: string | null | undefined) {
  if (!rank) return { bg: '#F8F8F6', text: '#9C9B99' };
  return RANK_BADGE_STYLES[rank] || { bg: '#F8F8F6', text: '#9C9B99' };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
}

function computeEqualDistribution(types: string[], total: number): Record<string, number> {
  if (types.length === 0) return {};
  const base = Math.floor(total / types.length);
  const remainder = total - base * types.length;
  const result: Record<string, number> = {};
  types.forEach((t, i) => {
    result[t] = base + (i < remainder ? 1 : 0);
  });
  return result;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function OptionPill({
  selected, onClick, children,
}: {
  selected: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-lg text-[12px] whitespace-nowrap shrink-0 transition-all"
      style={{
        padding: '7px 12px',
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

function TabButton({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2 text-[12px] font-bold rounded-lg transition-all"
      style={{
        backgroundColor: active ? '#2D9CAE' : 'transparent',
        color: active ? 'white' : '#9C9B99',
      }}
    >
      {children}
    </button>
  );
}

const selectStyle = { border: '1px solid #E8E8E6' };

// ── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-4 py-2.5">
      {Array.from({ length: totalPages }).map((_, i) => {
        const isCompleted = i < currentPage;
        const isCurrent = i === currentPage;
        return (
          <div key={i} className="flex items-center">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
              style={{
                backgroundColor: isCompleted ? '#2D9CAE' : isCurrent ? '#2D9CAE' : '#F0F0EE',
                color: isCompleted || isCurrent ? 'white' : '#9C9B99',
                border: isCurrent ? '2px solid #2D9CAE' : 'none',
              }}
            >
              {isCompleted ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            {i < totalPages - 1 && (
              <div
                className="w-4 h-0.5 mx-1"
                style={{ backgroundColor: i < currentPage ? '#2D9CAE' : '#E8E8E6' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page Components ─────────────────────────────────────────────────────────

function PageStudents({
  students, selectedIds, onToggle, onToggleAll,
}: {
  students: User[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = students.filter((s) => {
    const term = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.school_name && s.school_name.toLowerCase().includes(term))
    );
  });

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Header: select all */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-text-secondary">
          테스트를 출제할 학생을 선택합니다
        </span>
        <button onClick={onToggleAll} className="flex items-center gap-1.5">
          <span
            className="w-4 h-4 rounded flex items-center justify-center shrink-0"
            style={{
              backgroundColor: allSelected ? '#2D9CAE' : 'transparent',
              border: allSelected ? 'none' : '2px solid #E8E8E6',
            }}
          >
            {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
          </span>
          <span className="text-[11px] font-medium text-text-secondary">전체</span>
        </button>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 h-9 rounded-lg mb-3 shrink-0"
        style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6', padding: '0 12px' }}
      >
        <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
        <input
          type="text"
          placeholder="이름 또는 학교로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      </div>

      {/* Student list */}
      <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-2 content-start">
        {filtered.length === 0 ? (
          <div className="col-span-2 py-6 text-center text-[12px] text-text-tertiary">
            {search ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
          </div>
        ) : (
          filtered.map((student) => {
            const isSelected = selectedIds.has(student.id);
            const badge = getRankBadgeStyle(student.latest_rank);
            const schoolInfo = [student.school_name, student.grade].filter(Boolean).join(' ');
            return (
              <button
                key={student.id}
                onClick={() => onToggle(student.id)}
                className="flex items-center gap-2.5 rounded-lg transition-colors text-left"
                style={{
                  backgroundColor: isSelected ? '#EBF8FA' : '#F8F8F6',
                  border: isSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                  padding: isSelected ? '7px 11px' : '8px 12px',
                }}
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isSelected ? '#2D9CAE' : 'transparent',
                    border: isSelected ? 'none' : '2px solid #E8E8E6',
                  }}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span
                  className="text-[12px] font-semibold truncate min-w-0 flex-1"
                  style={{ color: isSelected ? '#2D9CAE' : '#3D3D3C' }}
                >
                  {student.name}{schoolInfo ? ` · ${schoolInfo}` : ''}
                </span>
                {student.latest_rank && (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {student.latest_level != null ? `Lv.${student.latest_level} ` : ''}
                    {student.latest_rank}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Skip hint when no students selected */}
      {selectedIds.size === 0 && (
        <div
          className="flex items-center gap-2 rounded-lg mt-3 shrink-0"
          style={{ backgroundColor: '#FFF8DC', padding: '8px 12px' }}
        >
          <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#B8860B' }} />
          <span className="text-[11px] font-medium" style={{ color: '#B8860B' }}>
            학생 없이 진행하면 테스트만 먼저 생성되며, 나중에 학생에게 배정할 수 있습니다.
          </span>
        </div>
      )}

      {/* Selected count */}
      <div
        className="flex items-center gap-2 rounded-lg mt-3 shrink-0"
        style={{ backgroundColor: selectedIds.size > 0 ? '#EBF8FA' : '#F8F8F6', padding: '8px 12px' }}
      >
        <Users className="w-3.5 h-3.5" style={{ color: selectedIds.size > 0 ? '#2D9CAE' : '#9C9B99' }} />
        <span className="text-[11px] font-medium" style={{ color: selectedIds.size > 0 ? '#2D9CAE' : '#9C9B99' }}>
          {selectedIds.size}명 선택됨
        </span>
      </div>
    </div>
  );
}

function PageScope({
  config, update, books, lessonsStart, lessonsEnd, wordCount,
}: {
  config: TestConfigState;
  update: (p: Partial<TestConfigState>) => void;
  books: string[];
  lessonsStart: LessonInfo[];
  lessonsEnd: LessonInfo[];
  wordCount: number;
}) {
  const isCrossBook = !!config.bookStart && !!config.bookEnd && config.bookStart !== config.bookEnd;
  const [showCrossBook, setShowCrossBook] = useState(isCrossBook);
  const isSameBook = config.bookStart === config.bookEnd;

  const handleBookChange = (book: string) => {
    if (showCrossBook) {
      update({ bookStart: book, lessonStart: '' });
    } else {
      update({ bookStart: book, bookEnd: book, lessonStart: '', lessonEnd: '' });
    }
  };

  const handleCrossBookToggle = (checked: boolean) => {
    setShowCrossBook(checked);
    if (!checked && config.bookStart) {
      update({ bookEnd: config.bookStart, lessonEnd: '' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Engine */}
      <div>
        <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">테스트 엔진</span>
        <div className="flex flex-wrap gap-2">
          <OptionPill
            selected={config.engine === 'levelup'}
            onClick={() => update({ engine: 'levelup' })}
          >
            레벨업 (적응형)
          </OptionPill>
          <OptionPill
            selected={config.engine === 'legacy'}
            onClick={() => update({ engine: 'legacy' })}
          >
            레거시 (고정형)
          </OptionPill>
        </div>
      </div>

      {/* Scope */}
      <div>
        <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">출제 범위</span>
        <div className="space-y-3">
          {/* Start: book + lesson (single-book: full row lessons, cross-book: inline) */}
          <div>
            <span className="text-[10px] text-text-tertiary mb-1 block">{showCrossBook ? '시작' : '교재'}</span>
            <div className="flex items-center gap-2">
              <select
                value={config.bookStart}
                onChange={(e) => handleBookChange(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                style={selectStyle}
              >
                <option value="">교재 선택</option>
                {books.map((book) => (
                  <option key={book} value={book}>{book}</option>
                ))}
              </select>
              {showCrossBook && config.bookStart && lessonsStart.length > 0 && (
                <select
                  value={config.lessonStart}
                  onChange={(e) => update({ lessonStart: e.target.value })}
                  className="px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                  style={{ ...selectStyle, width: 150 }}
                >
                  <option value="">시작 레슨</option>
                  {lessonsStart.map((l) => (
                    <option key={l.lesson} value={l.lesson}>{l.lesson}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Lesson range (single-book mode) */}
          {config.bookStart && lessonsStart.length > 0 && !showCrossBook && (
            <div>
              <span className="text-[10px] text-text-tertiary mb-1 block">레슨 범위</span>
              <div className="flex items-center gap-2">
                <select
                  value={config.lessonStart}
                  onChange={(e) => update({ lessonStart: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                  style={selectStyle}
                >
                  <option value="">시작 레슨</option>
                  {lessonsStart.map((l) => (
                    <option key={l.lesson} value={l.lesson}>{l.lesson}</option>
                  ))}
                </select>
                <span className="text-sm font-bold text-text-tertiary px-1">~</span>
                <select
                  value={config.lessonEnd}
                  onChange={(e) => update({ lessonEnd: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                  style={selectStyle}
                >
                  <option value="">끝 레슨</option>
                  {lessonsStart.map((l) => (
                    <option key={l.lesson} value={l.lesson}>{l.lesson}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Cross-book toggle */}
          <button
            type="button"
            onClick={() => handleCrossBookToggle(!showCrossBook)}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <div
              className="w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0"
              style={{
                borderColor: showCrossBook ? '#2D9CAE' : '#D0D0CE',
                backgroundColor: showCrossBook ? '#2D9CAE' : '#FFFFFF',
              }}
            >
              {showCrossBook && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-[11px] text-text-secondary">다른 교재까지 범위 지정</span>
          </button>

          {/* End book + lesson (cross-book mode) */}
          {showCrossBook && config.bookStart && (
            <div>
              <span className="text-[10px] text-text-tertiary mb-1 block">종료</span>
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
                    style={{ ...selectStyle, width: 150 }}
                  >
                    <option value="">끝 레슨</option>
                    {lessonsEnd.map((l) => (
                      <option key={l.lesson} value={l.lesson}>{l.lesson}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

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

function PageTime({
  config, update,
}: {
  config: TestConfigState;
  update: (p: Partial<TestConfigState>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Time mode */}
      <div>
        <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">시간 유형</span>
        <div className="flex flex-wrap gap-2">
          <OptionPill
            selected={config.timeMode === 'per_question'}
            onClick={() => update({ timeMode: 'per_question' })}
          >
            문제당 시간
          </OptionPill>
          <OptionPill
            selected={config.timeMode === 'total'}
            onClick={() => update({ timeMode: 'total' })}
          >
            전체 시간
          </OptionPill>
        </div>
        <div
          className="flex items-center gap-2 rounded-lg mt-3"
          style={{ backgroundColor: '#EBF8FA', padding: '10px 14px' }}
        >
          <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#2D9CAE' }} />
          <span className="text-[11px] font-medium" style={{ color: '#2D9CAE' }}>
            {config.timeMode === 'per_question'
              ? '각 문제마다 제한 시간이 주어집니다. 시간 초과 시 자동으로 다음 문제로 넘어갑니다.'
              : '전체 시험 시간 내에서 자유롭게 문제를 이동하고 답을 변경할 수 있습니다.'}
          </span>
        </div>
      </div>

      {/* Time value */}
      <div>
        <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">
          {config.timeMode === 'per_question' ? '문제당 제한 시간' : '전체 제한 시간'}
        </span>
        {config.timeMode === 'per_question' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {PER_QUESTION_TIME_OPTIONS.map((opt) => (
                <OptionPill
                  key={opt.value}
                  selected={config.perQuestionTime === opt.value && config.customPerQuestionTime === ''}
                  onClick={() => update({ perQuestionTime: opt.value, customPerQuestionTime: '' })}
                >
                  {opt.label}
                </OptionPill>
              ))}
              <OptionPill
                selected={config.customPerQuestionTime !== ''}
                onClick={() => {
                  update({
                    customPerQuestionTime: String(config.perQuestionTime || 10),
                    perQuestionTime: config.perQuestionTime || 10,
                  });
                }}
              >
                직접 입력
              </OptionPill>
            </div>
            {config.customPerQuestionTime !== '' && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={config.customPerQuestionTime}
                  onChange={(e) => {
                    const secs = parseInt(e.target.value) || 0;
                    update({ customPerQuestionTime: e.target.value, perQuestionTime: secs });
                  }}
                  className="w-20 px-3 py-1.5 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal"
                  style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
                />
                <span className="text-[13px] text-text-secondary">초</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {TOTAL_TIME_OPTIONS.map((opt) => (
                <OptionPill
                  key={opt.value}
                  selected={config.totalTime === opt.value && config.customTotalTime === ''}
                  onClick={() => update({ totalTime: opt.value, customTotalTime: '' })}
                >
                  {opt.label}
                </OptionPill>
              ))}
              <OptionPill
                selected={config.customTotalTime !== ''}
                onClick={() => {
                  update({
                    customTotalTime: String(Math.floor(config.totalTime / 60) || 10),
                    totalTime: config.totalTime || 600,
                  });
                }}
              >
                직접 입력
              </OptionPill>
            </div>
            {config.customTotalTime !== '' && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={config.customTotalTime}
                  onChange={(e) => {
                    const mins = parseInt(e.target.value) || 0;
                    update({ customTotalTime: e.target.value, totalTime: mins * 60 });
                  }}
                  className="w-20 px-3 py-1.5 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal"
                  style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
                />
                <span className="text-[13px] text-text-secondary">분</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PageCount({
  config, update,
}: {
  config: TestConfigState;
  update: (p: Partial<TestConfigState>) => void;
}) {
  const effectiveCount =
    config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;

  const timeSummary = (() => {
    if (config.timeMode === 'per_question' && effectiveCount > 0) {
      const total = effectiveCount * config.perQuestionTime;
      return `${effectiveCount}문제 × ${config.perQuestionTime}초 = 총 ${formatTime(total)}`;
    }
    if (config.timeMode === 'total' && effectiveCount > 0) {
      const avg = (config.totalTime / effectiveCount).toFixed(1);
      return `전체 ${formatTime(config.totalTime)} (문제당 평균 ${avg}초)`;
    }
    return null;
  })();

  return (
    <div className="space-y-3">
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
          className="mt-1 w-28 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal"
          style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
        />
      )}
      {timeSummary && (
        <div
          className="flex items-center gap-2 rounded-lg"
          style={{ backgroundColor: '#EBF8FA', padding: '10px 14px' }}
        >
          <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#2D9CAE' }} />
          <span className="text-[11px] font-medium" style={{ color: '#2D9CAE' }}>
            {timeSummary}
          </span>
        </div>
      )}
    </div>
  );
}

function PageTypes({
  config, update, compatibleCounts,
}: {
  config: TestConfigState;
  update: (p: Partial<TestConfigState>) => void;
  compatibleCounts: Record<string, number>;
}) {
  const hasRange = !!(config.bookStart && config.bookEnd && config.lessonStart && config.lessonEnd);

  const isTypeDisabled = (type: string) => {
    if (!hasRange || Object.keys(compatibleCounts).length === 0) return false;
    return (compatibleCounts[type] ?? 0) < MIN_COMPATIBLE_WORDS;
  };

  const toggleQuestionType = (type: string) => {
    if (isTypeDisabled(type)) return;
    const current = config.questionTypes;
    if (current.includes(type)) {
      update({ questionTypes: current.filter(t => t !== type) });
    } else {
      update({ questionTypes: [...current, type] });
    }
  };

  const toggleSkillArea = (area: string) => {
    const current = config.skillAreas;
    if (current.includes(area)) {
      update({ skillAreas: current.filter(a => a !== area) });
    } else {
      update({ skillAreas: [...current, area] });
    }
  };

  const applyPreset = (types: string[]) => {
    const enabled = types.filter(t => !isTypeDisabled(t));
    update({ questionTypes: enabled });
  };

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{ backgroundColor: '#F0F0EE' }}
      >
        <TabButton
          active={config.questionSelectionMode === 'engine'}
          onClick={() => update({ questionSelectionMode: 'engine' })}
        >
          테스트 유형
        </TabButton>
        <TabButton
          active={config.questionSelectionMode === 'skill'}
          onClick={() => update({ questionSelectionMode: 'skill' })}
        >
          문제 유형
        </TabButton>
      </div>

      {config.questionSelectionMode === 'engine' ? (
        <>
          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {ENGINE_PRESETS.map((preset) => {
              const isMatch =
                preset.types.length === config.questionTypes.length &&
                preset.types.every(t => config.questionTypes.includes(t));
              return (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset.types)}
                  className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: isMatch ? '#2D9CAE' : '#F0F0EE',
                    color: isMatch ? 'white' : '#6D6C6A',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Checkbox grid */}
          <div className="grid grid-cols-2 gap-2">
            {QUESTION_TYPE_OPTIONS.map((option) => {
              const isSelected = config.questionTypes.includes(option.value);
              const disabled = isTypeDisabled(option.value);
              const count = compatibleCounts[option.value];
              const showCount = hasRange && count !== undefined;
              return (
                <button
                  key={option.value}
                  onClick={() => toggleQuestionType(option.value)}
                  className="flex items-center gap-2.5 rounded-lg transition-all text-left"
                  style={{
                    padding: '10px 12px',
                    backgroundColor: disabled ? '#F3F3F1' : isSelected ? '#EBF8FA' : '#F8F8F6',
                    border: disabled ? '1px solid #E8E8E6' : isSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                    opacity: disabled ? 0.55 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span
                    className="rounded flex items-center justify-center shrink-0"
                    style={{
                      width: 16, height: 16,
                      backgroundColor: disabled ? '#D1D5DB' : isSelected ? '#2D9CAE' : 'transparent',
                      border: disabled ? 'none' : isSelected ? 'none' : '2px solid #D1D5DB',
                      borderRadius: 4,
                    }}
                  >
                    {isSelected && !disabled && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[12px] font-bold"
                        style={{ color: disabled ? '#9CA3AF' : isSelected ? '#2D9CAE' : '#3D3D3C' }}
                      >
                        {option.label}
                      </span>
                      {showCount && (
                        <span
                          className="text-[9px] font-medium px-1 rounded"
                          style={{
                            backgroundColor: disabled ? '#FEE2E2' : '#E5E7EB',
                            color: disabled ? '#DC2626' : '#6B7280',
                          }}
                        >
                          {count}단어
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: disabled ? '#9CA3AF' : '#6D6C6A' }}>
                      {disabled ? `호환 단어 부족 (${MIN_COMPATIBLE_WORDS}개 미만)` : option.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {config.questionTypes.length === 0 && (
            <div
              className="flex items-center gap-2 rounded-lg"
              style={{ backgroundColor: '#FEF2F2', padding: '10px 14px' }}
            >
              <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#DC2626' }} />
              <span className="text-[11px] font-medium" style={{ color: '#DC2626' }}>
                최소 1개 이상의 테스트 유형을 선택해주세요
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {SKILL_AREA_OPTIONS.map((area) => {
              const isSelected = config.skillAreas.includes(area.value);
              return (
                <button
                  key={area.value}
                  onClick={() => toggleSkillArea(area.value)}
                  className="flex items-center gap-2.5 rounded-lg transition-all text-left"
                  style={{
                    padding: '12px',
                    backgroundColor: isSelected ? '#EBF8FA' : '#F8F8F6',
                    border: isSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                  }}
                >
                  <span className="text-base shrink-0">{area.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[12px] font-bold block"
                      style={{ color: isSelected ? '#2D9CAE' : '#3D3D3C' }}
                    >
                      {area.label}
                    </span>
                    <span className="text-[10px] block truncate" style={{ color: '#6D6C6A' }}>
                      {area.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {config.skillAreas.length === 0 && (
            <div
              className="flex items-center gap-2 rounded-lg"
              style={{ backgroundColor: '#FEF2F2', padding: '10px 14px' }}
            >
              <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#DC2626' }} />
              <span className="text-[11px] font-medium" style={{ color: '#DC2626' }}>
                최소 1개 이상의 문제 유형을 선택해주세요
              </span>
            </div>
          )}

          <div
            className="flex items-center gap-2 rounded-lg"
            style={{ backgroundColor: '#FFF8DC', padding: '10px 14px' }}
          >
            <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#B8860B' }} />
            <span className="text-[11px] font-medium" style={{ color: '#B8860B' }}>
              선택한 영역에 맞는 문제가 자동으로 구성됩니다
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function PageOrder({
  config, update,
}: {
  config: TestConfigState;
  update: (p: Partial<TestConfigState>) => void;
}) {
  const isEngine = config.questionSelectionMode === 'engine';
  const items = isEngine ? config.questionTypes : config.skillAreas;
  const OPTIONS = isEngine ? QUESTION_TYPE_OPTIONS : SKILL_AREA_OPTIONS;
  const key = isEngine ? 'questionTypes' : 'skillAreas';

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    const arr = [...items];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    update({ [key]: arr });
    setDragIdx(null);
    setOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-text-secondary">
        드래그하여 출제 순서를 변경하세요. 위에 있을수록 먼저 출제됩니다.
      </div>
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const opt = OPTIONS.find(o => o.value === item);
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== idx;
          return (
            <div
              key={item}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-3 rounded-lg cursor-grab active:cursor-grabbing transition-all"
              style={{
                padding: '10px 14px',
                backgroundColor: isDragging ? '#F0FDFA' : isOver ? '#EBF8FA' : '#F8F8F6',
                border: isOver ? '2px solid #2D9CAE' : isDragging ? '2px dashed #2D9CAE' : '1px solid #E8E8E6',
                opacity: isDragging ? 0.6 : 1,
              }}
            >
              <GripVertical className="w-4 h-4 shrink-0" style={{ color: '#B0AFAD' }} />
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ backgroundColor: '#2D9CAE', color: 'white' }}
              >
                {idx + 1}
              </span>
              {'icon' in (opt || {}) && (
                <span className="text-sm shrink-0">{(opt as { icon?: string })?.icon}</span>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-bold" style={{ color: '#3D3D3C' }}>
                  {opt?.label || item}
                </span>
                {'desc' in (opt || {}) && (
                  <span className="text-[10px] ml-2" style={{ color: '#9C9B99' }}>
                    {(opt as { desc?: string })?.desc}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageDistribution({
  config, update,
}: {
  config: TestConfigState;
  update: (p: Partial<TestConfigState>) => void;
}) {
  const selectedTypes = config.questionSelectionMode === 'engine'
    ? config.questionTypes
    : config.skillAreas;

  const effectiveCount =
    config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;

  const equalDist = computeEqualDistribution(selectedTypes, effectiveCount);

  const manualSum = selectedTypes.reduce(
    (sum, t) => sum + (config.manualCounts[t] ?? 0),
    0
  );

  const handleManualChange = (type: string, value: string) => {
    const n = parseInt(value) || 0;
    update({
      manualCounts: { ...config.manualCounts, [type]: n },
    });
  };

  const handleSelectManual = () => {
    // Pre-populate manualCounts with equal distribution when switching to manual
    const prefilled: Record<string, number> = {};
    selectedTypes.forEach((t) => {
      prefilled[t] = config.manualCounts[t] !== undefined
        ? config.manualCounts[t]
        : equalDist[t] ?? 0;
    });
    update({ distributionMode: 'manual', manualCounts: prefilled });
  };

  const typeLabel = (type: string) => {
    const opt = QUESTION_TYPE_OPTIONS.find(o => o.value === type)
      || SKILL_AREA_OPTIONS.find(o => o.value === type);
    return opt?.label ?? type;
  };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{ backgroundColor: '#F0F0EE' }}
      >
        <TabButton
          active={config.distributionMode === 'equal'}
          onClick={() => update({ distributionMode: 'equal' })}
        >
          균등 배분
        </TabButton>
        <TabButton
          active={config.distributionMode === 'manual'}
          onClick={handleSelectManual}
        >
          직접 지정
        </TabButton>
      </div>

      {/* Unified container for both modes */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E8E6' }}>
        {selectedTypes.map((t, idx) => (
          <div
            key={t}
            className="flex items-center justify-between"
            style={{
              padding: '10px 14px',
              backgroundColor: '#F8F8F6',
              borderBottom: idx < selectedTypes.length - 1 ? '1px solid #EEEEEC' : undefined,
            }}
          >
            <span className="text-[12px]" style={{ color: '#6D6C6A' }}>{typeLabel(t)}</span>
            {config.distributionMode === 'equal' ? (
              <span className="text-[12px] font-semibold" style={{ color: '#3D3D3C' }}>{equalDist[t] ?? 0}개</span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={effectiveCount}
                  value={config.manualCounts[t] ?? ''}
                  onChange={(e) => handleManualChange(t, e.target.value)}
                  className="w-14 px-2 py-1 rounded-lg text-[12px] text-center focus:outline-none focus:ring-2 focus:ring-teal"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E8E6' }}
                />
                <span className="text-[11px] text-text-tertiary">개</span>
              </div>
            )}
          </div>
        ))}
        {config.distributionMode === 'manual' && (
          <div
            className="flex items-center justify-between"
            style={{ padding: '10px 14px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FFFFFF' }}
          >
            <span className="text-[12px] font-semibold text-text-secondary">합계</span>
            <span
              className="text-[12px] font-bold"
              style={{ color: manualSum === effectiveCount ? '#5A8F6B' : '#EF4444' }}
            >
              {manualSum} / {effectiveCount} {manualSum === effectiveCount ? '✓' : ''}
            </span>
          </div>
        )}
      </div>

      {config.distributionMode === 'manual' && manualSum !== effectiveCount && (
        <div
          className="flex items-center gap-2 rounded-lg"
          style={{ backgroundColor: '#FEF2F2', padding: '8px 12px' }}
        >
          <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#DC2626' }} />
          <span className="text-[11px] font-medium" style={{ color: '#DC2626' }}>
            합계가 문제 수({effectiveCount})와 일치해야 합니다
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function TestConfigPanel({
  config, onConfigChange, books, lessonsStart, lessonsEnd,
  wordCount = 0, compatibleCounts = {},
  students, selectedIds, onToggle, onToggleAll,
}: Props) {
  const [currentPage, setCurrentPage] = useState(0);

  const update = (partial: Partial<TestConfigState>) => {
    onConfigChange({ ...config, ...partial });
  };

  const selectedTypes = config.questionSelectionMode === 'engine'
    ? config.questionTypes
    : config.skillAreas;

  const totalPages = selectedTypes.length >= 2 ? 7 : 5;

  const pageTitles = selectedTypes.length >= 2
    ? PAGE_META
    : PAGE_META.slice(0, 5);

  const effectiveCount =
    config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;

  const canGoNext = (() => {
    // Page 0: student selection is optional (can skip)
    if (currentPage === 0) {
      return true;
    }
    // Page 1: scope must be set
    if (currentPage === 1) {
      return !!(config.bookStart && config.bookEnd && config.lessonStart && config.lessonEnd);
    }
    // Page 4: at least one type selected
    if (currentPage === 4) {
      return selectedTypes.length > 0;
    }
    // Page 6 (distribution): manual sum must match (only when 7 pages)
    if (currentPage === 6 && totalPages === 7 && config.distributionMode === 'manual') {
      const sum = selectedTypes.reduce((s, t) => s + (config.manualCounts[t] ?? 0), 0);
      return sum === effectiveCount;
    }
    return true;
  })();

  const goNext = () => { if (canGoNext) setCurrentPage(p => Math.min(p + 1, totalPages - 1)); };
  const goPrev = () => setCurrentPage(p => Math.max(p - 1, 0));

  const isLastPage = currentPage === totalPages - 1;

  return (
    <div>
      {/* Page header + Step Indicator */}
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text-primary font-display">테스트 출제</h2>
          <p className="text-xs text-text-secondary">
            학생을 선택하고 테스트를 설정한 뒤 출제합니다
          </p>
        </div>
        <StepIndicator currentPage={currentPage} totalPages={totalPages} />
      </div>

      {/* Wizard card */}
      <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid #E8E8E6' }}>
        {/* Page title */}
        <div
          className="flex items-center gap-2.5"
          style={{ padding: '16px 28px', borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
        >
          <span style={{ color: '#2D9CAE' }}>{pageTitles[currentPage]?.icon}</span>
          <span className="text-[15px] font-bold text-text-primary">{pageTitles[currentPage]?.title}</span>
        </div>

        {/* Page content */}
        <div className="overflow-y-auto" style={{ padding: '24px 28px', height: 520 }}>
          {currentPage === 0 && (
            <PageStudents
              students={students}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onToggleAll={onToggleAll}
            />
          )}
          {currentPage === 1 && (
            <PageScope
              config={config}
              update={update}
              books={books}
              lessonsStart={lessonsStart}
              lessonsEnd={lessonsEnd}
              wordCount={wordCount}
            />
          )}
          {currentPage === 2 && (
            <PageTime config={config} update={update} />
          )}
          {currentPage === 3 && (
            <PageCount config={config} update={update} />
          )}
          {currentPage === 4 && (
            <PageTypes config={config} update={update} compatibleCounts={compatibleCounts} />
          )}
          {currentPage === 5 && totalPages === 7 && (
            <PageOrder config={config} update={update} />
          )}
          {currentPage === 6 && totalPages === 7 && (
            <PageDistribution config={config} update={update} />
          )}
        </div>

        {/* Navigation */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '14px 28px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
        >
        {currentPage > 0 ? (
          <button
            onClick={goPrev}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
            style={{
              backgroundColor: '#F8F8F6',
              border: '1px solid #E8E8E6',
              color: '#6D6C6A',
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>
        ) : (
          <div />
        )}

        {!isLastPage && (
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)',
            }}
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

export default TestConfigPanel;
