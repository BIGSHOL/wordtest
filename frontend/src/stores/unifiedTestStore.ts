/**
 * Unified Test Store - handles both Level-Up (adaptive) and Legacy (fixed) engines.
 *
 * Level-Up: XP-based adaptive difficulty within teacher's book range.
 * Legacy: Fixed difficulty, all questions served in easy→hard order.
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
} from '../services/unifiedTest';

const DEFAULT_QUESTION_COUNT = 50;

/** Track ongoing prefetches to avoid duplicate requests */
const _prefetchingLevels = new Set<number>();

// ── XP Configuration (reused from masteryStore) ─────────────────────────────

function getLessonXp(book: number): number {
  return 4 + book;
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
  combo: number;
  consecutiveWrong: number;
}): XpBreakdown {
  const { isCorrect, questionLevel, currentBook, timeTaken, combo, consecutiveWrong } = params;

  if (isCorrect) {
    const base = questionLevel < currentBook
      ? Math.max(4, currentBook)
      : 8 + currentBook * 2;
    let speed = 0;
    if (timeTaken <= 1) speed = 5;
    else if (timeTaken <= 2) speed = 4;
    else if (timeTaken <= 3) speed = 3;
    else if (timeTaken <= 5) speed = 2;
    else if (timeTaken <= 8) speed = 1;
    const comboBonus = combo >= 3 ? Math.min(Math.floor(combo / 5) + 1, 5) : 0;
    return { base, speed, combo: comboBonus, total: base + speed + comboBonus };
  } else {
    let penalty: number;
    if (consecutiveWrong >= 2) penalty = -(8 + currentBook);
    else if (consecutiveWrong >= 1) penalty = -(5 + currentBook);
    else penalty = -(3 + currentBook);
    return { base: penalty, speed: 0, combo: 0, total: penalty };
  }
}

// ── Store Interface ─────────────────────────────────────────────────────────

export interface UnifiedTestStore {
  // Engine mode
  engineType: 'levelup' | 'legacy' | null;

  // Session
  sessionId: string | null;
  assignmentId: string | null;
  studentName: string;
  questionCount: number;
  perQuestionTime: number;

  // Level-Up specific
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

  // Shared progress
  totalAnswered: number;
  correctCount: number;
  combo: number;
  bestCombo: number;
  consecutiveWrong: number;

  // Answer state
  selectedAnswer: string | null;
  typedAnswer: string;
  answerResult: AnswerResult | null;
  feedbackQuestion: UnifiedQuestion | null;

  // UI state
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  isComplete: boolean;
  finalResult: {
    accuracy: number;
    totalAnswered: number;
    correctCount: number;
    finalLevel?: number;
    bestCombo?: number;
  } | null;

  // Actions
  startLevelup: (code: string, allowRestart?: boolean) => Promise<StartLevelupResponse>;
  startLegacy: (code: string, allowRestart?: boolean) => Promise<StartLegacyResponse>;
  selectAnswer: (answer: string) => void;
  setTypedAnswer: (text: string) => void;
  submitAnswer: (timeTaken: number, isTimeout?: boolean) => Promise<AnswerResult | null>;
  nextQuestion: () => void;
  complete: () => Promise<void>;
  reset: () => void;
}

// ── Helper: get current question ────────────────────────────────────────────

export function useCurrentQuestion(): UnifiedQuestion | null {
  return useUnifiedTestStore(state => {
    if (state.feedbackQuestion) return state.feedbackQuestion;
    if (state.engineType === 'levelup') {
      const pool = state.levelPools[state.currentBook];
      const idx = state.poolIndex[state.currentBook] ?? 0;
      return pool?.[idx] ?? null;
    }
    if (state.engineType === 'legacy') {
      return state.questions[state.currentIndex] ?? null;
    }
    return null;
  });
}

// ── Store ────────────────────────────────────────────────────────────────────

