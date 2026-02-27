import { memo } from 'react';
import { TypingInput } from '../mastery/TypingInput';

interface MeaningCardProps {
  korean: string;
  /** Typing props - when provided, renders inline typing input */
  typingValue?: string;
  onTypingChange?: (value: string) => void;
  onTypingSubmit?: () => void;
  typingDisabled?: boolean;
  typingHint?: string | null;
  isListenMode?: boolean;
}

export const MeaningCard = memo(function MeaningCard({
  korean,
  typingValue,
  onTypingChange,
  onTypingSubmit,
  typingDisabled,
  typingHint,
  isListenMode,
}: MeaningCardProps) {
  const isTyping = onTypingChange !== undefined && onTypingSubmit !== undefined;

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-10 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-[16px] font-semibold text-text-secondary">
        다음 뜻에 해당하는 영단어는?
      </p>
      <h2 className="font-display text-[32px] md:text-[36px] font-bold text-text-primary leading-snug text-center">
        {korean}
      </h2>
      {isTyping && (
        <TypingInput
          value={typingValue ?? ''}
          onChange={onTypingChange!}
          onSubmit={onTypingSubmit!}
          disabled={typingDisabled}
          hint={typingHint}
          isListenMode={isListenMode}
          placeholder="영어 단어를 입력하세요"
        />
      )}
    </div>
  );
});
