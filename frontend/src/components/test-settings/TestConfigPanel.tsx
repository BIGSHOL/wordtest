/**
 * Test configuration panel - 4-step wizard.
 *
 * Step 1: 시간 유형 (문제당 / 전체)
 * Step 2: 시간 선택 (유형에 따라 다른 옵션)
 * Step 3: 문제 수
 * Step 4: 유형 선택 (테스트유형 8엔진 / 문제유형 6영역)
 *
 * + 출제 범위 (교재/레슨)
 */
import { useState } from 'react';
import { Check, Info, Clock, Timer, Hash, Layers } from 'lucide-react';
import type { LessonInfo } from '../../services/word';

// ── State ────────────────────────────────────────────────────────────────────

export interface TestConfigState {
  // Step 1: 시간 유형
  timeMode: 'per_question' | 'total';
  // Step 2: 시간 선택
  perQuestionTime: number;     // seconds (timeMode='per_question')
  totalTime: number;           // seconds (timeMode='total')
  customTotalTime: string;     // custom input (minutes string)
  // Step 3: 문제 수
  questionCount: number;
  customQuestionCount: string;
  // Step 4: 유형 선택 모드
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
}

interface Props {
  config: TestConfigState;
  onConfigChange: (config: TestConfigState) => void;
  books: string[];
  lessonsStart: LessonInfo[];
  lessonsEnd: LessonInfo[];
  wordCount?: number;
  compatibleCounts?: Record<string, number>;
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
  { label: '3분', value: 180 },
  { label: '5분', value: 300 },
  { label: '10분', value: 600 },
  { label: '15분', value: 900 },
  { label: '20분', value: 1200 },
  { label: '30분', value: 1800 },
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
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

function StepHeader({ step, icon, title }: { step: number; icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
        style={{ backgroundColor: '#2D9CAE' }}
      >
        {step}
      </span>
      <span className="flex items-center gap-1.5">
        {icon}
        <h3 className="text-[13px] font-bold text-text-primary">{title}</h3>
      </span>
    </div>
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

function Divider() {
  return <div style={{ borderTop: '1px solid #F0F0EE', margin: '0 24px' }} />;
}

const selectStyle = { border: '1px solid #E8E8E6' };

// ── Main Component ──────────────────────────────────────────────────────────

export function TestConfigPanel({
  config, onConfigChange, books, lessonsStart, lessonsEnd,
  wordCount = 0, compatibleCounts = {},
}: Props) {
  const update = (partial: Partial<TestConfigState>) => {
    onConfigChange({ ...config, ...partial });
  };

  const hasRange = !!(config.bookStart && config.bookEnd && config.lessonStart && config.lessonEnd);

  const isTypeDisabled = (type: string) => {
    if (!hasRange || Object.keys(compatibleCounts).length === 0) return false;
    return (compatibleCounts[type] ?? 0) < MIN_COMPATIBLE_WORDS;
  };

  const effectiveCount =
    config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;

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

  const isSameBook = config.bookStart === config.bookEnd;

  // Time summary
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

      {/* ── Step 1: 시간 유형 ──────────────────────────────────────────── */}
      <div style={{ padding: '18px 24px' }}>
        <StepHeader step={1} icon={<Clock className="w-3.5 h-3.5" style={{ color: '#2D9CAE' }} />} title="시간 유형" />
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

      <Divider />

      {/* ── Step 2: 시간 선택 ──────────────────────────────────────────── */}
      <div style={{ padding: '18px 24px' }}>
        <StepHeader
          step={2}
          icon={<Timer className="w-3.5 h-3.5" style={{ color: '#2D9CAE' }} />}
          title={config.timeMode === 'per_question' ? '문제당 제한 시간' : '전체 제한 시간'}
        />

        {config.timeMode === 'per_question' ? (
          /* Per-question time options */
          <div className="flex flex-wrap gap-2">
            {PER_QUESTION_TIME_OPTIONS.map((opt) => (
              <OptionPill
                key={opt.value}
                selected={config.perQuestionTime === opt.value}
                onClick={() => update({ perQuestionTime: opt.value })}
              >
                {opt.label}
              </OptionPill>
            ))}
          </div>
        ) : (
          /* Total time options */
          <>
            <div className="flex flex-wrap gap-2">
              {TOTAL_TIME_OPTIONS.map((opt) => (
                <OptionPill
                  key={opt.value}
                  selected={config.totalTime === opt.value}
                  onClick={() => update({ totalTime: opt.value, customTotalTime: '' })}
                >
                  {opt.label}
                </OptionPill>
              ))}
              <OptionPill
                selected={config.customTotalTime !== ''}
                onClick={() => {
                  update({
                    customTotalTime: String(Math.floor(config.totalTime / 60) || 5),
                    totalTime: config.totalTime || 300,
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

      <Divider />

      {/* ── Step 3: 문제 수 ────────────────────────────────────────────── */}
      <div style={{ padding: '18px 24px' }}>
        <StepHeader step={3} icon={<Hash className="w-3.5 h-3.5" style={{ color: '#2D9CAE' }} />} title="문제 수" />
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

        {/* Time summary */}
        {timeSummary && (
          <div
            className="flex items-center gap-2 rounded-lg mt-3"
            style={{ backgroundColor: '#EBF8FA', padding: '10px 14px' }}
          >
            <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#2D9CAE' }} />
            <span className="text-[11px] font-medium" style={{ color: '#2D9CAE' }}>
              {timeSummary}
            </span>
          </div>
        )}
      </div>

      <Divider />

      {/* ── Step 4: 유형 선택 ──────────────────────────────────────────── */}
      <div style={{ padding: '18px 24px' }}>
        <StepHeader step={4} icon={<Layers className="w-3.5 h-3.5" style={{ color: '#2D9CAE' }} />} title="유형 선택" />

        {/* Tab switcher */}
        <div
          className="flex gap-1 p-1 rounded-lg mb-4"
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
          /* ── Engine selection (existing 8 engines) ── */
          <>
            {/* Presets */}
            <div className="flex gap-2 mb-3">
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
                className="flex items-center gap-2 rounded-lg mt-3"
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
          /* ── Skill area selection (6 areas) ── */
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
                className="flex items-center gap-2 rounded-lg mt-3"
                style={{ backgroundColor: '#FEF2F2', padding: '10px 14px' }}
              >
                <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#DC2626' }} />
                <span className="text-[11px] font-medium" style={{ color: '#DC2626' }}>
                  최소 1개 이상의 문제 유형을 선택해주세요
                </span>
              </div>
            )}

            <div
              className="flex items-center gap-2 rounded-lg mt-3"
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

      <Divider />

      {/* ── Engine Type ────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 24px' }}>
        <h3 className="text-[13px] font-bold text-text-primary mb-3">테스트 엔진</h3>
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

      <Divider />

      {/* ── Scope ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 24px' }}>
        <h3 className="text-[13px] font-bold text-text-primary mb-3">출제 범위</h3>
        <div className="space-y-3">
          {/* Start */}
          <div>
            <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">시작</span>
            <div className="flex items-center gap-2">
              <select
                value={config.bookStart}
                onChange={(e) => update({
                  bookStart: e.target.value,
                  lessonStart: '',
                  bookEnd: config.bookEnd || e.target.value,
                  lessonEnd: config.bookEnd ? config.lessonEnd : '',
                })}
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

          <div className="flex justify-center">
            <span className="text-sm font-bold text-text-tertiary">~</span>
          </div>

          {/* End */}
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