const initialState = {
  engineType: null as 'levelup' | 'legacy' | null,
  sessionId: null as string | null,
  assignmentId: null as string | null,
  studentName: '',
  questionCount: DEFAULT_QUESTION_COUNT,
  perQuestionTime: 10,

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

  totalAnswered: 0,
  correctCount: 0,
  combo: 0,
  bestCombo: 0,
  consecutiveWrong: 0,

  selectedAnswer: null as string | null,
  typedAnswer: '',
  answerResult: null as AnswerResult | null,
  feedbackQuestion: null as UnifiedQuestion | null,

  isLoading: false,
  isSubmitting: false,
  error: null as string | null,
  isComplete: false,
  finalResult: null as UnifiedTestStore['finalResult'],
};

export const useUnifiedTestStore = create<UnifiedTestStore>((set, get) => ({
  ...initialState,

  // ── Start Level-Up ──────────────────────────────────────────────────

  startLevelup: async (code, allowRestart = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await unifiedTestService.startLevelup(code, allowRestart);

      // Set auth token for unauthenticated student access
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

      // Group questions by word level
      const pools: Record<number, UnifiedQuestion[]> = {};
      const indexes: Record<number, number> = {};
      for (const q of response.questions) {
        const level = q.word.level;
        if (!pools[level]) {
          pools[level] = [];
          indexes[level] = 0;
        }
        pools[level].push(q);
      }

      set({
        engineType: 'levelup',
        sessionId: response.session_id,
        assignmentId: response.assignment_id,
        studentName: response.student_name,
        questionCount: response.question_count,
        perQuestionTime: response.per_question_time,
        currentBook: response.current_level,
        availableLevels: response.available_levels,
        levelInfo: response.level_info,
        levelPools: pools,
        poolIndex: indexes,
        xp: 0,
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

      set({
        engineType: 'legacy',
        sessionId: response.session_id,
        assignmentId: response.assignment_id,
        studentName: response.student_name,
        questionCount: response.question_count,
        perQuestionTime: response.per_question_time,
        questions: response.questions,
        currentIndex: 0,
        isLoading: false,
      });

      return response;
    } catch (e) {
      set({ isLoading: false, error: getErrorMessage(e, '오류가 발생했습니다') });
      throw e;
    }
  },

  // ── Answer Selection ────────────────────────────────────────────────

  selectAnswer: (answer) => set({ selectedAnswer: answer }),
  setTypedAnswer: (text) => set({ typedAnswer: text }),

  // ── Submit Answer ───────────────────────────────────────────────────

  submitAnswer: async (timeTaken, isTimeout = false) => {
    const state = get();
    if (state.isSubmitting || !state.sessionId) return null;

    const question = state.feedbackQuestion
      ? null  // Already submitted, shouldn't happen
      : state.engineType === 'levelup'
        ? state.levelPools[state.currentBook]?.[state.poolIndex[state.currentBook] ?? 0]
        : state.questions[state.currentIndex];

    if (!question) return null;

    const selectedAnswer = question.choices
      ? state.selectedAnswer
      : state.typedAnswer;

    // Allow timeout submits even without an answer selected
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

      // Level-Up: compute XP change and handle level transitions
      let newXp = state.xp;
      let newBook = state.currentBook;
      let xpChange: XpBreakdown | null = null;
      let levelChanged: 'up' | 'down' | null = null;

      if (state.engineType === 'levelup') {
        xpChange = computeXpChange({
          isCorrect: result.is_correct,
          questionLevel: question.word.level,
          currentBook: state.currentBook,
          timeTaken,
          combo: newCombo,
          consecutiveWrong: newConsecutiveWrong,
        });
        newXp = state.xp + xpChange.total;

        const lessonXp = getLessonXp(state.currentBook);

        // Level up
        if (newXp >= lessonXp) {
          const nextLevels = state.availableLevels.filter(l => l > state.currentBook);
          if (nextLevels.length > 0) {
            newBook = nextLevels[0];
            newXp = 0;
            levelChanged = 'up';
            // Prefetch questions for new level
            _prefetchLevel(state.sessionId!, newBook);
          }
        }
        // Level down
        else if (newXp < 0) {
          const prevLevels = state.availableLevels.filter(l => l < state.currentBook);
          if (prevLevels.length > 0) {
            newBook = prevLevels[prevLevels.length - 1];
            newXp = Math.floor(getLessonXp(newBook) / 2); // Start at mid-XP
            levelChanged = 'down';
            _prefetchLevel(state.sessionId!, newBook);
          } else {
            newXp = 0; // Can't go below level 1
          }
        }
      }

      set({
        answerResult: result,
        feedbackQuestion: question,
        isSubmitting: false,
        combo: newCombo,
        bestCombo: newBestCombo,
        correctCount: newCorrectCount,
        consecutiveWrong: newConsecutiveWrong,
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

  // ── Next Question ───────────────────────────────────────────────────

  nextQuestion: () => {
    const state = get();

    // Check if test is complete
    if (state.totalAnswered >= state.questionCount) {
      // Auto-complete
      get().complete();
      return;
    }

    if (state.engineType === 'levelup') {
      const currentPool = state.levelPools[state.currentBook] ?? [];
      const currentIdx = (state.poolIndex[state.currentBook] ?? 0) + 1;

      // If pool exhausted, try to prefetch
      if (currentIdx >= currentPool.length) {
        _prefetchLevel(state.sessionId!, state.currentBook);
      }

      set({
        poolIndex: { ...state.poolIndex, [state.currentBook]: currentIdx },
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        feedbackQuestion: null,
        levelChanged: null,
      });
    } else {
      // Legacy: simply advance index
      set({
        currentIndex: state.currentIndex + 1,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        feedbackQuestion: null,
      });
    }
  },

  // ── Complete ────────────────────────────────────────────────────────

  complete: async () => {
    const state = get();
    if (!state.sessionId) return;

    try {
      if (state.engineType === 'levelup') {
        const result = await unifiedTestService.completeLevelup(
          state.sessionId,
          state.currentBook,
          state.bestCombo,
        );
        set({
          isComplete: true,
          finalResult: {
            accuracy: result.accuracy,
            totalAnswered: result.total_answered,
            correctCount: result.correct_count,
            finalLevel: result.final_level,
            bestCombo: result.best_combo,
          },
        });
      } else {
        const result = await unifiedTestService.completeLegacy(state.sessionId);
        set({
          isComplete: true,
          finalResult: {
            accuracy: result.accuracy,
            totalAnswered: result.total_answered,
            correctCount: result.correct_count,
          },
        });
      }
    } catch (e) {
      set({ error: getErrorMessage(e, '오류가 발생했습니다') });
    }
  },

  // ── Reset ───────────────────────────────────────────────────────────

  reset: () => {
    _prefetchingLevels.clear();
    set(initialState);
  },
}));

// ── Prefetch Helper ─────────────────────────────────────────────────────────

async function _prefetchLevel(sessionId: string, level: number) {
  if (_prefetchingLevels.has(level)) return;
  _prefetchingLevels.add(level);

  try {
    const response = await unifiedTestService.fetchLevelQuestions(sessionId, level);
    const state = useUnifiedTestStore.getState();
    const existingPool = state.levelPools[level] ?? [];
    const existingIds = new Set(existingPool.map(q => q.word_mastery_id));
    const newQuestions = response.questions.filter(q => !existingIds.has(q.word_mastery_id));

    if (newQuestions.length > 0) {
      useUnifiedTestStore.setState({
        levelPools: {
          ...state.levelPools,
          [level]: [...existingPool, ...newQuestions],
        },
      });
    }
  } catch {
    // Silent fail for prefetch
  } finally {
    _prefetchingLevels.delete(level);
  }
}

// ── Derived Selectors ───────────────────────────────────────────────────────

export function useLevelupProgress() {
  return useUnifiedTestStore(useShallow(state => ({
    currentBook: state.currentBook,
    xp: state.xp,
    lessonXp: getLessonXp(state.currentBook),
    rank: wordLevelToRank(state.currentBook),
    totalAnswered: state.totalAnswered,
    questionCount: state.questionCount,
    combo: state.combo,
    bestCombo: state.bestCombo,
    correctCount: state.correctCount,
    lastXpChange: state.lastXpChange,
    levelChanged: state.levelChanged,
  })));
}

export function useLegacyProgress() {
  return useUnifiedTestStore(useShallow(state => ({
    currentIndex: state.currentIndex,
    totalQuestions: state.questions.length,
    totalAnswered: state.totalAnswered,
    correctCount: state.correctCount,
    combo: state.combo,
  })));
}
