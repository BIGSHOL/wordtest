/**
 * Typing input component for typing-mode questions.
 * Renders as an underline-style input that integrates into question cards.
 * Auto-focus, Enter submit, IME handling, case-insensitive.
 */
import { memo, useRef, useEffect, useCallback } from 'react';

interface TypingInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** When true, 0 key triggers replay instead of input (listen stages) */
  isListenMode?: boolean;
  /** First-letter hint for typing questions */
  hint?: string | null;
}

export const TypingInput = memo(function TypingInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = '영어 단어를 입력하세요',
  isListenMode = false,
  hint,
}: TypingInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    // Auto-focus on mount
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Re-focus when value is cleared (new question)
  useEffect(() => {
    if (value === '' && !disabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [value, disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // In listen mode, 0 key = replay (handled by ListenCard global listener)
      if (isListenMode && e.key === '0') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' && !composingRef.current && value.trim().length > 0) {
        e.preventDefault();
        onSubmit();
      }
    },
    [value, onSubmit, isListenMode],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (composingRef.current) return;
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col items-center gap-2 w-full mt-4">
      <div className="flex items-center justify-center gap-1 w-full max-w-[320px]">
        {hint && (
          <span
            className="text-xl font-bold text-indigo-500 shrink-0 select-none tracking-widest"
            style={{ fontFamily: 'monospace' }}
          >
            {hint}
          </span>
        )}
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            onChange((e.target as HTMLInputElement).value);
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full font-word text-[22px] font-bold text-center text-text-primary placeholder:text-text-tertiary placeholder:font-normal placeholder:text-[16px] bg-transparent outline-none tracking-wide pb-1"
          style={{
            borderBottom: `3px solid ${disabled ? '#D1D5DB' : '#4F46E5'}`,
            borderBottomStyle: value ? 'solid' : 'dashed',
          }}
        />
      </div>
      {!disabled && (
        <p className="font-display text-xs text-text-tertiary mt-1">
          Enter를 눌러 제출
        </p>
      )}
    </div>
  );
});
