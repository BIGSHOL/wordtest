/**
 * Stage Test store - wave-based word mastery through stages 1→5.
 *
 * Completely separate from mastery/level-up system.
 * Words progress: stage 1→2→3→4→5→mastered.
 * Wrong answers do NOT demote — word stays at same stage, fail count increases.
 * After MAX_FAILS failures → word is skipped entirely.
 *
 * Wave algorithm:
 *  1. Start with INITIAL_BATCH words at stage 1
 *  2. As words are mastered/skipped, introduce new words from untested pool
 *  3. Mix different stages randomly (stage 1 + 2 + 3 etc.)
 *  4. Complete when all words are mastered or skipped
 */
import { create } from 'zustand';
import stageTestService from '../services/stageTest';
import type { StageWordInfo, StartStageTestResponse, StageTestAnswerResponse } from '../services/stageTest';
import type { MasteryQuestion } from '../types/mastery';
import { useAuthStore } from './auth';
import { getErrorMessage } from '../utils/error';

const INITIAL_BATCH = 8;
const REFILL_THRESHOLD = 3;
const QUESTION_FETCH_THRESHOLD = 3; // fetch more when < 3 questions remain

export type WordStatus = 'untested' | 'active' | 'mastered' | 'skipped';

export interface StageWord {
  wordMasteryId: string;
  wordId: string;
  english: string;
  korean: string;
  stage: number;
  failCount: number;
  status: WordStatus;
  difficultyScore?: number;
}

export interface StageTestStore {
  // Session
  sessionId: string | null;
  assignmentId: string | null;
  words: StageWord[];
  maxFails: number;

  // Question queue
  questionQueue: MasteryQuestion[];
  currentQueueIndex: number;

  // Stats
  totalWords: number;
  masteredCount: number;
  skippedCount: number;
  totalAnswered: number;
  correctCount: number;
  combo: number;
  bestCombo: number;

  // Answer state
  selectedAnswer: string | null;
  typedAnswer: string;
  answerResult: StageTestAnswerResponse | null;
  feedbackQuestion: MasteryQuestion | null;

  // UI state
  isLoading: boolean;
  isSubmitting: boolean;
  isComplete: boolean;
  isFetchingQuestions: boolean;
  error: string | null;
  completionResult: { accuracy: number; total_answered: number; correct_count: number } | null;

  // Actions
  startByCode: (testCode: string, allowRestart?: boolean) => Promise<StartStageTestResponse>;
  selectAnswer: (answer: string) => void;
  setTypedAnswer: (text: string) => void;
  submitAnswer: (timeTaken: number) => Promise<StageTestAnswerResponse>;
  nextQuestion: () => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  assignmentId: null,
  words: [] as StageWord[],
  maxFails: 3,
  questionQueue: [] as MasteryQuestion[],
  currentQueueIndex: 0,
  totalWords: 0,
  masteredCount: 0,
  skippedCount: 0,
  totalAnswered: 0,
  correctCount: 0,
  combo: 0,
  bestCombo: 0,
  selectedAnswer: null,
  typedAnswer: '',
  answerResult: null,
  feedbackQuestion: null,
  isLoading: false,
  isSubmitting: false,
  isComplete: false,
  isFetchingQuestions: false,
  error: null,
  completionResult: null,
};

/** Convert backend word info to StageWord with initial status. */
function toStageWord(w: StageWordInfo, status: WordStatus): StageWord {
  return {
    wordMasteryId: w.word_mastery_id,
    wordId: w.word_id,
    english: w.english,
    korean: w.korean || '',
    stage: 1,
    failCount: 0,
    status,
    difficultyScore: w.difficulty_score ?? 0,
  };
}

/** Get active word IDs that need questions. */
function getActiveWordMasteryIds(words: StageWord[]): string[] {
  return words
    .filter((w) => w.status === 'active')
    .map((w) => w.wordMasteryId);
}

