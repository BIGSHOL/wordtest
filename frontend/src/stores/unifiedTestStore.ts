/**
 * Unified Test Store - dual mode support.
 *
 * time_mode = 'per_question': per-question timer, immediate feedback, auto-advance
 * time_mode = 'total': exam mode — briefing, free navigation, batch submit
 *
 * Both modes: idle → briefing → testing → (submitting) → complete
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from './auth';
import { getErrorMessage } from '../utils/error';
import type { User } from '../types/auth';
import { wordLevelToRank } from '../types/rank';
import {
  unifiedTestService,
  type UnifiedQuestion,
  type AnswerResult,
  type StartLevelupResponse,
  type StartLegacyResponse,
  type BatchAnswerItem,
} from '../services/unifiedTest';

// ── XP (per-question mode, levelup engine) ──────────────────────────────────

function getLessonXp(book: number, numLevels: number = 15): number {
  // MASTERY_SYSTEM.md: 5 + book * 5, scaled by available levels
  return (5 + book * 5) * Math.max(1, Math.ceil(15 / numLevels));
}

export interface XpBreakdown {
  base: number;
  speed: number;
  combo: number;
  total: number;
}

function computeXpChange(params: {
  isCorrect: boolean;
  questionLevel: number;
  currentBook: number;
  timeTaken: number;
  timerLimit: number;
  combo: number;
  consecutiveWrong: number;
}): XpBreakdown {
  const { isCorrect, questionLevel, currentBook, timeTaken, timerLimit, combo, consecutiveWrong } = params;
  if (isCorrect) {
    // MASTERY_SYSTEM.md: +7 current level, +3 lower level
    const base = questionLevel < currentBook ? 3 : 7;
    // Speed bonus: answer in ≤50% of timer → +5
    const speed = (timerLimit > 0 && timeTaken <= timerLimit * 0.5) ? 5 : 0;
    // Combo bonus: 3-4→+1, 5-9→+2, 10-14→+3, 15-19→+4, 20+→+5
    let comboBonus = 0;
    if (combo >= 20) comboBonus = 5;
    else if (combo >= 15) comboBonus = 4;
    else if (combo >= 10) comboBonus = 3;
    else if (combo >= 5) comboBonus = 2;
    else if (combo >= 3) comboBonus = 1;
    return { base, speed, combo: comboBonus, total: base + speed + comboBonus };
  } else {
    // Escalating penalties: -5, -8, -12
    let penalty = -5;
    if (consecutiveWrong >= 3) penalty = -12;
    else if (consecutiveWrong >= 2) penalty = -8;
    return { base: penalty, speed: 0, combo: 0, total: penalty };
  }
}

/** Build flatQuestions from typeSequence using questions from a specific level pool.
 *  Preserves already-answered questions (indices < fromIndex).
 *  For remaining slots, picks questions matching the type from the target level.
 */
function _buildFlatFromTypeSequence(
  typeSequence: string[],
  targetLevel: number,
  levelPools: Record<number, UnifiedQuestion[]>,
  existing?: UnifiedQuestion[],
  fromIndex: number = 0,
): UnifiedQuestion[] {
  const pool = levelPools[targetLevel] ?? [];
  const poolByType: Record<string, UnifiedQuestion[]> = {};
  for (const q of pool) {
    const t = q.question_type;
    if (!poolByType[t]) poolByType[t] = [];
    poolByType[t].push(q);
  }

  // Track used word_mastery_ids to avoid duplicates
  const usedIds = new Set<string>();
  const result: UnifiedQuestion[] = existing ? [...existing] : [];

  // Mark already-used questions
  for (let i = 0; i < fromIndex && i < result.length; i++) {
    if (result[i]) usedIds.add(result[i].word_mastery_id);
  }

  const typeUsed: Record<string, number> = {};
  for (let i = fromIndex; i < typeSequence.length; i++) {
    const expectedType = typeSequence[i];
    const candidates = poolByType[expectedType] ?? [];
    let placed = false;
    const startIdx = typeUsed[expectedType] ?? 0;
    for (let j = startIdx; j < candidates.length; j++) {
      if (!usedIds.has(candidates[j].word_mastery_id)) {
        result[i] = candidates[j];
        usedIds.add(candidates[j].word_mastery_id);
        typeUsed[expectedType] = j + 1;
        placed = true;
        break;
      }
    }
    // Fallback: keep existing question if available, or pick any from pool
    if (!placed && existing && existing[i]) {
      result[i] = existing[i];
    }
  }
  return result;
}

