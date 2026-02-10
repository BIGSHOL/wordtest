import { memo } from 'react';
import { Volume2 } from 'lucide-react';
import { speakWord } from '../../utils/tts';

interface WordCardProps {
  word: string;
}

export const WordCard = memo(function WordCard({ word }: WordCardProps) {

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 py-10 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-sm font-medium text-text-tertiary">
        다음 영단어의 뜻은?
      </p>
      <h2 className="font-word text-[42px] font-bold text-text-primary" style={{ letterSpacing: -1 }}>
        {word}
      </h2>
      <button
        onClick={() => speakWord(word)}
        className="flex items-center gap-2 rounded-full bg-accent-indigo-light px-5 py-2.5"
      >
        <Volume2 className="w-[18px] h-[18px] text-accent-indigo" />
        <span className="font-display text-[13px] font-medium text-accent-indigo">발음 듣기</span>
      </button>
    </div>
  );
});
