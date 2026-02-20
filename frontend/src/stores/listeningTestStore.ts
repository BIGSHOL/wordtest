/**
 * Listening Test store - simple sequential listen-and-pick-word.
 *
 * No XP, no stages, no waves, no levels.
 * All questions loaded at start, answered sequentially.
 * Completion shows accuracy only.
 */
import { create } from 'zustand';
import listeningTestService from '../services/listeningTest';
import type { ListeningQuestion, StartListeningTestResponse, ListeningAnswerResponse, ListeningCompleteResponse } from '../services/listeningTest';
import { useAuthStore } from './auth';
import { getErrorMessage } from '../utils/error';

export interface ListeningTestStore {
  // Session
  sessionId: string | null;
  assignmentId: string | null;
  questions: ListeningQuestion[];
  perQuestionTime: number;

  // Progress
  currentIndex: number;
  totalWords: number;
  totalAnswered: number;
  correctCount: number;

  // Answer state
  selectedAnswer: string | null;
  answerResult: ListeningAnswerResponse | null;
  feedbackQuestion: ListeningQuestion | null;

  // UI state
  isLoading: boolean;
  isSubmitting: boolean;
  isComplete: boolean;
  error: string | null;
  completionResult: ListeningCompleteResponse | null;

  // Actions
  startByCode: (testCode: string, allowRestart?: boolean) => Promise<StartListeningTestResponse>;
  selectAnswer: (answer: string) => void;
  submitAnswer: (timeTaken: number) => Promise<ListeningAnswerResponse>;
  nextQuestion: () => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  assignmentId: null,
  questions: [] as ListeningQuestion[],
  perQuestionTime: 8,
  currentIndex: 0,
  totalWords: 0,
  totalAnswered: 0,
  correctCount: 0,
  selectedAnswer: null,
  answerResult: null,
  feedbackQuestion: null,
  isLoading: false,
  isSubmitting: false,
  isComplete: false,
  error: null,
  completionResult: null,
};

export const useListeningTestStore = create<ListeningTestStore>()((set, get) => ({
  ...initialState,

  startByCode: async (testCode: string, allowRestart = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await listeningTestService.startByCode(testCode, allowRestart);

      // Store JWT in auth store
      if (response.access_token) {
        useAuthStore.getState().setTokenDirect(response.access_token, {
          id: response.assignment_id,
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

      set({
        sessionId: response.session_id,
        assignmentId: response.assignment_id,
        questions: response.questions,
        perQuestionTime: response.per_question_time,
        currentIndex: 0,
        totalWords: response.total_words,
        totalAnswered: 0,
        correctCount: 0,
        selectedAnswer: null,
        answerResult: null,
        feedbackQuestion: null,
        isComplete: false,
        completionResult: null,
      });

      return response;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '리스닝 테스트를 시작할 수 없습니다.') });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  selectAnswer: (answer: string) => {
    if (get().answerResult) return;
    set({ selectedAnswer: answer });
  },

  submitAnswer: async (timeTaken: number) => {
    const state = get();
    if (!state.sessionId) throw new Error('No session');

    const question = state.questions[state.currentIndex];
    if (!question) throw new Error('No current question');

    const answer = state.selectedAnswer || '';

    set({ isSubmitting: true });

    try {
      const result = await listeningTestService.submitAnswer(state.sessionId, {
        word_mastery_id: question.word_mastery_id,
        selected_answer: answer,
        time_taken_seconds: timeTaken,
      });

      set({
        answerResult: result,
        feedbackQuestion: question,
        totalAnswered: state.totalAnswered + 1,
        correctCount: state.correctCount + (result.is_correct ? 1 : 0),
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
    const nextIdx = state.currentIndex + 1;

    // Check if all questions are done
    if (nextIdx >= state.questions.length) {
      set({ isComplete: true });

      // Complete session on backend
      if (state.sessionId) {
        listeningTestService.complete(state.sessionId)
          .then((result) => {
            useListeningTestStore.setState({ completionResult: result });
          })
          .catch((err) => {
            console.error('[listeningTest.complete] failed:', err);
          });
      }
      return;
    }

    set({
      currentIndex: nextIdx,
      selectedAnswer: null,
      answerResult: null,
      feedbackQuestion: null,
    });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

// --- Selectors ---

/** Get the current question. During feedback, returns the snapshot. */
export function useCurrentListeningQuestion(): ListeningQuestion | null {
  return useListeningTestStore((s) => {
    if (s.feedbackQuestion) return s.feedbackQuestion;
    return s.questions[s.currentIndex] ?? null;
  });
}

/** Progress ratio: answered / total */
export function useListeningProgress(): number {
  return useListeningTestStore((s) => {
    if (s.totalWords === 0) return 0;
    return s.totalAnswered / s.totalWords;
  });
}

export default useListeningTestStore;
