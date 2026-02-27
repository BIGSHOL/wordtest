/** Grammar test Zustand store */
import { create } from 'zustand';
import { grammarTestService } from '../services/grammarTest';
import type { GrammarQuestion, GrammarCompleteResult } from '../types/grammar';

type Phase = 'idle' | 'briefing' | 'testing' | 'submitting' | 'complete';

interface GrammarTestStore {
  // Session
  phase: Phase;
  sessionId: string | null;
  studentName: string;
  questions: GrammarQuestion[];
  totalQuestions: number;
  timeLimitSeconds: number;
  perQuestionSeconds: number | null;
  timeMode: string;

  // Test state
  currentIndex: number;
  answers: Record<string, string>; // questionId -> answer
  results: GrammarCompleteResult | null;

  // Actions
  startGrammar: (code: string, allowRestart?: boolean) => Promise<void>;
  startExam: () => void;
  setAnswer: (questionId: string, answer: string) => void;
  goToQuestion: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  submitAll: () => Promise<void>;
  reset: () => void;
}

export const useGrammarTestStore = create<GrammarTestStore>()((set, get) => ({
  phase: 'idle',
  sessionId: null,
  studentName: '',
  questions: [],
  totalQuestions: 0,
  timeLimitSeconds: 600,
  perQuestionSeconds: null,
  timeMode: 'per_question',
  currentIndex: 0,
  answers: {},
  results: null,

  startGrammar: async (code, allowRestart = false) => {
    const res = await grammarTestService.startByCode(code, allowRestart);

    if (res.access_token) {
      localStorage.setItem('access_token', res.access_token);
    }

    set({
      phase: 'briefing',
      sessionId: res.session_id,
      studentName: res.student_name,
      questions: res.questions,
      totalQuestions: res.total_questions,
      timeLimitSeconds: res.time_limit_seconds,
      perQuestionSeconds: res.per_question_seconds,
      timeMode: res.time_mode,
      currentIndex: 0,
      answers: {},
      results: null,
    });
  },

  startExam: () => {
    set({ phase: 'testing' });
  },

  setAnswer: (questionId, answer) => {
    set((s) => ({
      answers: { ...s.answers, [questionId]: answer },
    }));
  },

  goToQuestion: (index) => {
    const { questions } = get();
    if (index >= 0 && index < questions.length) {
      set({ currentIndex: index });
    }
  },

  goNext: () => {
    const { currentIndex, questions } = get();
    if (currentIndex < questions.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  goPrev: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  submitAll: async () => {
    const { sessionId, questions, answers } = get();
    if (!sessionId) return;

    set({ phase: 'submitting' });

    const answerList = questions.map((q) => ({
      question_id: q.id,
      selected_answer: answers[q.id] || '',
    }));

    const result = await grammarTestService.batchSubmit(sessionId, answerList);
    set({ phase: 'complete', results: result });
  },

  reset: () => {
    set({
      phase: 'idle',
      sessionId: null,
      studentName: '',
      questions: [],
      totalQuestions: 0,
      currentIndex: 0,
      answers: {},
      results: null,
    });
  },
}));
