/**
 * XP-based Adaptive Mastery learning store.
 *
 * RPG-style XP system: answer questions → gain/lose XP → level up/down in real-time.
 * Multi-level question pools: pre-loaded at start, lazy-fetched when exhausted.
 * See MASTERY_SYSTEM.md for full design spec.
 */
import { create } from 'zustand';
import masteryService from '../services/mastery';
import { useAuthStore } from './auth';
import { getErrorMessage } from '../utils/error';
import { wordLevelToRank } from '../types/rank';
import type {
  MasteryQuestion,
  MasteryAnswerResult,
  MasterySessionInfo,
  StageSummary,
  StartMasteryResponse,
  CompleteBatchResponse,
} from '../types/mastery';

const DEFAULT_QUESTION_COUNT = 50;

/** Track ongoing prefetches to avoid duplicate requests */
const _prefetchingLevels = new Set<number>();

// --- XP Configuration ---

/** XP needed to clear one lesson in a given book. Book 1: 10, Book 2: 15, ..., Book 10: 55 */
function getLessonXp(book: number): number {
  return 5 + book * 5;
}

/** Compute XP change for an answer. */
function computeXpChange(params: {
  isCorrect: boolean;
  questionLevel: number;
  currentBook: number;
  timeTaken: number;
  timerLimit: number;
  combo: number;
  consecutiveWrong: number;
}): number {
  const { isCorrect, questionLevel, currentBook, timeTaken, timerLimit, combo, consecutiveWrong } = params;

  if (isCorrect) {
    // Base XP: current level = 7, lower level = 3
    let xp = questionLevel < currentBook ? 3 : 7;
    // Speed bonus: answer within 50% of time limit
    if (timeTaken <= timerLimit * 0.5) xp += 5;
    // Combo bonus: 3-4→+1, 5-9→+2, 10-14→+3, 15-19→+4, 20+→+5
    if (combo >= 3) xp += Math.min(Math.floor(combo / 5) + 1, 5);
    return xp;
  } else {
    // Escalating penalty for consecutive wrong answers
    if (consecutiveWrong >= 2) return -12;
    if (consecutiveWrong >= 1) return -8;
    return -5;
  }
}

// --- Store types ---

export interface MasteryStore {
  // Session
  session: MasterySessionInfo | null;
  stageSummary: StageSummary | null;
  totalWords: number;
  questionCount: number;

  // Question pools (grouped by word level/book)
  levelPools: Record<number, MasteryQuestion[]>;
  poolIndex: Record<number, number>;

  // XP system
  xp: number;
  currentBook: number;
  currentLesson: number;
  displayRank: number;

  // Progress
  globalIndex: number;
  combo: number;
  bestCombo: number;
  correctCount: number;
  totalAnswered: number;
  consecutiveWrong: number;
  lastXpChange: number;

  // Answer state
  selectedAnswer: string | null;
  typedAnswer: string;
  answerResult: MasteryAnswerResult | null;

  // UI
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  isComplete: boolean;
  finalResult: CompleteBatchResponse | null;

  // Computed getters (not stored, derived)

  // Actions
  startByCode: (testCode: string, allowRestart?: boolean) => Promise<StartMasteryResponse>;
  selectAnswer: (answer: string) => void;
  setTypedAnswer: (text: string) => void;
  submitAnswer: (timeTaken: number) => Promise<MasteryAnswerResult>;
  nextQuestion: () => void;
  reset: () => void;
}

const initialState = {
  session: null,
  stageSummary: null,
  totalWords: 0,
  questionCount: DEFAULT_QUESTION_COUNT,
  levelPools: {} as Record<number, MasteryQuestion[]>,
  poolIndex: {} as Record<number, number>,
  xp: 0,
  currentBook: 1,
  currentLesson: 1,
  displayRank: 1,
  globalIndex: 0,
  combo: 0,
  bestCombo: 0,
  correctCount: 0,
  totalAnswered: 0,
  consecutiveWrong: 0,
  lastXpChange: 0,
  selectedAnswer: null,
  typedAnswer: '',
  answerResult: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  isComplete: false,
  finalResult: null,
};

/** Group questions by word level into pools. */
function groupByLevel(questions: MasteryQuestion[]): Record<number, MasteryQuestion[]> {
  const pools: Record<number, MasteryQuestion[]> = {};
  for (const q of questions) {
    const lvl = q.word.level;
    if (!pools[lvl]) pools[lvl] = [];
    pools[lvl].push(q);
  }
  return pools;
}

