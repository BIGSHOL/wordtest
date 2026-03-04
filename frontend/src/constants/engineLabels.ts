/**
 * Centralized engine & skill area label constants.
 * Single source of truth — all Korean labels across the app derive from here.
 */

// ── Question type definitions ────────────────────────────────────────────

export interface QuestionTypeOption {
  value: string;
  label: string;
  desc: string;
}

export const QUESTION_TYPE_OPTIONS: QuestionTypeOption[] = [
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
  { value: 'sentence_type', label: '예문 타이핑', desc: '예문 빈칸에 맞는 단어 타이핑' },
  // Grammar types
  { value: 'grammar_blank', label: '빈칸 채우기', desc: '빈칸에 알맞은 말 고르기' },
  { value: 'grammar_error', label: '오류 탐지', desc: '틀린 부분 찾기' },
  { value: 'grammar_common', label: '공통 단어', desc: '공통으로 들어갈 단어 고르기' },
  { value: 'grammar_usage', label: '쓰임 구별', desc: '어법에 맞는 표현 고르기' },
  { value: 'grammar_transform', label: '문장 전환', desc: '문장을 다른 형태로 전환' },
  { value: 'grammar_order', label: '단어 배열', desc: '올바른 어순으로 배열' },
  { value: 'grammar_translate', label: '영작', desc: '한국어를 영어로 번역' },
  { value: 'grammar_pair', label: '짝짓기', desc: '(A)(B) 짝을 맞추기' },
];

/** Full label lookup: canonical name → Korean label */
export const ENGINE_FULL_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPE_OPTIONS.map(o => [o.value, o.label]),
);

/** Description lookup: canonical name → Korean description */
export const ENGINE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPE_OPTIONS.map(o => [o.value, o.desc]),
);

// ── Badge styles (compact table cells) ───────────────────────────────────

export interface BadgeStyle {
  label: string;
  bg: string;
  color: string;
}

export const QTYPE_BADGES: Record<string, BadgeStyle> = {
  en_to_ko:       { label: '영한',      bg: '#DBEAFE', color: '#2563EB' },
  ko_to_en:       { label: '한영',      bg: '#EDE9FE', color: '#7C3AED' },
  listen_en:      { label: '듣기(영)',   bg: '#D1FAE5', color: '#059669' },
  listen_ko:      { label: '듣기(한)',   bg: '#CCFBF1', color: '#0D9488' },
  listen_type:    { label: '듣기(타)',   bg: '#FEF3C7', color: '#D97706' },
  ko_type:        { label: '한영(타)',   bg: '#FEE2E2', color: '#DC2626' },
  emoji:          { label: '이모지',     bg: '#FCE7F3', color: '#DB2777' },
  sentence:       { label: '예문',       bg: '#E0E7FF', color: '#4F46E5' },
  antonym_type:   { label: '반의어(타)', bg: '#FFEDD5', color: '#EA580C' },
  antonym_choice: { label: '반의어',     bg: '#FED7AA', color: '#C2410C' },
  sentence_type:  { label: '예문(타)',   bg: '#C7D2FE', color: '#4338CA' },
};

// ── Exam briefing labels (with icons) ────────────────────────────────────

export interface BriefingStyle {
  label: string;
  icon: string;
  color: string;
}

export const EXAM_BRIEFING_LABELS: Record<string, BriefingStyle> = {
  en_to_ko:       { label: '영한 선택',     icon: '🇬🇧→🇰🇷', color: '#3B82F6' },
  ko_to_en:       { label: '한영 선택',     icon: '🇰🇷→🇬🇧', color: '#8B5CF6' },
  listen_en:      { label: '듣기 영어',     icon: '🎧🇬🇧',   color: '#10B981' },
  listen_ko:      { label: '듣기 한국어',   icon: '🎧🇰🇷',   color: '#14B8A6' },
  listen_type:    { label: '듣기 타이핑',   icon: '⌨️🎧',    color: '#F59E0B' },
  ko_type:        { label: '한영 타이핑',   icon: '⌨️🇬🇧',   color: '#EF4444' },
  emoji:          { label: '이모지',        icon: '😊🍎',    color: '#EC4899' },
  sentence:       { label: '예문 빈칸',     icon: '📝✏️',    color: '#6366F1' },
  antonym_type:   { label: '반의어 타이핑', icon: '🔄⌨️',    color: '#EA580C' },
  antonym_choice: { label: '반의어 고르기', icon: '🔄🔠',    color: '#C2410C' },
  sentence_type:  { label: '예문 타이핑',   icon: '📝⌨️',    color: '#4338CA' },
};

// ── Test engine type badges ──────────────────────────────────────────────

export const TEST_ENGINE_BADGES: Record<string, BadgeStyle> = {
  levelup: { label: '레벨업', bg: '#EBF8FA', color: '#2D9CAE' },
  legacy:  { label: '레거시', bg: '#F0F0EE', color: '#6D6C6A' },
};

// ── Skill area definitions (능력영역 6개) ─────────────────────────────────

export interface SkillAreaOption {
  value: string;
  label: string;
  desc: string;
  icon: string;
}

export const SKILL_AREA_OPTIONS: SkillAreaOption[] = [
  { value: 'meaning',       label: '의미파악력',   desc: '영어 단어의 뜻을 정확히 파악',       icon: '📖' },
  { value: 'association',   label: '단어연상력',   desc: '뜻/이미지에서 영어 단어 연상',       icon: '🔗' },
  { value: 'listening',     label: '발음청취력',   desc: '발음을 듣고 단어/뜻 파악',           icon: '👂' },
  { value: 'inference',     label: '어휘추론력',   desc: '문맥에서 빈칸에 맞는 단어 추론',     icon: '🧠' },
  { value: 'spelling',      label: '철자기억력',   desc: '듣기/뜻/반의어에서 철자 타이핑',     icon: '✏️' },
  { value: 'comprehensive', label: '종합응용력',   desc: '예문 문맥에서 단어를 타이핑하는 종합 응용 능력', icon: '⭐' },
];

/** Skill area label lookup */
export const SKILL_AREA_LABELS: Record<string, string> = Object.fromEntries(
  SKILL_AREA_OPTIONS.map(o => [o.value, o.label]),
);

// ── Skill area ↔ engine mapping ──────────────────────────────────────────

export const SKILL_TO_ENGINES: Record<string, string[]> = {
  meaning:       ['en_to_ko', 'antonym_choice'],
  association:   ['ko_to_en', 'emoji'],
  listening:     ['listen_en', 'listen_ko'],
  inference:     ['sentence'],
  spelling:      ['listen_type', 'ko_type', 'antonym_type'],
  comprehensive: ['sentence_type'],
};

/** Reverse mapping: engine → skill area */
export const ENGINE_TO_SKILL: Record<string, string> = Object.fromEntries(
  Object.entries(SKILL_TO_ENGINES).flatMap(([skill, engines]) =>
    engines.map(e => [e, skill]),
  ),
);

/** Skill area keys for radar/report (출제 5영역, comprehensive is computed) */
export const SKILL_AREA_KEYS = ['meaning', 'association', 'listening', 'inference', 'spelling'] as const;
export type SkillAreaKey = typeof SKILL_AREA_KEYS[number];

// ── Engine presets ────────────────────────────────────────────────────────

export const ENGINE_PRESETS = [
  { label: '기본', types: ['en_to_ko', 'ko_to_en'] },
  { label: '리스닝', types: ['listen_en', 'listen_ko', 'listen_type'] },
  { label: '전체', types: QUESTION_TYPE_OPTIONS.map(o => o.value) },
];
