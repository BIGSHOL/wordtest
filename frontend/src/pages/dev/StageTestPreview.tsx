/**
 * DEV ONLY: Standalone preview of Stage Test UI with mock data.
 * Shows all stage states (S1~S4, Master, Wait) in a realistic layout.
 * Delete this file before production deploy.
 */
import { useState, useCallback } from 'react';
import { StageProgressBar } from '../../components/stage-test/StageProgressBar';
import type { StageWord } from '../../stores/stageTestStore';
import { X, Zap } from 'lucide-react';

// Stage colors matching StageTestPage
const STAGE_COLORS = [
  '',
  '#94A3B8', // stage 1
  '#3B82F6', // stage 2
  '#F59E0B', // stage 3
  '#F97316', // stage 4
  '#22C55E', // stage 5
];

// Mock word data: 20 words in various stages
function createMockWords(): StageWord[] {
  const words: StageWord[] = [
    // 3 mastered
    { wordMasteryId: 'm1', wordId: 'w1', english: 'apple', korean: '사과', stage: 5, failCount: 0, status: 'mastered' },
    { wordMasteryId: 'm2', wordId: 'w2', english: 'banana', korean: '바나나', stage: 5, failCount: 0, status: 'mastered' },
    { wordMasteryId: 'm3', wordId: 'w3', english: 'cherry', korean: '체리', stage: 5, failCount: 0, status: 'mastered' },
    // 2 at stage 4
    { wordMasteryId: 'm4', wordId: 'w4', english: 'dragon', korean: '용', stage: 4, failCount: 0, status: 'active' },
    { wordMasteryId: 'm5', wordId: 'w5', english: 'eagle', korean: '독수리', stage: 4, failCount: 1, status: 'active' },
    // 3 at stage 3
    { wordMasteryId: 'm6', wordId: 'w6', english: 'forest', korean: '숲', stage: 3, failCount: 0, status: 'active' },
    { wordMasteryId: 'm7', wordId: 'w7', english: 'garden', korean: '정원', stage: 3, failCount: 0, status: 'active' },
    { wordMasteryId: 'm8', wordId: 'w8', english: 'hammer', korean: '망치', stage: 3, failCount: 1, status: 'active' },
    // 3 at stage 2
    { wordMasteryId: 'm9', wordId: 'w9', english: 'island', korean: '섬', stage: 2, failCount: 0, status: 'active' },
    { wordMasteryId: 'm10', wordId: 'w10', english: 'jungle', korean: '정글', stage: 2, failCount: 0, status: 'active' },
    { wordMasteryId: 'm11', wordId: 'w11', english: 'kingdom', korean: '왕국', stage: 2, failCount: 2, status: 'active' },
    // 2 at stage 1
    { wordMasteryId: 'm12', wordId: 'w12', english: 'lemon', korean: '레몬', stage: 1, failCount: 0, status: 'active' },
    { wordMasteryId: 'm13', wordId: 'w13', english: 'mountain', korean: '산', stage: 1, failCount: 1, status: 'active' },
    // 7 waiting
    { wordMasteryId: 'm14', wordId: 'w14', english: 'notebook', korean: '공책', stage: 1, failCount: 0, status: 'untested' },
    { wordMasteryId: 'm15', wordId: 'w15', english: 'ocean', korean: '바다', stage: 1, failCount: 0, status: 'untested' },
    { wordMasteryId: 'm16', wordId: 'w16', english: 'pencil', korean: '연필', stage: 1, failCount: 0, status: 'untested' },
    { wordMasteryId: 'm17', wordId: 'w17', english: 'queen', korean: '여왕', stage: 1, failCount: 0, status: 'untested' },
    { wordMasteryId: 'm18', wordId: 'w18', english: 'river', korean: '강', stage: 1, failCount: 0, status: 'untested' },
    { wordMasteryId: 'm19', wordId: 'w19', english: 'sunset', korean: '일몰', stage: 1, failCount: 0, status: 'untested' },
    { wordMasteryId: 'm20', wordId: 'w20', english: 'tiger', korean: '호랑이', stage: 1, failCount: 0, status: 'untested' },
  ];
  return words;
}

// Preset scenarios
const PRESETS = {
  'mid-game': () => createMockWords(),
  'early': () => createMockWords().map((w, i) =>
    i < 2
      ? { ...w, stage: 2, status: 'active' as const, failCount: 0 }
      : { ...w, stage: 1, status: 'untested' as const, failCount: 0 }
  ),
  'late': () => createMockWords().map((w, i) =>
    i < 14
      ? { ...w, stage: 5, status: 'mastered' as const, failCount: 0 }
      : i < 17
      ? { ...w, stage: 4, status: 'active' as const, failCount: 0 }
      : { ...w, stage: 3, status: 'active' as const, failCount: 0 }
  ),
  'all-mastered': () => createMockWords().map(w => ({
    ...w, stage: 5, status: 'mastered' as const, failCount: 0,
  })),
};

