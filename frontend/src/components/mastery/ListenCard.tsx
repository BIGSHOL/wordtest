/**
 * Listen card - plays word or sentence pronunciation for stages 3 and 4.
 * Auto-plays on mount, with replay button.
 * In sentence mode, plays the full sentence and shows the blank.
 */
import { memo, useEffect, useRef, useCallback } from 'react';
import { Volume2, RefreshCw, BookOpen } from 'lucide-react';
import { speakWord, speakSentence } from '../../utils/tts';

interface ListenCardProps {
  word: string;
  stage: number;
  korean?: string;
  contextMode?: 'word' | 'sentence';
  sentenceBlank?: string | null;
  sentenceEn?: string | null;
}

export const ListenCard = memo(function ListenCard({
  word,
  stage,
  korean,
  contextMode = 'word',
  sentenceBlank,
  sentenceEn,
}: ListenCardProps) {
  const playedRef = useRef(false);
  const isSentence = contextMode === 'sentence' && sentenceEn;

  const play = useCallback(() => {
    if (isSentence) {
      speakSentence(sentenceEn!);
    } else {
      speakWord(word);
    }
  }, [word, isSentence, sentenceEn]);

  useEffect(() => {
    // Auto-play on mount
    if (!playedRef.current) {
      playedRef.current = true;
      const timer = setTimeout(play, 300);
      return () => clearTimeout(timer);
    }
  }, [word, sentenceEn]);

  // Reset on word change
  useEffect(() => {
    playedRef.current = false;
  }, [word]);

  const prompt = isSentence
    ? (stage === 3 ? '문장을 듣고 빈칸의 단어를 입력하세요' : '문장을 듣고 빈칸 단어의 뜻을 고르세요')
    : (stage === 3 ? '들리는 영어 단어를 입력하세요' : '들리는 영어 단어의 뜻은?');

  // Split sentence around ____ for styled blank rendering
  const blankParts = sentenceBlank?.split('____');

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-10 w-full"
      style={{ borderRadius: 20, boxShadow: '0 4px 24px #1A191812' }}
    >
      {/* Sentence mode badge */}
      {isSentence && (
        <div className="flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1">
          <BookOpen className="w-3.5 h-3.5 text-violet-500" />
          <span className="font-display text-[11px] font-semibold text-violet-600">예문 문제</span>
        </div>
      )}

      <p className="font-display text-sm font-medium text-text-tertiary text-center">
        {prompt}
      </p>

      {/* Large speaker icon */}
      <button
        onClick={play}
        className="w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95"
        style={{
          background: isSentence
            ? 'linear-gradient(135deg, #7C3AED, #A855F7)'
            : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          boxShadow: '0 4px 20px #4F46E530',
        }}
      >
        <Volume2 className="w-10 h-10 text-white" />
      </button>

      {/* Korean meaning in sentence mode */}
      {isSentence && korean && (
        <p className="font-display text-[15px] font-bold text-accent-indigo text-center">
          {korean}
        </p>
      )}

      {/* Show sentence blank in sentence mode */}
      {isSentence && blankParts && blankParts.length >= 2 && (
        <p className="font-word text-[17px] md:text-[19px] font-medium text-text-secondary leading-relaxed text-center px-2">
          {blankParts[0]}
          <span
            className="inline-block min-w-[50px] border-b-[3px] border-accent-indigo mx-1"
            style={{ borderBottomStyle: 'dashed' }}
          >
            &nbsp;&nbsp;&nbsp;&nbsp;
          </span>
          {blankParts[1]}
        </p>
      )}

      <button
        onClick={play}
        className="flex items-center gap-1.5 text-accent-indigo font-display text-[13px] font-medium"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        다시 듣기
      </button>
    </div>
  );
});
