/**
 * Level test store using Zustand.
 */
import { create } from 'zustand';
import testService, {
  type TestQuestion,
  type TestSessionData,
  type SubmitAnswerResponse,
} from '../services/test';

interface TestStore {
  session: TestSessionData | null;
  questions: TestQuestion[];
  currentIndex: number;
  selectedAnswer: string | null;
  answerResult: SubmitAnswerResponse | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  startTest: (testType: 'placement' | 'periodic') => Promise<void>;
  selectAnswer: (answer: string) => void;
  submitAnswer: () => Promise<void>;
  nextQuestion: () => void;
  reset: () => void;
}

export const useTestStore = create<TestStore>()((set, get) => ({
  session: null,
  questions: [],
  currentIndex: 0,
  selectedAnswer: null,
  answerResult: null,
  isLoading: false,
  isSubmitting: false,
  error: null,

  startTest: async (testType) => {
    set({ isLoading: true, error: null });
    try {
      const response = await testService.startTest({ test_type: testType });
      set({
        session: response.test_session,
        questions: response.questions,
        currentIndex: 0,
        selectedAnswer: null,
        answerResult: null,
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || '테스트를 시작할 수 없습니다.';
      set({ error: message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  selectAnswer: (answer) => {
    if (get().answerResult) return; // Already submitted
    set({ selectedAnswer: answer });
  },

  submitAnswer: async () => {
    const { session, questions, currentIndex, selectedAnswer } = get();
    if (!session || !selectedAnswer) return;

    const question = questions[currentIndex];
    set({ isSubmitting: true });
    try {
      const result = await testService.submitAnswer(session.id, {
        word_id: question.word.id,
        selected_answer: selectedAnswer,
        question_order: question.question_order,
      });
      set({
        answerResult: result,
        session: {
          ...session,
          correct_count: session.correct_count + (result.is_correct ? 1 : 0),
        },
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || '답변을 제출할 수 없습니다.';
      set({ error: message });
    } finally {
      set({ isSubmitting: false });
    }
  },

  nextQuestion: () => {
    set((state) => ({
      currentIndex: state.currentIndex + 1,
      selectedAnswer: null,
      answerResult: null,
    }));
  },

  reset: () => {
    set({
      session: null,
      questions: [],
      currentIndex: 0,
      selectedAnswer: null,
      answerResult: null,
      isLoading: false,
      isSubmitting: false,
      error: null,
    });
  },
}));

export default useTestStore;
