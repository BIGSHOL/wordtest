import { memo } from 'react';
import { Volume2 } from 'lucide-react';
import { speakWord } from '../../utils/tts';

interface AntonymCardProps {
  english: string;
  korean?: string;
}

export const AntonymCard = memo(function AntonymCard({ english, korean }: AntonymCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-10 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-sm font-medium text-text-tertiary">
        다음 단어의 반의어는?
      </p>
      <div className="flex items-center gap-3">
        <h2 className="font-display text-[32px] md:text-[36px] font-bold text-text-primary leading-snug text-center">
          {english}
        </h2>
        <button
          onClick={() => speakWord(english)}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="발음 듣기"
        >
          <Volume2 className="w-5 h-5 text-text-tertiary" />
        </button>
      </div>
      {korean && (
        <p className="font-display text-base text-text-secondary">{korean}</p>
      )}
    </div>
  );
});
