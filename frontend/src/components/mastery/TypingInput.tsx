/**
 * TypingInput - letter-box style input for typing questions.
 * Individual boxes for each letter. Hint characters pre-filled per word.
 * Spaces rendered as visual gaps and auto-inserted.
 * Korean IME auto-converts to English (2-벌식 keyboard mapping).
 *
 * Hint format: "f__ t__ f____ t___" (per-word first letter + underscores)
 * Value contract: value = full answer string (e.g., "for the first time").
 */
import { memo, useRef, useEffect, useCallback, useMemo } from 'react';
import { koreanToEnglish } from '../../utils/koreanToEnglish';

interface TypingInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  /** Hint string from backend (e.g., "f___" or "f__ t___") */
  hint?: string | null;
  /** When true, 0 key triggers replay instead of input */
  isListenMode?: boolean;
}

/** Zero-width space placeholder — preserves string length so positional mapping stays intact. */
const PH = '\u200B';

/** Parse hint into position types and metadata */
function parseHint(hint: string | null | undefined) {
  if (!hint) return { chars: [] as Array<'hint' | 'input' | 'space'>, hintChars: new Map<number, string>(), inputPositions: [] as number[], totalLen: 4 };
  const chars: Array<'hint' | 'input' | 'space'> = [];
  const hintChars = new Map<number, string>();
  const inputPositions: number[] = [];
  for (let i = 0; i < hint.length; i++) {
    const c = hint[i];
    if (c === ' ') {
      chars.push('space');
    } else if (c !== '_') {
      chars.push('hint');
      hintChars.set(i, c);
    } else {
      chars.push('input');
      inputPositions.push(i);
    }
  }
  return { chars, hintChars, inputPositions, totalLen: hint.length };
}