/** Exam mode: track when each question was first shown (Date.now()) */
const _questionFirstShown: Record<number, number> = {};
/** Exam mode: recorded time in seconds for each question (first answer moment) */
const _questionTimeTaken: Record<number, number> = {};

function _resetExamTimers() {
  for (const k of Object.keys(_questionFirstShown)) delete _questionFirstShown[Number(k)];
  for (const k of Object.keys(_questionTimeTaken)) delete _questionTimeTaken[Number(k)];
}

function _markQuestionShown(index: number) {
  if (!(index in _questionFirstShown)) {
    _questionFirstShown[index] = Date.now();
  }
}

function _recordFirstAnswer(index: number) {
  if (!(index in _questionTimeTaken) && index in _questionFirstShown) {
    _questionTimeTaken[index] = Math.round((Date.now() - _questionFirstShown[index]) / 1000 * 10) / 10;
  }
}

// ── Store Interface ─────────────────────────────────────────────────────────

export interface UnifiedTestStore {
  // Mode
  engineType: 'levelup' | 'legacy' | null;
  timeMode: 'per_question' | 'total';

  // Phase: idle → briefing → testing → submitting → complete
  phase: 'idle' | 'briefing' | 'testing' | 'submitting' | 'complete';

  // Session
  sessionId: string | null;
  assignmentId: string | null;
  studentName: string;
  questionCount: number;
  perQuestionTime: number;
  totalTimeSeconds: number;

  // Briefing info
  briefingInfo: {
    bookName: string | null;
    bookNameEnd: string | null;
    lessonStart: string | null;
    lessonEnd: string | null;
    questionTypes: string | null;
    studentSchool: string;
    studentGrade: string;
    configName: string;
  } | null;

  // Flat question list (both modes use this for navigation)
  flatQuestions: UnifiedQuestion[];
  currentQuestionIndex: number;

  // Local answers (exam mode: stored until batch submit)
  localAnswers: Record<number, string>;
  localTypedAnswers: Record<number, string>;

  // Level-Up specific
  typeSequence: string[];  // Fixed type order for exam mode adaptive
  levelPools: Record<number, UnifiedQuestion[]>;
  poolIndex: Record<number, number>;
  currentBook: number;
  xp: number;
  availableLevels: number[];
  levelInfo: Record<number, number>;
  lastXpChange: XpBreakdown | null;
  levelChanged: 'up' | 'down' | null;

  // Legacy specific
  questions: UnifiedQuestion[];
  currentIndex: number;

  // Per-question mode answer state
  selectedAnswer: string | null;
  typedAnswer: string;
  answerResult: AnswerResult | null;
  feedbackQuestion: UnifiedQuestion | null;
  consecutiveWrong: number;
  bookStreak: number; // consecutive correct answers in current book (need ≥5 to level up)
  isSubmitting: boolean;

  // Shared progress
  totalAnswered: number;
  correctCount: number;
  combo: number;
  bestCombo: number;

  // UI state
  isLoading: boolean;
  error: string | null;
  isComplete: boolean;
  finalResult: {
    accuracy: number;
    totalAnswered: number;
    correctCount: number;
    finalLevel?: number;
    bestCombo?: number;
  } | null;

  // Actions — shared
  startLevelup: (code: string, allowRestart?: boolean) => Promise<StartLevelupResponse>;
  startLegacy: (code: string, allowRestart?: boolean) => Promise<StartLegacyResponse>;
  startExam: () => void;
  goToQuestion: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  setLocalAnswer: (index: number, answer: string) => void;
  setLocalTypedAnswer: (index: number, text: string) => void;
  reset: () => void;

