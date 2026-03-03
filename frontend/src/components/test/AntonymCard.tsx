import { memo } from 'react';
import { Volume2 } from 'lucide-react';
import { speakWord } from '../../utils/tts';
import { TypingInput } from '../mastery/TypingInput';

interface AntonymCardProps {
  english: string;
  korean?: string;
  prompt?: string;
  /** Typing props - when provided, renders inline typing input */
  typingValue?: string;
  onTypingChange?: (value: string) => void;
  onTypingSubmit?: () => void;
  typingDisabled?: boolean;
  typingHint?: string | null;
  isListenMode?: boolean;
}

export const AntonymCard = memo(function AntonymCard({
  english,
  korean,
  prompt,
  typingValue,
  onTypingChange,
  onTypingSubmit,
  typingDisabled,
  typingHint,
  isListenMode,
}: AntonymCardProps) {
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
        {prompt || (isTyping ? '\uB2E4\uC74C \uB2E8\uC5B4\uC758 \uBC18\uC758\uC5B4\uB97C \uC785\uB825\uD558\uC2DC\uC624' : '\uB2E4\uC74C \uB2E8\uC5B4\uC758 \uBC18\uC758\uC5B4\uB97C \uACE0\uB974\uC2DC\uC624')}
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
      {isTyping && (
        <TypingInput
          value={typingValue ?? ''}
          onChange={onTypingChange!}
          onSubmit={onTypingSubmit!}
          disabled={typingDisabled}
          hint={typingHint}
          isListenMode={isListenMode}
        />
      )}
    </div>
  );
});