export default function StageTestPreview() {
  const [words, setWords] = useState<StageWord[]>(createMockWords());
  const [currentStage, setCurrentStage] = useState(3);
  const totalWords = 20;

  const stageColor = STAGE_COLORS[currentStage] || STAGE_COLORS[1];

  // Simulate mastering a word
  const masterNext = useCallback(() => {
    setWords(prev => {
      const idx = prev.findIndex(w => w.status === 'active');
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], stage: 5, status: 'mastered' };
      return next;
    });
  }, []);

  // Simulate advancing a word's stage
  const advanceNext = useCallback(() => {
    setWords(prev => {
      const idx = prev.findIndex(w => w.status === 'active' && w.stage < 5);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], stage: next[idx].stage + 1 };
      return next;
    });
  }, []);

  // Activate a waiting word
  const activateNext = useCallback(() => {
    setWords(prev => {
      const idx = prev.findIndex(w => w.status === 'untested');
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], status: 'active', stage: 1 };
      return next;
    });
  }, []);

  const totalAnswered = words.filter(w => w.status === 'mastered' || w.status === 'skipped').length;

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header - identical to StageTestPage */}
      <div className="flex items-center justify-between h-14 px-4 md:px-8 lg:px-20">
        <button className="w-10 h-10 rounded-full flex items-center justify-center">
          <X className="w-[22px] h-[22px] text-text-primary" />
        </button>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 rounded-full px-3.5 py-[5px]"
            style={{
              background: `linear-gradient(135deg, ${stageColor}, ${stageColor}CC)`,
              boxShadow: `0 0 8px ${stageColor}30`,
            }}
          >
            <Zap className="w-3.5 h-3.5 text-white" />
            <span className="font-display text-[13px] font-bold text-white">
              Stage {currentStage}
            </span>
          </div>
        </div>

        <span className="font-display text-[15px] font-semibold text-text-secondary">
          {totalAnswered} / {totalWords}
        </span>
      </div>

      {/* Stage segment progress bar */}
      <StageProgressBar words={words} totalWords={totalWords} />

      {/* Mock quiz content area */}
      <div className="flex-1 flex flex-col justify-center items-center gap-6 px-5 py-6 md:px-8 md:gap-7">
        {/* Timer mock */}
        <div className="w-full md:w-[640px]">
          <div className="w-full h-1.5 rounded-full bg-[#E5E4E1] overflow-hidden">
            <div className="h-full w-[65%] rounded-full bg-accent-indigo transition-all" />
          </div>
        </div>

        {/* Word card mock */}
        <div className="w-full md:w-[640px]">
          <div className="rounded-2xl bg-white border border-[#E5E4E1] px-8 py-10 md:py-12 flex flex-col items-center justify-center">
            <span className="font-word text-3xl md:text-4xl font-bold text-text-primary">
              forest
            </span>
          </div>
        </div>

        {/* Choice buttons mock */}
        <div className="w-full md:w-[640px] flex flex-col gap-3">
          {['숲', '정원', '강', '바다'].map((choice, i) => (
            <button
              key={choice}
              className="w-full h-14 rounded-2xl border-2 border-[#E5E4E1] bg-white font-display text-[15px] font-semibold text-text-primary hover:border-accent-indigo hover:bg-accent-indigo-light transition-all"
            >
              <span className="text-text-tertiary mr-2">{i + 1}</span>
              {choice}
            </button>
          ))}
        </div>
      </div>

      {/* Dev controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-50">
        <div className="max-w-[640px] mx-auto">
          <p className="text-xs text-gray-500 font-mono mb-2">DEV Controls - Stage Test Preview</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={masterNext}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
            >
              Master Next
            </button>
            <button
              onClick={advanceNext}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
            >
              Advance Stage
            </button>
            <button
              onClick={activateNext}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200"
            >
              Activate Wait
            </button>
            <span className="border-l border-gray-300 mx-1" />
            {/* Stage switcher */}
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                onClick={() => setCurrentStage(s)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  currentStage === s
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={currentStage === s ? { backgroundColor: STAGE_COLORS[s] } : undefined}
              >
                S{s}
              </button>
            ))}
            <span className="border-l border-gray-300 mx-1" />
            {/* Presets */}
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map(key => (
              <button
                key={key}
                onClick={() => setWords(PRESETS[key]())}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200"
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
