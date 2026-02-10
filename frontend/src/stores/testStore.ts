/**
 * Level test store using Zustand.
 * Supports adaptive level testing: questions are selected from a pool
 * based on the student's current performance level.
 */
import { create } from 'zustand';
import testService, {
  type TestQuestion,
  type TestSessionData,
  type SubmitAnswerResponse,
} from '../services/test';
import { getErrorMessage } from '../utils/error';

/** Map word DB level (1-15) to rank (1-10), matching backend logic. */
function wordLevelToRank(wordLevel: number): number {
  return Math.min(wordLevel, 10);
}

/** Pick the best question from pool for the target adaptive level. */
function pickFromPool(
  pool: TestQuestion[],
  usedIndices: Set<number>,
  targetLevel: number,
): number {
  for (let delta = 0; delta <= 10; delta++) {
    const levels = delta === 0
      ? [targetLevel]
      : [targetLevel + delta, targetLevel - delta];
    for (const level of levels) {
      if (level < 1 || level > 10) continue;
      const idx = pool.findIndex(
        (q, i) => !usedIndices.has(i) && wordLevelToRank(q.word.level) === level,
      );
      if (idx !== -1) return idx;
    }
  }
  return pool.findIndex((_, i) => !usedIndices.has(i));
}

export interface WrongAnswer {
  english: string;
  correctAnswer: string;
  selectedAnswer: string;
}

interface TestStore {
  session: TestSessionData | null;
  questionPool: TestQuestion[];
  questions: TestQuestion[];
  currentIndex: number;
  adaptiveLevel: number;
  usedPoolIndices: Set<number>;
  selectedAnswer: string | null;
  answerResult: SubmitAnswerResponse | null;
  wrongAnswers: WrongAnswer[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  startTest: (testType: 'placement' | 'periodic', testCode?: string) => Promise<void>;
  selectAnswer: (answer: string) => void;
  submitAnswer: () => Promise<void>;
  nextQuestion: () => void;
  reset: () => void;
}

const ADAPTIVE_START_LEVEL = 3;

export const useTestStore = create<TestStore>()((set, get) => ({
  session: null,
  questionPool: [],
  questions: [],
  currentIndex: 0,
  adaptiveLevel: ADAPTIVE_START_LEVEL,
  usedPoolIndices: new Set<number>(),
  selectedAnswer: null,
  answerResult: null,
  wrongAnswers: [],
  isLoading: false,
  isSubmitting: false,
  error: null,

  startTest: async (testType, testCode?) => {
    set({ isLoading: true, error: null });
    try {
      const req: { test_type: typeof testType; test_code?: string } = { test_type: testType };
      if (testCode) req.test_code = testCode;
      const response = await testService.startTest(req);

      const pool = response.questions;
      const isAdaptive = !response.test_session.test_config_id;

      if (isAdaptive && pool.length > response.test_session.total_questions) {
        // Adaptive mode: pick first question from starting level
        const usedIndices = new Set<number>();
        const firstIdx = pickFromPool(pool, usedIndices, ADAPTIVE_START_LEVEL);
        if (firstIdx >= 0) usedIndices.add(firstIdx);
        const firstQuestion = firstIdx >= 0 ? pool[firstIdx] : pool[0];

        set({
          session: response.test_session,
          questionPool: pool,
          questions: [firstQuestion],
          currentIndex: 0,
          adaptiveLevel: ADAPTIVE_START_LEVEL,
          usedPoolIndices: usedIndices,
          selectedAnswer: null,
          answerResult: null,
          wrongAnswers: [],
        });
      } else {
        // Sequential mode (test_code config): use all questions in order
        set({
          session: response.test_session,
          questionPool: pool,
          questions: pool,
          currentIndex: 0,
          adaptiveLevel: 1,
          usedPoolIndices: new Set(pool.map((_, i) => i)),
          selectedAnswer: null,
          answerResult: null,
          wrongAnswers: [],
        });
      }
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '테스트를 시작할 수 없습니다.') });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  selectAnswer: (answer) => {
    if (get().answerResult) return;
    set({ selectedAnswer: answer });
  },

  submitAnswer: async () => {
    const { session, questions, currentIndex, selectedAnswer } = get();
    if (!session || !selectedAnswer) return;

    const question = questions[currentIndex];
    const isCorrect = selectedAnswer === question.correct_answer;
    const localResult: SubmitAnswerResponse = {
      is_correct: isCorrect,
      correct_answer: question.correct_answer,
    };

    // Update adaptive level: +1 for correct, -1 for wrong (clamped 1-10)
    const isAdaptive = !session.test_config_id;

    set((state) => ({
      answerResult: localResult,
      isSubmitting: false,
      adaptiveLevel: isAdaptive
        ? Math.max(1, Math.min(10, state.adaptiveLevel + (isCorrect ? 1 : -1)))
        : state.adaptiveLevel,
      session: {
        ...session,
        correct_count: session.correct_count + (isCorrect ? 1 : 0),
      },
      wrongAnswers: isCorrect
        ? state.wrongAnswers
        : [
            ...state.wrongAnswers,
            {
              english: question.word.english,
              correctAnswer: question.correct_answer,
              selectedAnswer,
            },
          ],
    }));

    // Fire API in background (non-blocking) for server-side recording
    testService.submitAnswer(session.id, {
      word_id: question.word.id,
      selected_answer: selectedAnswer,
      question_order: question.question_order,
    }).catch(() => {
      // Server recording failed silently - local result already shown
    });
  },

  nextQuestion: () => {
    const { session, questionPool, questions, currentIndex, adaptiveLevel, usedPoolIndices } = get();
    if (!session) return;

    const isAdaptive = !session.test_config_id;

    if (isAdaptive) {
      // Adaptive: pick next question from pool matching current level
      const nextIdx = pickFromPool(questionPool, usedPoolIndices, adaptiveLevel);
      if (nextIdx < 0) return; // no more questions

      const newUsed = new Set(usedPoolIndices);
      newUsed.add(nextIdx);

      set({
        questions: [...questions, questionPool[nextIdx]],
        currentIndex: currentIndex + 1,
        usedPoolIndices: newUsed,
        selectedAnswer: null,
        answerResult: null,
      });
    } else {
      // Sequential: just advance index
      set({
        currentIndex: currentIndex + 1,
        selectedAnswer: null,
        answerResult: null,
      });
    }
  },

  reset: () => {
    set({
      session: null,
      questionPool: [],
      questions: [],
      currentIndex: 0,
      adaptiveLevel: ADAPTIVE_START_LEVEL,
      usedPoolIndices: new Set<number>(),
      selectedAnswer: null,
      answerResult: null,
      wrongAnswers: [],
      isLoading: false,
      isSubmitting: false,
      error: null,
    });
  },
}));

export default useTestStore;
