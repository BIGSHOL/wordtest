import { memo, useMemo } from 'react';
import { Volume2 } from 'lucide-react';
import { speakSentence } from '../../utils/tts';

interface SentenceCardProps {
  sentence: string;
  word: string;
}

function splitSentence(sentence: string, word: string): { before: string; after: string } {
  const regex = new RegExp(`\\b(${word})\\b`, 'i');
  const match = sentence.match(regex);
  if (match && match.index !== undefined) {
    return {
      before: sentence.slice(0, match.index),
      after: sentence.slice(match.index + match[0].length),
    };
  }
  // Fallback: word not found literally in sentence
  return { before: sentence + ' (', after: ')' };
}

export const SentenceCard = memo(function SentenceCard({ sentence, word }: SentenceCardProps) {
  const { before, after } = useMemo(() => splitSentence(sentence, word), [sentence, word]);

  const handleSpeak = () => {
    speakSentence(sentence);
  };

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-bg-surface px-6 md:px-8 py-8 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-sm font-medium text-text-tertiary">
        빈칸에 들어갈 영단어를 고르세요
      </p>
      <div className="flex items-center justify-center flex-wrap w-full">
        <span className="font-word text-[22px] font-medium text-text-primary" style={{ lineHeight: 1.6 }}>
          {before}
        </span>
        <span
          className="inline-flex items-center justify-center h-9 min-w-[80px] rounded-lg bg-accent-indigo-light border-2 border-dashed border-accent-indigo mx-1"
        >
          <span className="font-word text-lg font-bold text-accent-indigo tracking-[4px]">
            ____
          </span>
        </span>
        <span className="font-word text-[22px] font-medium text-text-primary" style={{ lineHeight: 1.6 }}>
          {after}
        </span>
      </div>
      <button
        onClick={handleSpeak}
        className="flex items-center gap-2 rounded-full bg-accent-indigo-light px-5 py-2.5 active:scale-95 transition-transform"
      >
        <Volume2 className="w-[18px] h-[18px] text-accent-indigo" />
        <span className="font-display text-[13px] font-medium text-accent-indigo">예문 듣기</span>
      </button>
    </div>
  );
});
