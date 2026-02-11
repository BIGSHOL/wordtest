/**
 * Level test store using Zustand.
 * Supports adaptive level+lesson testing: pool is sorted by level→lesson,
 * cursor advances through lessons/levels based on correctness and response time.
 *
 * Progression: Level 1 Lesson 1 → correct+fast → skip ahead → ... → next level
 */
import { create } from 'zustand';
import testService, {
  type TestQuestion,
  type TestSessionData,
  type SubmitAnswerResponse,
  type StartByCodeResponse,
} from '../services/test';
import { getErrorMessage } from '../utils/error';
import { useAuthStore } from './auth';

/**
 * Pick the unused pool question whose index is closest to targetIdx.
 * Pool is pre-sorted by level→lesson, so index ≈ difficulty.
 */
function pickClosest(
  poolSize: number,
  usedIndices: Set<number>,
  targetIdx: number,
): number {
  const clamped = Math.max(0, Math.min(poolSize - 1, Math.round(targetIdx)));
  // Search outward from clamped target
  for (let delta = 0; delta < poolSize; delta++) {
    for (const dir of [0, 1, -1]) {
      const idx = clamped + delta * (dir || 1);
      if (idx >= 0 && idx < poolSize && !usedIndices.has(idx)) return idx;
    }
  }
  return -1;
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
  adaptiveLesson: string;
  /** Continuous difficulty cursor (float, maps to pool index) */
  difficultyCursor: number;
  usedPoolIndices: Set<number>;
  selectedAnswer: string | null;
  answerResult: SubmitAnswerResponse | null;
  wrongAnswers: WrongAnswer[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  startTest: (testType: 'placement' | 'periodic', testCode?: string) => Promise<void>;
  startTestByCode: (testCode: string) => Promise<StartByCodeResponse>;
  selectAnswer: (answer: string) => void;
  submitAnswer: (elapsedSeconds?: number) => Promise<void>;
  nextQuestion: () => void;
  reset: () => void;
}

// Time-based step sizes for lesson→level progression
// Pool sorted by level→lesson (~6 questions per level, 60 total)
// Correct + fast = big advance, correct + slow = small advance, wrong = go back
function getStepUp(elapsedSeconds: number): number {
  if (elapsedSeconds < 4) return 3;   // Very fast → skip ~half a level
  if (elapsedSeconds < 8) return 2;   // Normal → advance ~1/3 level
  return 1;                            // Slow → advance ~1 lesson
}
const STEP_DOWN = 1;

export const useTestStore = create<TestStore>()((set, get) => ({
  session: null,
  questionPool: [],
  questions: [],
  currentIndex: 0,
  adaptiveLevel: 1,
  adaptiveLesson: '',
  difficultyCursor: 0,
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
      const isAdaptive = response.test_session.test_type === 'placement';

      if (isAdaptive && pool.length > response.test_session.total_questions) {
        // Pool is sorted by level→lesson from backend.
        // Start at the very beginning (level 1, lesson 1)
        const usedIndices = new Set<number>();
        const firstIdx = pickClosest(pool.length, usedIndices, 0);
        if (firstIdx >= 0) usedIndices.add(firstIdx);
        const firstQuestion = firstIdx >= 0 ? pool[firstIdx] : pool[0];

        set({
          session: response.test_session,
          questionPool: pool,
          questions: [firstQuestion],
          currentIndex: 0,
          adaptiveLevel: firstQuestion.word.level,
          adaptiveLesson: firstQuestion.word.lesson,
          difficultyCursor: 0,
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
          adaptiveLevel: pool[0]?.word.level ?? 1,
          adaptiveLesson: pool[0]?.word.lesson ?? '',
          difficultyCursor: 0,
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

  startTestByCode: async (testCode: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await testService.startByCode(testCode);

      // Store JWT in auth store with complete User shape
      useAuthStore.getState().setTokenDirect(response.access_token, {
        id: response.test_session.student_id,
        email: null,
        username: null,
        name: response.student_name,
        role: 'student',
        teacher_id: null,
        school_name: null,
        grade: null,
        phone_number: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const pool = response.questions;
      const isAdaptive = response.test_session.test_type === 'placement';

      if (isAdaptive && pool.length > response.test_session.total_questions) {
        // Placement via code: adaptive mode
        const usedIndices = new Set<number>();
        const firstIdx = pickClosest(pool.length, usedIndices, 0);
        if (firstIdx >= 0) usedIndices.add(firstIdx);
        const firstQuestion = firstIdx >= 0 ? pool[firstIdx] : pool[0];

        set({
          session: response.test_session,
          questionPool: pool,
          questions: [firstQuestion],
          currentIndex: 0,
          adaptiveLevel: firstQuestion.word.level,
          adaptiveLesson: firstQuestion.word.lesson,
          difficultyCursor: 0,
          usedPoolIndices: usedIndices,
          selectedAnswer: null,
          answerResult: null,
          wrongAnswers: [],
        });
      } else {
        // Sequential mode (periodic)
        set({
          session: response.test_session,
          questionPool: pool,
          questions: pool,
          currentIndex: 0,
          adaptiveLevel: pool[0]?.word.level ?? 1,
          adaptiveLesson: pool[0]?.word.lesson ?? '',
          difficultyCursor: 0,
          usedPoolIndices: new Set(pool.map((_, i) => i)),
          selectedAnswer: null,
          answerResult: null,
          wrongAnswers: [],
        });
      }

      return response;
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

  submitAnswer: async (elapsedSeconds?: number) => {
    const { session, questions, currentIndex, selectedAnswer } = get();
    if (!session || !selectedAnswer) return;

    const question = questions[currentIndex];
    const isCorrect = selectedAnswer === question.correct_answer;
    const localResult: SubmitAnswerResponse = {
      is_correct: isCorrect,
      correct_answer: question.correct_answer,
    };

    const isAdaptive = session.test_type === 'placement';

    set((state) => {
      const newCursor = isAdaptive
        ? Math.max(0, state.difficultyCursor + (isCorrect ? getStepUp(elapsedSeconds ?? 15) : -STEP_DOWN))
        : state.difficultyCursor;

      // Derive display level from cursor position
      const questionsPerLevel = state.questionPool.length / 10;
      const newLevel = isAdaptive
        ? Math.max(1, Math.min(10, Math.floor(newCursor / questionsPerLevel) + 1))
        : state.adaptiveLevel;

      return {
        answerResult: localResult,
        isSubmitting: false,
        difficultyCursor: newCursor,
        adaptiveLevel: newLevel,
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
      };
    });

    // Fire API in background (non-blocking) for server-side recording
    testService.submitAnswer(session.id, {
      word_id: question.word.id,
      selected_answer: selectedAnswer,
      question_order: question.question_order,
    }).catch(() => {});
  },

  nextQuestion: () => {
    const { session, questionPool, questions, currentIndex, difficultyCursor, usedPoolIndices } = get();
    if (!session) return;

    const isAdaptive = session.test_type === 'placement';

    if (isAdaptive) {
      const nextIdx = pickClosest(questionPool.length, usedPoolIndices, difficultyCursor);
      if (nextIdx < 0) return;

      const newUsed = new Set(usedPoolIndices);
      newUsed.add(nextIdx);
      const nextQ = questionPool[nextIdx];

      set({
        questions: [...questions, nextQ],
        currentIndex: currentIndex + 1,
        adaptiveLesson: nextQ.word.lesson,
        usedPoolIndices: newUsed,
        selectedAnswer: null,
        answerResult: null,
      });
    } else {
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
      adaptiveLevel: 1,
      adaptiveLesson: '',
      difficultyCursor: 0,
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