export const useStageTestStore = create<StageTestStore>()((set, get) => ({
  ...initialState,

  startByCode: async (testCode: string, allowRestart = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await stageTestService.startByCode(testCode, allowRestart);

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

      // Build word list: first INITIAL_BATCH as active, rest as untested
      const allWordInfos = response.words;
      const words: StageWord[] = allWordInfos.map((w, i) =>
        toStageWord(w, i < INITIAL_BATCH ? 'active' : 'untested')
      );

      // Use initial_questions from backend (first wave at stage 1)
      const questionQueue = response.initial_questions;

      set({
        sessionId: response.session_id,
        assignmentId: response.assignment_id,
        words,
        maxFails: response.max_fails,
        questionQueue,
        currentQueueIndex: 0,
        totalWords: response.total_words,
        masteredCount: 0,
        skippedCount: 0,
        totalAnswered: 0,
        correctCount: 0,
        combo: 0,
        bestCombo: 0,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        feedbackQuestion: null,
        isComplete: false,
        completionResult: null,
      });

      return response;
    } catch (error: unknown) {
      set({ error: getErrorMessage(error, '스테이지 테스트를 시작할 수 없습니다.') });
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
    if (!state.sessionId) throw new Error('No session');

    const question = state.questionQueue[state.currentQueueIndex];
    if (!question) throw new Error('No current question');

    const isTyping =
      question.question_type === 'listen_and_type' ||
      question.question_type === 'meaning_and_type';
    const answer = isTyping ? state.typedAnswer : (state.selectedAnswer || '');

    set({ isSubmitting: true });

    try {
      const result = await stageTestService.submitAnswer(state.sessionId, {
        word_mastery_id: question.word_mastery_id,
        selected_answer: answer,
        time_taken_seconds: timeTaken,
        stage: question.stage,
        question_type: question.question_type,
        context_mode: question.context_mode,
      });

      // Update local word state
      const words = [...state.words];
      const wordIdx = words.findIndex((w) => w.wordMasteryId === question.word_mastery_id);

      let newMasteredCount = state.masteredCount;
      let newSkippedCount = state.skippedCount;

      if (wordIdx !== -1) {
        const word = { ...words[wordIdx] };

        if (result.is_correct && !result.almost_correct) {
          word.stage = result.new_stage;
          if (result.word_mastered) {
            word.status = 'mastered';
            newMasteredCount++;
          }
        } else if (!result.is_correct && !result.almost_correct) {
          word.failCount++;
          if (word.failCount >= state.maxFails) {
            word.status = 'skipped';
            newSkippedCount++;
          }
        }

        words[wordIdx] = word;
      }

      const newCombo = result.is_correct ? state.combo + 1 : 0;

      set({
        answerResult: result,
        feedbackQuestion: question,
        words,
        masteredCount: newMasteredCount,
        skippedCount: newSkippedCount,
        totalAnswered: state.totalAnswered + 1,
        correctCount: state.correctCount + (result.is_correct ? 1 : 0),
        combo: newCombo,
        bestCombo: Math.max(state.bestCombo, newCombo),
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
    let words = [...state.words];
    const nextIdx = state.currentQueueIndex + 1;

    // Check if we need to introduce new words (wave refill)
    const activeCount = words.filter((w) => w.status === 'active').length;
    if (activeCount < REFILL_THRESHOLD) {
      const untestedWords = words.filter((w) => w.status === 'untested');
      const toActivate = untestedWords.slice(0, INITIAL_BATCH);
      if (toActivate.length > 0) {
        words = words.map((w) => {
          if (toActivate.some((u) => u.wordMasteryId === w.wordMasteryId)) {
            return { ...w, status: 'active' as WordStatus, stage: 1 };
          }
          return w;
        });
      }
    }

    // Check if all words are done (mastered or skipped)
    const remainingActive = words.filter((w) => w.status === 'active').length;
    const remainingUntested = words.filter((w) => w.status === 'untested').length;

    if (remainingActive === 0 && remainingUntested === 0) {
      set({ isComplete: true, words });

      // Complete session on backend
      if (state.sessionId) {
        const sessionId = state.sessionId;
        const masteredCount = words.filter((w) => w.status === 'mastered').length;
        const skippedCount = words.filter((w) => w.status === 'skipped').length;

        stageTestService.complete(sessionId, {
          mastered_count: masteredCount,
          skipped_count: skippedCount,
          total_answered: state.totalAnswered,
          best_combo: state.bestCombo,
        }).then((result) => {
          useStageTestStore.setState({ completionResult: result });
        }).catch((err) => {
          console.error('[stageTest.complete] failed:', err);
        });
      }
      return;
    }

    // Check if we need more questions
    const remainingQuestions = state.questionQueue.length - nextIdx;
    if (remainingQuestions < QUESTION_FETCH_THRESHOLD && state.sessionId && !state.isFetchingQuestions) {
      const activeIds = getActiveWordMasteryIds(words);
      if (activeIds.length > 0) {
        // Build error_counts for words with failures
        const errorCounts: Record<string, number> = {};
        words.filter((w) => w.status === 'active' && w.failCount > 0)
          .forEach((w) => { errorCounts[w.wordMasteryId] = w.failCount; });
        const ec = Object.keys(errorCounts).length > 0 ? errorCounts : undefined;
        set({ isFetchingQuestions: true });
        stageTestService.fetchQuestions(state.sessionId, activeIds, ec)
          .then(({ questions }) => {
            const latest = useStageTestStore.getState();
            useStageTestStore.setState({
              questionQueue: [...latest.questionQueue, ...questions],
              isFetchingQuestions: false,
            });
          })
          .catch(() => {
            useStageTestStore.setState({ isFetchingQuestions: false });
          });
      }
    }

    // If we have the next question, advance
    if (nextIdx < state.questionQueue.length) {
      set({
        currentQueueIndex: nextIdx,
        words,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        feedbackQuestion: null,
      });
    } else {
      // Need to wait for question fetch
      set({
        isLoading: true,
        words,
        selectedAnswer: null,
        typedAnswer: '',
        answerResult: null,
        feedbackQuestion: null,
      });

      // Fetch questions for active words
      const activeIds = getActiveWordMasteryIds(words);
      if (activeIds.length > 0 && state.sessionId) {
        // Build error_counts for words with failures
        const errorCounts2: Record<string, number> = {};
        words.filter((w) => w.status === 'active' && w.failCount > 0)
          .forEach((w) => { errorCounts2[w.wordMasteryId] = w.failCount; });
        const ec2 = Object.keys(errorCounts2).length > 0 ? errorCounts2 : undefined;
        stageTestService.fetchQuestions(state.sessionId, activeIds, ec2)
          .then(({ questions }) => {
            const latest = useStageTestStore.getState();
            const newQueue = [...latest.questionQueue, ...questions];
            useStageTestStore.setState({
              questionQueue: newQueue,
              currentQueueIndex: nextIdx,
              isLoading: false,
            });
          })
          .catch((err) => {
            useStageTestStore.setState({
              error: getErrorMessage(err, '다음 문제를 불러올 수 없습니다.'),
              isLoading: false,
            });
          });
      }
    }
  },

  reset: () => {
    set({ ...initialState });
  },
}));

// --- Selectors ---

/** Get the current question. During feedback, returns the snapshot. */
export function useCurrentStageQuestion(): MasteryQuestion | null {
  return useStageTestStore((s) => {
    if (s.feedbackQuestion) return s.feedbackQuestion;
    return s.questionQueue[s.currentQueueIndex] ?? null;
  });
}

/** Get the StageWord for the current question. */
export function useCurrentStageWord(): StageWord | null {
  return useStageTestStore((s) => {
    const q = s.feedbackQuestion ?? s.questionQueue[s.currentQueueIndex];
    if (!q) return null;
    return s.words.find((w) => w.wordMasteryId === q.word_mastery_id) ?? null;
  });
}

/** Progress ratio: (mastered + skipped) / total */
export function useStageProgress(): number {
  return useStageTestStore((s) => {
    if (s.totalWords === 0) return 0;
    return (s.masteredCount + s.skippedCount) / s.totalWords;
  });
}

export default useStageTestStore;
