/**
 * Sentence fill-in-the-blank card for higher-level words.
 * Shows English sentence with ____ and Korean translation with highlighted word.
 */
import { memo, useRef, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, Volume2 } from 'lucide-react';
import { speakSentence } from '../../utils/tts';
import { koreanToEnglish } from '../../utils/koreanToEnglish';

interface SentenceBlankCardProps {
  /** English sentence with ____ replacing the target word */
  sentenceBlank: string;
  /** Korean meaning of the target word (used for highlighting) */
  korean?: string;
  /** Full Korean sentence translation */
  sentenceKo?: string;
  /** Full English sentence (for TTS) */
  sentenceEn?: string;
  /** Stage number for prompt text */
  stage: number;
  /** Typing props - when provided, renders inline typing input in the blank */
  typingValue?: string;
  onTypingChange?: (value: string) => void;
  onTypingSubmit?: () => void;
  typingDisabled?: boolean;
  typingHint?: string | null;
  isListenMode?: boolean;
}

const STAGE_PROMPTS: Record<number, string> = {
  1: '빈칸에 들어갈 영단어는?',
  2: '빈칸에 들어갈 영단어는?',
  3: '문장을 듣고 빈칸의 단어를 입력하세요',
  4: '문장을 듣고 빈칸의 영단어를 고르세요',
  5: '빈칸에 들어갈 영단어를 입력하세요',
};

// --- Korean jamo decomposition for fuzzy stem matching ---

/** Decompose a Hangul syllable into [initial, vowel, final] indices */
function decompose(ch: string): [number, number, number] | null {
  const c = ch.charCodeAt(0);
  if (c < 0xAC00 || c > 0xD7A3) return null;
  const o = c - 0xAC00;
  return [Math.floor(o / 588), Math.floor((o % 588) / 28), o % 28];
}

/** Find stem in text using jamo-aware matching.
 *  For non-last chars of stem: initial+vowel+final must match exactly.
 *  For last char of stem: only initial+vowel need to match (allows 받침 differences). */
function jamoMatch(text: string, stem: string): [number, number] | null {
  for (let i = 0; i <= text.length - stem.length; i++) {
    let ok = true;
    for (let j = 0; j < stem.length; j++) {
      const a = decompose(stem[j]);
      const b = decompose(text[i + j]);
      if (!a || !b) {
        if (stem[j] !== text[i + j]) { ok = false; break; }
        continue;
      }
      if (a[0] !== b[0] || a[1] !== b[1]) { ok = false; break; }
      // For non-last chars, final consonant must also match
      if (j < stem.length - 1 && a[2] !== b[2]) { ok = false; break; }
    }
    if (ok) return [i, i + stem.length];
  }
  return null;
}

/** Expand match indices to full Korean word boundaries (space-separated) */
function wordBounds(text: string, start: number, end: number): [number, number] {
  let s = start;
  let e = end;
  while (s > 0 && text[s - 1] !== ' ') s--;
  while (e < text.length && text[e] !== ' ') e++;
  return [s, e];
}

