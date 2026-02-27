import { memo, useCallback } from 'react';
import { Headphones, Volume2 } from 'lucide-react';
import { speakWord } from '../../utils/tts';
import { TypingInput } from '../mastery/TypingInput';

interface ListeningCardProps {
  english: string;
  /** Typing props - when provided, renders inline typing input */
  typingValue?: string;
  onTypingChange?: (value: string) => void;
  onTypingSubmit?: () => void;
  typingDisabled?: boolean;
  typingHint?: string | null;
}

export const ListeningCard = memo(function ListeningCard({
  english,
  typingValue,
  onTypingChange,
  onTypingSubmit,
  typingDisabled,
  typingHint,
}: ListeningCardProps) {
  const handleReplay = useCallback(() => {
    speakWord(english);
  }, [english]);

  const isTyping = onTypingChange !== undefined && onTypingSubmit !== undefined;

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-8 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-[16px] font-semibold text-text-secondary">
        {isTyping ? '발음을 듣고 영어 단어를 입력하시오' : '발음을 듣고 알맞은 단어를 고르시오'}
      </p>
      <div className="flex items-center justify-center" style={{ minHeight: isTyping ? 80 : 140 }}>
        <Headphones className={`${isTyping ? 'w-16 h-16' : 'w-24 h-24'} text-accent-indigo opacity-30`} strokeWidth={1.2} />
      </div>
      <button
        onClick={handleReplay}
        className="flex items-center gap-2 rounded-full bg-accent-indigo-light px-5 py-2.5 active:scale-95 transition-transform"
      >
        <Volume2 className="w-[18px] h-[18px] text-accent-indigo" />
        <span className="font-display text-[13px] font-medium text-accent-indigo">다시 듣기</span>
      </button>
      {isTyping && (
        <TypingInput
          value={typingValue ?? ''}
          onChange={onTypingChange!}
          onSubmit={onTypingSubmit!}
          disabled={typingDisabled}
          hint={typingHint}
          isListenMode={true}
          placeholder="영어 단어를 입력하세요"
        />
      )}
    </div>
  );
});