/** Get current question from the pool. */
function getCurrentQuestion(state: {
  levelPools: Record<number, MasteryQuestion[]>;
  poolIndex: Record<number, number>;
  currentBook: number;
}): MasteryQuestion | null {
  const pool = state.levelPools[state.currentBook];
  if (!pool) return null;
  const idx = state.poolIndex[state.currentBook] ?? 0;
  return pool[idx] ?? null;
}

export const useMasteryStore = create<MasteryStore>()((set, get) => ({
  ...initialState,

  startByCode: async (testCode: string, allowRestart = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await masteryService.startByCode(testCode, allowRestart);

      // Store JWT in auth store
      if (response.access_token) {
        useAuthStore.getState().setTokenDirect(response.access_token, {
          id: response.session.assignment_id,
          email: null,
          username: null,
          name: response.student_name || '학생',
          role: 'student',
          teacher_id: null,
          school_name: null,
          grade: null,
          phone_number: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const startLevel = response.current_level || 1;
      const pools = groupByLevel(response.questions);
      const poolIndex: Record<number, number> = {};
      for (const lvl of Object.keys(pools)) {
        poolIndex[Number(lvl)] = 0;
      }

      set({
        session: response.session,
        stageSummary: response.stage_summary,
        totalWords: response.total_words,
        questionCount: response.question_count || DEFAULT_QUESTION_COUNT,
        levelPools: pools,
        poolIndex,
        xp: 0,
        currentBook: startLevel,
        currentLesson: 1,
        displayRank: wordLevelToRank(startLevel),
        globalIndex: 0,
        combo: 0,
        bestCombo: 0,
        correctCount: 0,
        totalAnswered: 0,
        consecutiveWrong: 0,
        lastXpChange: 0,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        isComplete: false,
        finalResult: null,
      });

      return response;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '학습을 시작할 수 없습니다.') });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  selectAnswer: (answer: string) => {
    if (get().answerResult) return;
    set({ selectedAnswer: answer });
  },

  setTypedAnswer: (text: string) => {
    if (get().answerResult) return;
    set({ typedAnswer: text });
  },

  submitAnswer: async (timeTaken: number) => {
    const state = get();
    if (!state.session) throw new Error('No session');

    const question = getCurrentQuestion(state);
    if (!question) throw new Error('No current question');

    const isTyping = question.question_type === 'listen_and_type' || question.question_type === 'meaning_and_type';
    const answer = isTyping ? state.typedAnswer : (state.selectedAnswer || '');

    set({ isSubmitting: true });

    try {
      const result = await masteryService.submitAnswer(state.session.id, {
        word_mastery_id: question.word_mastery_id,
        selected_answer: answer,
        time_taken_seconds: timeTaken,
        stage: question.stage,
        question_type: question.question_type,
      });

      // --- XP computation (real-time, frontend-side) ---
      const newConsecutiveWrong = result.is_correct ? 0 : state.consecutiveWrong + 1;
      const newCombo = result.is_correct ? state.combo + 1 : 0;
      const newBestCombo = Math.max(state.bestCombo, newCombo);

      const xpChange = computeXpChange({
        isCorrect: result.is_correct,
        questionLevel: question.word.level,
        currentBook: state.currentBook,
        timeTaken,
        timerLimit: question.timer_seconds,
        combo: newCombo,
        consecutiveWrong: newConsecutiveWrong,
      });

      let newXp = state.xp + xpChange;
      let newBook = state.currentBook;
      let newLesson = state.currentLesson;
      const lessonXp = getLessonXp(newBook);

      // Level UP: advance lessons (possibly multiple if big XP gain)
      while (newXp >= lessonXp && newBook <= 15) {
        newXp -= getLessonXp(newBook);
        newLesson++;
        if (newLesson > 25) {
          // Next book
          newBook++;
          newLesson = 1;
          if (newBook > 15) {
            newBook = 15;
            newLesson = 25;
            newXp = getLessonXp(15); // cap
            break;
          }
        }
      }

      // Level DOWN: go back lessons
      while (newXp < 0 && (newBook > 1 || newLesson > 1)) {
        if (newLesson > 1) {
          newLesson--;
        } else {
          newBook--;
          newLesson = 25;
        }
        // Start at 80% of previous lesson's XP
        newXp = Math.round(getLessonXp(newBook) * 0.8) + newXp;
      }
      // Floor at 0 for Level 1 Lesson 1
      if (newBook <= 1 && newLesson <= 1) {
        newXp = Math.max(0, newXp);
        newBook = 1;
        newLesson = 1;
      }

      set({
        answerResult: result,
        combo: newCombo,
        bestCombo: newBestCombo,
        correctCount: state.correctCount + (result.is_correct ? 1 : 0),
        totalAnswered: state.totalAnswered + 1,
        consecutiveWrong: newConsecutiveWrong,
        xp: newXp,
        currentBook: newBook,
        currentLesson: newLesson,
        displayRank: wordLevelToRank(newBook),
        lastXpChange: xpChange,
      });

      return result;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '답변을 제출할 수 없습니다.') });
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },

  nextQuestion: () => {
    const state = get();
    const nextGlobalIdx = state.globalIndex + 1;

    // Check if all questions done
    if (nextGlobalIdx >= state.questionCount) {
      set({ isComplete: true });
      // Save final level to backend (retry up to 3 times on failure)
      if (state.session) {
        const sessionId = state.session.id;
        const finalLevel = state.currentBook;
        const attemptComplete = (retries: number) => {
          masteryService.completeBatch(sessionId, finalLevel).then((result) => {
            set({ finalResult: result });
          }).catch((err) => {
            console.error('[completeBatch] failed:', err);
            if (retries > 0) {
              setTimeout(() => attemptComplete(retries - 1), 2000);
            }
          });
        };
        attemptComplete(2);
      }
      return;
    }

    // Advance pool index for current book
    const book = state.currentBook;
    const currentIdx = (state.poolIndex[book] ?? 0) + 1;

    // Check latest state (prefetch may have extended the pool)
    const latestState = useMasteryStore.getState();
    const latestPool = latestState.levelPools[book];

    if (latestPool && currentIdx < latestPool.length) {
      // Next question available (from original or prefetched pool)
      set({
        poolIndex: { ...latestState.poolIndex, [book]: currentIdx },
        globalIndex: nextGlobalIdx,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
      });

      // Prefetch when 3 questions remain in pool
      const remaining = latestPool.length - currentIdx - 1;
      if (remaining === 2 && state.session && !_prefetchingLevels.has(book)) {
        _prefetchingLevels.add(book);
        masteryService.fetchLevelQuestions(state.session.id, book)
          .then((batchResult) => {
            const latest = useMasteryStore.getState();
            const existingPool = latest.levelPools[book] || [];
            useMasteryStore.setState({
              levelPools: {
                ...latest.levelPools,
                [book]: [...existingPool, ...batchResult.questions],
              },
            });
          })
          .catch(() => {})
          .finally(() => { _prefetchingLevels.delete(book); });
      }
    } else {
      // Pool fully exhausted and no prefetch arrived - fetch now
      set({
        isLoading: true,
        globalIndex: nextGlobalIdx,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
      });

      if (state.session) {
        masteryService.fetchLevelQuestions(state.session.id, book)
          .then((batchResult) => {
            const latest = useMasteryStore.getState();
            const existingPool = latest.levelPools[book] || [];
            set({
              levelPools: {
                ...latest.levelPools,
                [book]: [...existingPool, ...batchResult.questions],
              },
              poolIndex: {
                ...latest.poolIndex,
                [book]: currentIdx,
              },
              isLoading: false,
            });
          })
          .catch((err) => {
            set({ error: getErrorMessage(err, '다음 문제를 불러올 수 없습니다.'), isLoading: false });
          });
      }
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));

// --- Selectors ---

/** Get the current question from the active pool. */
export function useCurrentQuestion(): MasteryQuestion | null {
  return useMasteryStore((s) => {
    const pool = s.levelPools[s.currentBook];
    if (!pool) return null;
    const idx = s.poolIndex[s.currentBook] ?? 0;
    return pool[idx] ?? null;
  });
}

/** Get XP needed for current lesson. */
export function useLessonXp(): number {
  return useMasteryStore((s) => getLessonXp(s.currentBook));
}

/** Get current level label like "1-3". */
export function useLevelLabel(): string {
  return useMasteryStore((s) => `${s.currentBook}-${s.currentLesson}`);
}

export { getLessonXp, computeXpChange };
export default useMasteryStore;