export const TypingInput = memo(function TypingInput({
  value,
  onChange,
  onSubmit,
  disabled,
  hint,
  isListenMode = false,
}: TypingInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const { chars, hintChars, inputPositions, totalLen } = useMemo(() => parseHint(hint), [hint]);
  const userSlots = inputPositions.length;

  /** Extract user-typed characters from full value */
  const getUserInput = useCallback((val: string): string => {
    if (!val) return '';
    return inputPositions.map(pos => {
      const ch = val[pos];
      return (!ch || ch === PH) ? '' : ch;
    }).join('');
  }, [inputPositions]);

  /** Reconstruct full value from user input characters.
   *  Uses PH (zero-width space) for unfilled slots so string length === totalLen. */
  const buildValue = useCallback((userInput: string): string => {
    const result: string[] = new Array(totalLen).fill(PH);
    hintChars.forEach((ch, pos) => { result[pos] = ch; });
    chars.forEach((type, pos) => { if (type === 'space') result[pos] = ' '; });
    for (let i = 0; i < userInput.length && i < inputPositions.length; i++) {
      result[inputPositions[i]] = userInput[i];
    }
    return result.join('');
  }, [totalLen, hintChars, chars, inputPositions]);

  const userInput = getUserInput(value);

  // Focus management — aggressively keep hidden input focused
  const focusInput = useCallback(() => {
    if (!disabled && inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  }, [disabled]);

  useEffect(() => {
    if (!disabled) {
      const t = setTimeout(focusInput, 100);
      return () => clearTimeout(t);
    }
  }, [disabled, focusInput]);

  useEffect(() => {
    if (userInput.length === 0 && !disabled) {
      const t = setTimeout(focusInput, 50);
      return () => clearTimeout(t);
    }
  }, [userInput.length, disabled, focusInput]);

  // Reset hidden input when question changes
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = '';
  }, [value]);

  const appendChars = useCallback((raw: string) => {
    const english = koreanToEnglish(raw);
    if (!english) return;
    const cur = getUserInput(valueRef.current);
    const remaining = userSlots - cur.length;
    if (remaining <= 0) return;
    const added = english.slice(0, remaining);
    onChange(buildValue(cur + added));
  }, [userSlots, onChange, getUserInput, buildValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (composingRef.current || e.nativeEvent.isComposing) return;
    if (isListenMode && e.key === '0') { e.preventDefault(); return; }

    if (e.key === 'Backspace') {
      e.preventDefault();
      const cur = getUserInput(valueRef.current);
      if (cur.length > 0) onChange(buildValue(cur.slice(0, -1)));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (getUserInput(valueRef.current).length >= userSlots) onSubmit();
      return;
    }

    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      appendChars(e.key);
    }
  }, [userSlots, onChange, onSubmit, appendChars, isListenMode, getUserInput, buildValue]);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent) => {
    composingRef.current = false;
    const raw = (e.target as HTMLInputElement).value;
    if (inputRef.current) inputRef.current.value = '';
    if (raw) appendChars(raw);
  }, [appendChars]);

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    if (composingRef.current) return;
    const raw = e.currentTarget.value;
    if (inputRef.current) inputRef.current.value = '';
    if (raw) appendChars(raw);
  }, [appendChars]);

  // Re-focus hidden input when container or its children lose focus
  const handleContainerBlur = useCallback((e: React.FocusEvent) => {
    if (disabled || composingRef.current) return;
    // Small delay to allow focus to settle on new target
    setTimeout(() => {
      if (composingRef.current) return; // Don't interfere with composition
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
      }
    }, 10);
  }, [disabled]);

  // Redirect any key press on the container to the hidden input
  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (document.activeElement !== inputRef.current) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [disabled]);

  // Compute cursor position (next input slot index)
  const nextInputIdx = userInput.length < userSlots ? inputPositions[userInput.length] : -1;

  return (
    <div className="flex flex-col items-center gap-2 w-full mt-3">
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="relative flex justify-center flex-wrap cursor-text"
        style={{ gap: 4 }}
        tabIndex={-1}
        onClick={focusInput}
        onBlur={handleContainerBlur}
        onKeyDown={handleContainerKeyDown}
      >
        {/* Hidden input overlay for keyboard capture */}
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={disabled}
          className="absolute inset-0 opacity-0 z-10"
          style={{ fontSize: 16, caretColor: 'transparent' }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={handleCompositionEnd}
          onInput={handleInput}
        />

        {/* Visual letter boxes */}
        {chars.map((type, i) => {
          if (type === 'space') {
            return <div key={i} style={{ width: 12 }} />;
          }

          const isHint = type === 'hint';
          const hintLetter = hintChars.get(i) || '';
          // For input positions, find which user char fills this slot
          const inputIdx = type === 'input' ? inputPositions.indexOf(i) : -1;
          const char = isHint ? hintLetter : (inputIdx >= 0 ? userInput[inputIdx] || '' : '');
          const isCursor = i === nextInputIdx && !disabled;

          return (
            <div
              key={i}
              className="relative flex items-center justify-center select-none"
              style={{
                width: 36,
                height: 44,
                borderRadius: 8,
                backgroundColor: isHint ? '#EEF2FF' : char ? '#FAFAF9' : '#FFFFFF',
                border: isCursor
                  ? '2px solid #4F46E5'
                  : isHint
                    ? '2px solid #C7D2FE'
                    : char
                      ? '1.5px solid #D1D5DB'
                      : '1.5px dashed #D1D5DB',
                fontFamily: "'Pretendard Variable', 'Pretendard', monospace",
                fontSize: 20,
                fontWeight: 700,
                color: isHint ? '#4F46E5' : '#1A1918',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              {char}
              {isCursor && (
                <div
                  className="absolute"
                  style={{
                    width: 2,
                    height: 20,
                    backgroundColor: '#4F46E5',
                    animation: 'letterBlink 1s step-end infinite',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {!disabled && userInput.length < userSlots && (
        <p className="font-display text-xs text-text-tertiary">
          Enter를 눌러 제출
        </p>
      )}

      <style>{`
        @keyframes letterBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
});
