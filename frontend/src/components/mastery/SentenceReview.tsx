/**
 * Sentence review card - shown after Stage 1 correct answer.
 * Displays example sentence (en + ko) with TTS button for reinforcement.
 */
import { memo, useCallback } from 'react';
import { Volume2, BookOpen } from 'lucide-react';
import { speakSentence } from '../../utils/tts';

interface SentenceReviewProps {
  english: string;
  word: string;
  exampleEn?: string;
  exampleKo?: string;
  partOfSpeech?: string;
  onDismiss: () => void;
}

export const SentenceReview = memo(function SentenceReview({
  english,
  word,
  exampleEn,
  exampleKo,
  partOfSpeech,
  onDismiss,
}: SentenceReviewProps) {
  const handlePlaySentence = useCallback(() => {
    if (exampleEn) speakSentence(exampleEn);
  }, [exampleEn]);

  // Highlight the target word in the example sentence
  const renderHighlighted = (text: string) => {
    const regex = new RegExp(`(${word})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="font-bold text-accent-indigo">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl bg-bg-surface p-5 w-full animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ boxShadow: '0 4px 20px #1A191810' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-indigo" />
          <span className="font-display text-[13px] font-semibold text-accent-indigo">학습 카드</span>
        </div>
        <button
          onClick={onDismiss}
          className="font-display text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          다음 &rarr;
        </button>
      </div>

      {/* Word + POS */}
      <div className="flex items-baseline gap-2">
        <span className="font-word text-2xl font-bold text-text-primary">{english}</span>
        {partOfSpeech && (
          <span className="font-display text-xs text-text-tertiary italic">({partOfSpeech})</span>
        )}
      </div>

      {/* Example sentence */}
      {exampleEn && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <p className="font-display text-sm text-text-secondary leading-relaxed flex-1">
              {renderHighlighted(exampleEn)}
            </p>
            <button
              onClick={handlePlaySentence}
              className="shrink-0 p-1.5 rounded-full hover:bg-accent-indigo-light transition-colors"
            >
              <Volume2 className="w-4 h-4 text-accent-indigo" />
            </button>
          </div>
          {exampleKo && (
            <p className="font-display text-xs text-text-tertiary leading-relaxed">
              {exampleKo}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
