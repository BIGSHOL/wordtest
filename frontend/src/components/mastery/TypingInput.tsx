/**
 * Typing input component for stages 3 and 5.
 * Auto-focus, Enter submit, IME handling, case-insensitive.
 */
import { memo, useRef, useEffect, useCallback } from 'react';
import { Keyboard } from 'lucide-react';

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
    [value, onSubmit],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (composingRef.current) return;
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        className="flex items-center gap-3 w-full h-16 px-5 rounded-2xl bg-bg-surface transition-all"
        style={{
          border: `2px solid ${disabled ? '#E5E4E1' : '#4F46E5'}`,
          boxShadow: disabled ? 'none' : '0 2px 12px #4F46E520',
        }}
      >
        <Keyboard className="w-5 h-5 text-text-tertiary shrink-0" />
        {hint && (
          <span className="text-lg font-bold text-indigo-500 shrink-0 select-none tracking-widest" style={{ fontFamily: 'monospace' }}>
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
          className="flex-1 font-word text-xl font-bold text-text-primary placeholder:text-text-tertiary placeholder:font-normal bg-transparent outline-none tracking-wide"
          style={{ fontSize: 20 }}
        />
      </div>
      {!disabled && (
        <p className="font-display text-xs text-text-tertiary">
          Enter를 눌러 제출하세요
        </p>
      )}
    </div>
  );
});
