/**
 * Sentence fill-in-the-blank card for higher-level words.
 * Shows English sentence with ____ and Korean translation with highlighted word.
 */
import { memo, useRef, useEffect, useCallback } from 'react';
import { BookOpen, Volume2 } from 'lucide-react';
import { speakSentence } from '../../utils/tts';

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

  useEffect(() => {
    if (isTyping && !typingDisabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isTyping, typingDisabled]);

  useEffect(() => {
    if (isTyping && typingValue === '' && !typingDisabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isTyping, typingValue, typingDisabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isListenMode && e.key === '0') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter' && !composingRef.current && (typingValue ?? '').trim().length > 0) {
        e.preventDefault();
        onTypingSubmit?.();
      }
    },
    [typingValue, onTypingSubmit, isListenMode],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (composingRef.current) return;
      onTypingChange?.(e.target.value);
    },
    [onTypingChange],
  );

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

      {/* Sentence with blank or inline input */}
      <p className="font-word text-[20px] md:text-[22px] font-medium text-text-primary leading-relaxed text-center px-2">
        {parts[0]}
        {isTyping ? (
          <span className="inline-flex items-end mx-1">
            {typingHint && (
              <span className="text-[20px] font-bold text-indigo-500 select-none" style={{ fontFamily: 'monospace' }}>
                {typingHint}
              </span>
            )}
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={typingValue ?? ''}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(e) => {
                composingRef.current = false;
                onTypingChange?.((e.target as HTMLInputElement).value);
              }}
              disabled={typingDisabled}
              placeholder="..."
              className="font-word text-[20px] md:text-[22px] font-bold text-accent-indigo placeholder:text-text-tertiary bg-transparent outline-none text-center"
              style={{
                borderBottom: `3px solid ${typingDisabled ? '#D1D5DB' : '#4F46E5'}`,
                borderBottomStyle: (typingValue ?? '') ? 'solid' : 'dashed',
                width: `${Math.max(4, (typingValue ?? '').length + 2)}ch`,
                minWidth: '80px',
              }}
            />
          </span>
        ) : (
          <span
            className="inline-block min-w-[60px] border-b-[3px] border-accent-indigo mx-1 text-center"
            style={{ borderBottomStyle: 'dashed' }}
          >
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        )}
        {parts[1]}
      </p>

      {/* Enter hint */}
      {isTyping && !typingDisabled && (
        <p className="font-display text-xs text-text-tertiary">
          Enter를 눌러 제출
        </p>
      )}

      {/* Korean sentence with word highlighted in bold */}
      {sentenceKo && (
        <p className="font-display text-[15px] font-normal text-text-secondary text-center mt-1">
          {korean ? highlightKorean(sentenceKo, korean) : sentenceKo}
        </p>
      )}

      {/* TTS button for sentence */}
      {sentenceEn && (
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