  // Actions — exam mode (total time)
  submitAllAnswers: () => Promise<void>;

  // Actions — per-question mode
  selectAnswer: (answer: string) => void;
  setTypedAnswer: (text: string) => void;
  submitAnswer: (timeTaken: number, isTimeout?: boolean) => Promise<AnswerResult | null>;
  nextQuestion: () => void;
  complete: () => Promise<void>;
}

// ── Helper: get current question ────────────────────────────────────────────

export function useCurrentQuestion(): UnifiedQuestion | null {
  return useUnifiedTestStore(state => {
    if (state.timeMode === 'per_question' && state.feedbackQuestion) {
      return state.feedbackQuestion;
    }
    return state.flatQuestions[state.currentQuestionIndex] ?? null;
  });
}

// ── Initial State ───────────────────────────────────────────────────────────

const initialState = {
  engineType: null as 'levelup' | 'legacy' | null,
  timeMode: 'per_question' as 'per_question' | 'total',
  phase: 'idle' as UnifiedTestStore['phase'],
  sessionId: null as string | null,
  assignmentId: null as string | null,
  studentName: '',
  questionCount: 0,
  perQuestionTime: 10,
  totalTimeSeconds: 0,

  briefingInfo: null as UnifiedTestStore['briefingInfo'],

  flatQuestions: [] as UnifiedQuestion[],
  currentQuestionIndex: 0,

  localAnswers: {} as Record<number, string>,
  localTypedAnswers: {} as Record<number, string>,

  typeSequence: [] as string[],
  levelPools: {} as Record<number, UnifiedQuestion[]>,
  poolIndex: {} as Record<number, number>,
  currentBook: 1,
  xp: 0,
  availableLevels: [] as number[],
  levelInfo: {} as Record<number, number>,
  lastXpChange: null as XpBreakdown | null,
  levelChanged: null as 'up' | 'down' | null,

  questions: [] as UnifiedQuestion[],
  currentIndex: 0,

  selectedAnswer: null as string | null,
  typedAnswer: '',
  answerResult: null as AnswerResult | null,
  feedbackQuestion: null as UnifiedQuestion | null,
  consecutiveWrong: 0,
  bookStreak: 0,
  isSubmitting: false,

  totalAnswered: 0,
  correctCount: 0,
  combo: 0,
  bestCombo: 0,

  isLoading: false,
  error: null as string | null,
  isComplete: false,
  finalResult: null as UnifiedTestStore['finalResult'],
};

// ── Store ───────────────────────────────────────────────────────────────────

