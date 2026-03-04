import type { GrammarQuestionBrowse } from '../../types/grammar';

export type ValidationLevel = 'error' | 'warn' | 'ok';

export interface ValidationResult {
  level: ValidationLevel;
  messages: string[];
}

export function validateQuestion(q: GrammarQuestionBrowse): ValidationResult {
  const messages: string[] = [];
  let level: ValidationLevel = 'ok';
  const d = q.question_data;

  if (q.question_type === 'grammar_blank') {
    const stem = d.stem || '';
    const choices = d.choices || [];

    // ERROR: no blank marker in stem
    if (stem && !stem.includes('___') && !stem.includes('__') && !/\[[^\]]+\/[^\]]+\]/.test(stem)) {
      messages.push('stem에 빈칸(___) 없음');
      level = 'error';
    }

    // ERROR: all choices identical
    if (choices.length > 1 && new Set(choices).size === 1) {
      messages.push('보기가 모두 동일함');
      level = 'error';
    }

    // ERROR: duplicate choices (some identical)
    if (choices.length > 1 && new Set(choices).size < choices.length && new Set(choices).size > 1) {
      messages.push('중복 보기 있음');
      if (level !== 'error') level = 'warn';
    }

    // WARN: no prompt field
    if (!d.prompt) {
      messages.push('프롬프트 미설정 (기본값 사용)');
      if (level !== 'error') level = 'warn';
    }

    // ERROR: correct_index out of range
    if (d.correct_index != null && d.correct_index >= choices.length) {
      messages.push('정답 인덱스 범위 초과');
      level = 'error';
    }

    // ERROR: choices empty
    if (!choices || choices.length === 0) {
      messages.push('보기 없음');
      level = 'error';
    }
  }

  if (q.question_type === 'grammar_error') {
    const sentences = d.sentences || [];
    const correctIndices = d.correct_indices || [];
    const selectCount = d.select_count;

    // ERROR: correct_index out of range
    for (const ci of correctIndices) {
      if (ci != null && ci >= sentences.length) {
        messages.push(`정답 인덱스 ${ci} 범위 초과 (문장 ${sentences.length}개)`);
        level = 'error';
      }
    }

    // WARN: select_count mismatch
    if (selectCount != null && typeof selectCount === 'number' && correctIndices.length !== selectCount) {
      messages.push(`select_count(${selectCount}) ≠ 정답 수(${correctIndices.length})`);
      if (level !== 'error') level = 'warn';
    }

    // ERROR: missing select_count
    if (selectCount == null) {
      messages.push('select_count 미설정');
      if (level !== 'error') level = 'warn';
    }

    // ERROR: no sentences
    if (sentences.length === 0) {
      messages.push('문장 없음');
      level = 'error';
    }
  }

  if (q.question_type === 'grammar_order') {
    const words = d.words || [];

    // ERROR: words empty
    if (words.length === 0) {
      messages.push('단어 목록 비어있음');
      level = 'error';
    }

    // ERROR: no correct answer
    if (!d.correct_answer) {
      messages.push('정답 없음');
      level = 'error';
    }
  }

  if (q.question_type === 'grammar_common') {
    const prompt = d.prompt || '';
    const hasChoices = d.choices && d.choices.length > 0;
    const hasWrite = prompt.includes('쓰세요');
    const hasSelect = prompt.includes('고르세요');

    if (!hasChoices && !hasWrite && !hasSelect) {
      messages.push('변형 판단 불가 (보기/쓰세요/고르세요 없음)');
      if (level !== 'error') level = 'warn';
    }
  }

  if (q.question_type === 'grammar_usage') {
    if (d.correct_index != null && d.correct_index >= (d.sentences || []).length) {
      messages.push('정답 인덱스 범위 초과');
      level = 'error';
    }
  }

  if (q.question_type === 'grammar_pair') {
    if (d.correct_index != null && d.correct_index >= (d.paired_choices || []).length) {
      messages.push('정답 인덱스 범위 초과');
      level = 'error';
    }
  }

  if (q.question_type === 'grammar_transform') {
    if (!d.original) { messages.push('원문 없음'); level = 'error'; }
    if (!d.correct_answer) { messages.push('정답 없음'); level = 'error'; }
  }

  if (q.question_type === 'grammar_translate') {
    if (!d.sentence_ko) { messages.push('한국어 문장 없음'); level = 'error'; }
    if (!d.correct_answer) { messages.push('정답 없음'); level = 'error'; }
  }

  // Inactive question
  if (!q.is_active) {
    messages.unshift('비활성화됨');
  }

  return { level, messages };
}
