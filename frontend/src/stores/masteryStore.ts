/**
 * Mastery learning store using Zustand.
 *
 * Manages the 5-stage word mastery learning session:
 * Stage 1: English → Korean (choice)
 * Stage 2: Korean → English (choice)
 * Stage 3: Listen → Type English
 * Stage 4: Listen → Korean (choice)
 * Stage 5: Korean → Type English
 */
import { create } from 'zustand';
import masteryService from '../services/mastery';
import { useAuthStore } from './auth';
import { getErrorMessage } from '../utils/error';
import type {
  MasteryQuestion,
  MasteryAnswerResult,
  MasterySessionInfo,
  StageSummary,
  StartMasteryResponse,
} from '../types/mastery';

export interface MasteryStore {
  // Session
  session: MasterySessionInfo | null;
  stageSummary: StageSummary | null;
  totalWords: number;

  // Current batch
  currentStage: number;
  questions: MasteryQuestion[];
  currentIndex: number;

  // Answer state
  selectedAnswer: string | null;
  typedAnswer: string;
  answerResult: MasteryAnswerResult | null;
  showSentenceReview: boolean;

  // Progress
  combo: number;
  bestCombo: number;
  wordsAdvanced: number;
  wordsDemoted: number;
  wordsMastered: number;

  // UI
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  isTransitioning: boolean;
  batchComplete: boolean;

  // Actions
  startByCode: (testCode: string) => Promise<StartMasteryResponse>;
  loadBatch: (stage: number) => Promise<void>;
  selectAnswer: (answer: string) => void;
  setTypedAnswer: (text: string) => void;
  submitAnswer: (timeTaken: number) => Promise<MasteryAnswerResult>;
  nextQuestion: () => void;
  dismissSentenceReview: () => void;
  setTransitioning: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  session: null,
  stageSummary: null,
  totalWords: 0,
  currentStage: 1,
  questions: [],
  currentIndex: 0,
  selectedAnswer: null,
  typedAnswer: '',
  answerResult: null,
  showSentenceReview: false,
  combo: 0,
  bestCombo: 0,
  wordsAdvanced: 0,
  wordsDemoted: 0,
  wordsMastered: 0,
  isLoading: false,
  isSubmitting: false,
  error: null,
  isTransitioning: false,
  batchComplete: false,
};

export const useMasteryStore = create<MasteryStore>()((set, get) => ({
  ...initialState,

  startByCode: async (testCode: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await masteryService.startByCode(testCode);

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

      const stage = response.questions.length > 0
        ? response.questions[0].stage
        : 1;

      set({
        session: response.session,
        stageSummary: response.stage_summary,
        totalWords: response.total_words,
        currentStage: stage,
        questions: response.questions,
        currentIndex: 0,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        combo: 0,
        bestCombo: 0,
        wordsAdvanced: 0,
        wordsDemoted: 0,
        wordsMastered: 0,
        batchComplete: false,
      });

      return response;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '학습을 시작할 수 없습니다.') });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadBatch: async (stage: number) => {
    const { session } = get();
    if (!session) return;

    set({ isLoading: true, error: null });
    try {
      const response = await masteryService.getBatch(session.id, stage);

      set({
        currentStage: stage,
        questions: response.questions,
        currentIndex: 0,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        stageSummary: response.stage_summary,
        batchComplete: response.questions.length === 0,
        isTransitioning: false,
      });
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '문제를 불러올 수 없습니다.') });
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
    const { session, questions, currentIndex, selectedAnswer, typedAnswer, currentStage, combo } = get();
    if (!session) throw new Error('No session');

    const question = questions[currentIndex];
    if (!question) throw new Error('No current question');

    const isTyping = currentStage === 3 || currentStage === 5;
    const answer = isTyping ? typedAnswer : (selectedAnswer || '');

    set({ isSubmitting: true });

    try {
      const result = await masteryService.submitAnswer(session.id, {
        word_mastery_id: question.word_mastery_id,
        selected_answer: answer,
        time_taken_seconds: timeTaken,
        stage: currentStage,
      });

      const newCombo = result.is_correct ? combo + 1 : 0;
      const bestCombo = Math.max(get().bestCombo, newCombo);

      set((state) => ({
        answerResult: result,
        combo: newCombo,
        bestCombo,
        wordsAdvanced: state.wordsAdvanced + (result.is_correct && !result.almost_correct ? 1 : 0),
        wordsDemoted: state.wordsDemoted + (!result.is_correct && !result.almost_correct ? 1 : 0),
        wordsMastered: state.wordsMastered + (result.word_mastered ? 1 : 0),
        showSentenceReview: result.is_correct && currentStage === 1 && !!result.example_en,
      }));

      return result;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '답변을 제출할 수 없습니다.') });
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },

  nextQuestion: () => {
    const { questions, currentIndex } = get();
    if (currentIndex + 1 < questions.length) {
      set({
        currentIndex: currentIndex + 1,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        showSentenceReview: false,
      });
    } else {
      // Batch complete
      set({ batchComplete: true, showSentenceReview: false });
    }
  },

  dismissSentenceReview: () => {
    set({ showSentenceReview: false });
  },

  setTransitioning: (v: boolean) => {
    set({ isTransitioning: v });
  },

  reset: () => {
    set({ ...initialState });
  },
}));

export default useMasteryStore;