export const useUnifiedTestStore = create<UnifiedTestStore>((set, get) => ({
  ...initialState,

  // ── Start Level-Up ──────────────────────────────────────────────────

  startLevelup: async (code, allowRestart = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await unifiedTestService.startLevelup(code, allowRestart);

      if (response.access_token) {
        useAuthStore.getState().setTokenDirect(response.access_token, {
          id: response.student_id,
          name: response.student_name,
          role: 'student',
          email: null, username: null, teacher_id: null,
          school_name: null, grade: null, phone_number: null,
          created_at: '', updated_at: '',
        } as User);
      }

      const tm = response.time_mode || 'per_question';

      // Group questions by word level (for adaptive per_question mode)
      const pools: Record<number, UnifiedQuestion[]> = {};
      const indexes: Record<number, number> = {};
      for (const q of response.questions) {
        const level = q.word.level;
        if (!pools[level]) { pools[level] = []; indexes[level] = 0; }
        pools[level].push(q);
      }

      // Type sequence from backend (exam mode adaptive)
      const typeSeq: string[] = response.type_sequence ?? [];

      // Build flatQuestions from typeSequence + starting level pool
      let flat: UnifiedQuestion[];
      if (typeSeq.length > 0) {
        flat = _buildFlatFromTypeSequence(typeSeq, response.current_level, pools);
      } else {
        flat = [...response.questions];
      }

      set({
        engineType: 'levelup',
        timeMode: tm,
        phase: 'briefing',
        sessionId: response.session_id,
        assignmentId: response.assignment_id,
        studentName: response.student_name,
        questionCount: response.question_count,
        perQuestionTime: response.per_question_time,
        totalTimeSeconds: response.total_time_seconds,
        currentBook: response.current_level,
        availableLevels: response.available_levels,
        levelInfo: response.level_info,
        typeSequence: typeSeq,
        levelPools: pools,
        poolIndex: indexes,
        flatQuestions: flat,
        currentQuestionIndex: 0,
        localAnswers: {},
        localTypedAnswers: {},
        xp: 0,
        bookStreak: 0,
        briefingInfo: {
          bookName: response.book_name ?? null,
          bookNameEnd: response.book_name_end ?? null,
          lessonStart: response.lesson_range_start ?? null,
          lessonEnd: response.lesson_range_end ?? null,
          questionTypes: response.question_types ?? null,
          studentSchool: response.student_school ?? '',
          studentGrade: response.student_grade ?? '',
          configName: response.config_name ?? '',
        },
        isLoading: false,
      });

      return response;
    } catch (e) {
      set({ isLoading: false, error: getErrorMessage(e, '오류가 발생했습니다') });
      throw e;
    }
  },

  // ── Start Legacy ────────────────────────────────────────────────────

  startLegacy: async (code, allowRestart = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await unifiedTestService.startLegacy(code, allowRestart);

      if (response.access_token) {
        useAuthStore.getState().setTokenDirect(response.access_token, {
          id: response.student_id,
          name: response.student_name,
          role: 'student',
          email: null, username: null, teacher_id: null,
          school_name: null, grade: null, phone_number: null,
          created_at: '', updated_at: '',
        } as User);
      }

      const tm = response.time_mode || 'per_question';

      set({
        engineType: 'legacy',
        timeMode: tm,
        phase: 'briefing',
        sessionId: response.session_id,
        assignmentId: response.assignment_id,
        studentName: response.student_name,
        questionCount: response.question_count,
        perQuestionTime: response.per_question_time,
        totalTimeSeconds: response.total_time_seconds,
        questions: response.questions,
        flatQuestions: response.questions,
        currentQuestionIndex: 0,
        currentIndex: 0,
        localAnswers: {},
        localTypedAnswers: {},
        briefingInfo: {
          bookName: response.book_name ?? null,
          bookNameEnd: response.book_name_end ?? null,
          lessonStart: response.lesson_range_start ?? null,
          lessonEnd: response.lesson_range_end ?? null,
          questionTypes: response.question_types ?? null,
          studentSchool: response.student_school ?? '',
          studentGrade: response.student_grade ?? '',
          configName: response.config_name ?? '',
        },
        isLoading: false,
      });

      return response;
    } catch (e) {
      set({ isLoading: false, error: getErrorMessage(e, '오류가 발생했습니다') });
      throw e;
    }
  },

  // ── Shared Actions ─────────────────────────────────────────────────

  startExam: () => {
    _resetExamTimers();
    _markQuestionShown(0);
    set({ phase: 'testing' });
  },

  goToQuestion: (index) => {
    const { flatQuestions } = get();
    if (index >= 0 && index < flatQuestions.length) {
      _markQuestionShown(index);
      set({ currentQuestionIndex: index });
    }
  },

  goNext: () => {
    const { currentQuestionIndex, flatQuestions } = get();
    if (currentQuestionIndex < flatQuestions.length - 1) {
      _markQuestionShown(currentQuestionIndex + 1);
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  goPrev: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      _markQuestionShown(currentQuestionIndex - 1);
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },

  setLocalAnswer: (index, answer) => {
    _recordFirstAnswer(index);
    set(state => ({ localAnswers: { ...state.localAnswers, [index]: answer } }));
  },

  setLocalTypedAnswer: (index, text) => {
    if (text) _recordFirstAnswer(index);
    set(state => ({ localTypedAnswers: { ...state.localTypedAnswers, [index]: text } }));
  },

  reset: () => {
    _resetExamTimers();
    set(initialState);
  },

  // ══════════════════════════════════════════════════════════════════════
  // ── Exam Mode (total time) ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  submitAllAnswers: async () => {
    const state = get();
    if (!state.sessionId || state.phase !== 'testing' || state.timeMode !== 'total') return;
    set({ phase: 'submitting' });

    try {
      const answers: BatchAnswerItem[] = state.flatQuestions.map((q, i) => ({
        word_mastery_id: q.word_mastery_id,
        selected_answer: q.choices
          ? (state.localAnswers[i] || '')
          : (state.localTypedAnswers[i] || ''),
        question_type: q.question_type,
        time_taken_seconds: _questionTimeTaken[i] ?? null,
      }));

      if (state.engineType === 'levelup') {
        const result = await unifiedTestService.submitLevelupBatch(
          state.sessionId, answers, state.availableLevels, state.availableLevels[0] || 1,
        );
        set({
          phase: 'complete', isComplete: true,
          finalResult: {
            accuracy: result.accuracy, totalAnswered: result.total_answered,
            correctCount: result.correct_count, finalLevel: result.final_level,
            bestCombo: result.best_combo,
          },
        });
      } else {
        const result = await unifiedTestService.submitLegacyBatch(state.sessionId, answers);
        set({
          phase: 'complete', isComplete: true,
          finalResult: {
            accuracy: result.accuracy, totalAnswered: result.total_answered,
            correctCount: result.correct_count,
          },
        });
      }
    } catch (e) {
      set({ phase: 'testing', error: getErrorMessage(e, '제출 중 오류가 발생했습니다') });
    }
  },

  // ══════════════════════════════════════════════════════════════════════
  // ── Per-Question Mode ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  selectAnswer: (answer) => set({ selectedAnswer: answer }),
  setTypedAnswer: (text) => set({ typedAnswer: text }),

  submitAnswer: async (timeTaken, isTimeout = false) => {
    const state = get();
    if (state.timeMode !== 'per_question') return null;
    if (state.isSubmitting || !state.sessionId) return null;

    const question = state.flatQuestions[state.currentQuestionIndex];
    if (!question) return null;

    const selectedAnswer = question.choices ? state.selectedAnswer : state.typedAnswer;
    if (!selectedAnswer && !isTimeout) return null;

    set({ isSubmitting: true });

    try {
      const submitFn = state.engineType === 'levelup'
        ? unifiedTestService.submitLevelupAnswer
        : unifiedTestService.submitLegacyAnswer;

      const result = await submitFn(state.sessionId!, {
        word_mastery_id: question.word_mastery_id,
        selected_answer: selectedAnswer || '',
        time_taken_seconds: timeTaken,
        question_type: question.question_type,
      });

      const newCombo = result.is_correct ? state.combo + 1 : 0;
      const newBestCombo = Math.max(state.bestCombo, newCombo);
      const newCorrectCount = state.correctCount + (result.is_correct ? 1 : 0);
      const newConsecutiveWrong = result.is_correct ? 0 : state.consecutiveWrong + 1;
      const newTotalAnswered = state.totalAnswered + 1;

      // Level-Up: XP + book streak
      let newXp = state.xp;
      let newBook = state.currentBook;
      let newBookStreak = result.is_correct ? state.bookStreak + 1 : 0;
      let xpChange: XpBreakdown | null = null;
      let levelChanged: 'up' | 'down' | null = null;

      if (state.engineType === 'levelup') {
        xpChange = computeXpChange({
          isCorrect: result.is_correct,
          questionLevel: question.word.level,
          currentBook: state.currentBook,
          timeTaken,
          timerLimit: question.timer_seconds,
          combo: newCombo,
          consecutiveWrong: newConsecutiveWrong,
        });
        newXp = Math.max(0, state.xp + xpChange.total);
        const lessonXp = getLessonXp(state.currentBook, state.availableLevels.length);

        // Level up: XP threshold met AND at least 5 consecutive correct
        if (newXp >= lessonXp && newBookStreak >= 5) {
          const nextLevels = state.availableLevels.filter(l => l > state.currentBook);
          if (nextLevels.length > 0) {
            newBook = nextLevels[0]; newXp = 0; levelChanged = 'up';
            newBookStreak = 0;
          }
        }
      }

      // On level-up: rebuild remaining questions from new level pool (sync)
      let newFlatQuestions = state.flatQuestions;
      if (levelChanged === 'up' && state.typeSequence.length > 0) {
        newFlatQuestions = _buildFlatFromTypeSequence(
          state.typeSequence, newBook, state.levelPools,
          state.flatQuestions, state.currentQuestionIndex + 1,
        );
      }

      set({
        answerResult: result,
        feedbackQuestion: question,
        flatQuestions: newFlatQuestions,
        isSubmitting: false,
        combo: newCombo,
        bestCombo: newBestCombo,
        correctCount: newCorrectCount,
        consecutiveWrong: newConsecutiveWrong,
        bookStreak: newBookStreak,
        totalAnswered: newTotalAnswered,
        xp: newXp,
        currentBook: newBook,
        lastXpChange: xpChange,
        levelChanged,
      });

      return result;
    } catch (e) {
      set({ isSubmitting: false, error: getErrorMessage(e, '오류가 발생했습니다') });
      return null;
    }
  },

  nextQuestion: () => {
    const state = get();
    if (state.timeMode !== 'per_question') return;

    if (state.totalAnswered >= state.questionCount) {
      get().complete();
      return;
    }

    set({
      currentQuestionIndex: state.currentQuestionIndex + 1,
      selectedAnswer: null,
      typedAnswer: '',
      answerResult: null,
      feedbackQuestion: null,
      levelChanged: null,
    });
  },

  complete: async () => {
    const state = get();
    if (!state.sessionId || state.timeMode !== 'per_question') return;

    try {
      if (state.engineType === 'levelup') {
        const result = await unifiedTestService.completeLevelup(
          state.sessionId, state.currentBook, state.bestCombo,
        );
        set({
          phase: 'complete', isComplete: true,
          finalResult: {
            accuracy: result.accuracy, totalAnswered: result.total_answered,
            correctCount: result.correct_count, finalLevel: result.final_level,
            bestCombo: result.best_combo,
          },
        });
      } else {
        const result = await unifiedTestService.completeLegacy(state.sessionId);
        set({
          phase: 'complete', isComplete: true,
          finalResult: {
            accuracy: result.accuracy, totalAnswered: result.total_answered,
            correctCount: result.correct_count,
          },
        });
      }
    } catch (e) {
      set({ error: getErrorMessage(e, '오류가 발생했습니다') });
    }
  },
}));

// ── Derived Selectors ───────────────────────────────────────────────────────

export function useLevelupProgress() {
  return useUnifiedTestStore(useShallow(state => ({
    currentBook: state.currentBook,
    xp: state.xp,
    lessonXp: getLessonXp(state.currentBook, state.availableLevels.length),
    rank: wordLevelToRank(state.currentBook),
    totalAnswered: state.totalAnswered,
    questionCount: state.flatQuestions.length || state.questionCount,
    combo: state.combo,
    bestCombo: state.bestCombo,
    correctCount: state.correctCount,
    lastXpChange: state.lastXpChange,
    levelChanged: state.levelChanged,
  })));
}

export function useLegacyProgress() {
  return useUnifiedTestStore(useShallow(state => ({
    currentIndex: state.currentQuestionIndex,
    totalQuestions: state.flatQuestions.length,
    totalAnswered: state.totalAnswered,
    correctCount: state.correctCount,
    combo: state.combo,
  })));
}