/** Highlight the Korean word meaning within the Korean sentence */
function highlightKorean(sentenceKo: string, korean: string): React.ReactNode {
  const meanings = korean.split(/[,、·]/).map(m => m.trim()).filter(m => m.length >= 2);

  // Strategy 1: Direct substring match (handles 하다-verbs, etc.)
  for (const meaning of meanings) {
    for (let len = meaning.length; len >= 2; len--) {
      const stem = meaning.slice(0, len);
      const idx = sentenceKo.indexOf(stem);
      if (idx !== -1) {
        const [s, e] = wordBounds(sentenceKo, idx, idx + stem.length);
        return <>{sentenceKo.slice(0, s)}<span className="font-bold" style={{ color: '#4F46E5' }}>{sentenceKo.slice(s, e)}</span>{sentenceKo.slice(e)}</>;
      }
    }
  }

  // Strategy 2: Jamo-aware match (handles ㅂ-irregular: 무서운→무섭다, etc.)
  for (const meaning of meanings) {
    for (let len = Math.min(meaning.length, 4); len >= 2; len--) {
      const stem = meaning.slice(0, len);
      const match = jamoMatch(sentenceKo, stem);
      if (match) {
        const [s, e] = wordBounds(sentenceKo, match[0], match[1]);
        return <>{sentenceKo.slice(0, s)}<span className="font-bold" style={{ color: '#4F46E5' }}>{sentenceKo.slice(s, e)}</span>{sentenceKo.slice(e)}</>;
      }
    }
  }

  // Fallback: no match found
  return sentenceKo;
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

export const SentenceBlankCard = memo(function SentenceBlankCard({
  sentenceBlank,
  korean,
  sentenceKo,
  sentenceEn,
  stage,
  typingValue,
  onTypingChange,
  onTypingSubmit,
  typingDisabled,
  typingHint,
  isListenMode,
}: SentenceBlankCardProps) {
  // Split sentence around ____ and render with highlight
  const parts = sentenceBlank.split('____');
  const isTyping = onTypingChange !== undefined && onTypingSubmit !== undefined;

  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const valueRef = useRef(typingValue ?? '');
  valueRef.current = typingValue ?? '';

  const { chars, hintChars, inputPositions, totalLen } = useMemo(() => parseHint(typingHint), [typingHint]);
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

  const userPart = getUserInput(typingValue ?? '');

  // Focus management
  useEffect(() => {
    if (isTyping && !typingDisabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isTyping, typingDisabled]);

  useEffect(() => {
    if (isTyping && userPart.length === 0 && !typingDisabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isTyping, userPart.length, typingDisabled]);

  // Reset hidden input when question changes
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = '';
  }, [typingValue]);

  const appendChars = useCallback((raw: string) => {
    const english = koreanToEnglish(raw);
    if (!english) return;
    const cur = getUserInput(valueRef.current);
    const remaining = userSlots - cur.length;
    if (remaining <= 0) return;
    const added = english.slice(0, remaining);
    onTypingChange?.(buildValue(cur + added));
  }, [userSlots, onTypingChange, getUserInput, buildValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (composingRef.current || e.nativeEvent.isComposing) return;
      if (isListenMode && e.key === '0') { e.preventDefault(); return; }

      if (e.key === 'Backspace') {
        e.preventDefault();
        const cur = getUserInput(valueRef.current);
        if (cur.length > 0) onTypingChange?.(buildValue(cur.slice(0, -1)));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (getUserInput(valueRef.current).length >= userSlots) onTypingSubmit?.();
        return;
      }

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        appendChars(e.key);
      }
    },
    [userSlots, onTypingChange, onTypingSubmit, appendChars, isListenMode, getUserInput, buildValue],
  );

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

  // Compute cursor position (next input slot index)
  const nextInputIdx = userPart.length < userSlots ? inputPositions[userPart.length] : -1;

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-bg-surface px-5 md:px-8 py-8 w-full"
      style={{ borderRadius: 20, boxShadow: '0 4px 24px #1A191812' }}
    >
      {/* Badge */}
      <div className="flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1">
        <BookOpen className="w-3.5 h-3.5 text-violet-500" />
        <span className="font-display text-[11px] font-semibold text-violet-600">예문 문제</span>
      </div>

      {/* Prompt */}
      <p className="font-display text-[16px] font-semibold text-text-secondary text-center">
        {STAGE_PROMPTS[stage] || '빈칸에 들어갈 단어는?'}
      </p>

      {/* Sentence with dashed blank */}
      <div
        className="font-word text-[20px] md:text-[22px] font-medium text-text-primary text-center px-2"
        style={{ lineHeight: '2' }}
      >
        {parts[0]}
        <span
          className="inline-block min-w-[60px] border-b-[3px] border-accent-indigo mx-1 text-center"
          style={{ borderBottomStyle: 'dashed' }}
        >
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </span>
        {parts[1]}
      </div>

      {/* Letter boxes — rendered below sentence, same design as standalone TypingInput */}
      {isTyping && (
        <div className="flex flex-col items-center gap-2 w-full mt-1">
          <div
            className="relative flex justify-center flex-wrap cursor-text"
            style={{ gap: 4 }}
            tabIndex={-1}
            onClick={() => !typingDisabled && inputRef.current?.focus()}
          >
            {/* Hidden input for keyboard capture */}
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={typingDisabled}
              className="absolute inset-0 opacity-0 z-10"
              style={{ fontSize: 16, caretColor: 'transparent' }}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={handleCompositionEnd}
              onInput={handleInput}
            />
            {/* Letter boxes */}
            {chars.map((type, i) => {
              if (type === 'space') {
                return <div key={i} style={{ width: 12 }} />;
              }

              const isHintBox = type === 'hint';
              const hintLetter = hintChars.get(i) || '';
              const inputIdx = type === 'input' ? inputPositions.indexOf(i) : -1;
              const char = isHintBox ? hintLetter : (inputIdx >= 0 ? userPart[inputIdx] || '' : '');
              const isCursor = i === nextInputIdx && !typingDisabled;

              return (
                <div
                  key={i}
                  className="relative flex items-center justify-center select-none"
                  style={{
                    width: 36,
                    height: 44,
                    borderRadius: 8,
                    backgroundColor: isHintBox ? '#EEF2FF' : char ? '#FAFAF9' : '#FFFFFF',
                    border: isCursor
                      ? '2px solid #4F46E5'
                      : isHintBox
                        ? '2px solid #C7D2FE'
                        : char
                          ? '1.5px solid #D1D5DB'
                          : '1.5px dashed #D1D5DB',
                    fontFamily: "'Pretendard Variable', 'Pretendard', monospace",
                    fontSize: 20,
                    fontWeight: 700,
                    color: isHintBox ? '#4F46E5' : '#1A1918',
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
          {!typingDisabled && userPart.length < userSlots && (
            <p className="font-display text-xs text-text-tertiary">
              Enter를 눌러 제출
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes letterBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* Korean sentence with word highlighted in bold */}
      {sentenceKo && (
        <p className="font-display text-[15px] font-normal text-text-secondary text-center mt-1">
          {korean ? highlightKorean(sentenceKo, korean) : sentenceKo}
        </p>
      )}

      {/* TTS button — only for listening mode */}
      {isListenMode && sentenceEn && (
        <button
          onClick={() => speakSentence(sentenceEn)}
          className="flex items-center gap-2 rounded-full bg-accent-indigo-light px-4 py-2 mt-1 active:scale-95 transition-transform"
        >
          <Volume2 className="w-4 h-4 text-accent-indigo" />
          <span className="font-display text-[12px] font-medium text-accent-indigo">문장 듣기</span>
        </button>
      )}
    </div>
  );
});
