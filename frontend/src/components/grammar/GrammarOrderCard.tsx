/** grammar_order: 단어 클릭 배열 — 클릭하면 순서대로 배열, 다시 클릭하면 취소 */
import { useState, useEffect, useCallback } from 'react';

interface Props {
  data: {
    words: string[];
    sentence_ko?: string;
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarOrderCard({ data, selected, onSelect }: Props) {
  // ordered: indices of words in the order the student selected them
  const [ordered, setOrdered] = useState<number[]>([]);

  // Sync from external selected prop (e.g., navigating back to question)
  useEffect(() => {
    if (selected && data.words.length > 0) {
      // Try to reconstruct ordered indices from the selected sentence
      const words = selected.split(' ');
      const indices: number[] = [];
      const used = new Set<number>();
      for (const w of words) {
        const idx = data.words.findIndex((dw, i) => dw === w && !used.has(i));
        if (idx !== -1) {
          indices.push(idx);
          used.add(idx);
        }
      }
      if (indices.length > 0) {
        setOrdered(indices);
      }
    } else if (!selected) {
      setOrdered([]);
    }
  }, []); // Only on mount

  const handleWordClick = useCallback((wordIdx: number) => {
    setOrdered((prev) => {
      const pos = prev.indexOf(wordIdx);
      if (pos !== -1) {
        // Already selected → remove it (and everything after it for cleaner UX)
        return prev.slice(0, pos);
      }
      // Add to end
      const next = [...prev, wordIdx];
      // If all words placed, auto-submit the sentence
      if (next.length === data.words.length) {
        const sentence = next.map((i) => data.words[i]).join(' ');
        setTimeout(() => onSelect(sentence), 0);
      }
      return next;
    });
  }, [data.words, onSelect]);

  // Clear a word from the answer area by clicking it there
  const handleAnswerClick = useCallback((posInOrder: number) => {
    setOrdered((prev) => prev.slice(0, posInOrder));
  }, []);

  const usedSet = new Set(ordered);

  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">
        주어진 단어를 올바르게 배열하여 문장을 완성하세요.
      </div>

      {/* Korean hint */}
      {data.sentence_ko && (
        <div className="bg-white rounded-xl border border-border-subtle p-4">
          <p className="text-sm text-text-secondary">{data.sentence_ko}</p>
        </div>
      )}

      {/* Word chips (source) */}
      <div className="flex flex-wrap gap-2">
        {data.words.map((word, i) => {
          const isUsed = usedSet.has(i);
          const orderNum = ordered.indexOf(i);
          return (
            <button
              key={i}
              onClick={() => handleWordClick(i)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                isUsed
                  ? 'bg-gray-100 text-text-tertiary border-gray-200 opacity-40'
                  : 'bg-accent-indigo/10 text-accent-indigo border-accent-indigo/20 hover:bg-accent-indigo/20 cursor-pointer'
              }`}
            >
              {isUsed && orderNum !== -1 && (
                <span className="inline-block w-4 h-4 rounded-full bg-accent-indigo text-white text-[10px] font-bold text-center leading-4 mr-1.5">
                  {orderNum + 1}
                </span>
              )}
              {word}
            </button>
          );
        })}
      </div>

      {/* Answer area — arranged words */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">
          배열된 문장 {ordered.length > 0 && `(${ordered.length}/${data.words.length})`}
        </label>
        <div className="min-h-[52px] px-4 py-3 rounded-xl border border-border-subtle bg-white flex flex-wrap gap-2 items-center">
          {ordered.length === 0 ? (
            <span className="text-sm text-text-tertiary">위의 단어를 순서대로 클릭하세요...</span>
          ) : (
            ordered.map((wordIdx, pos) => (
              <button
                key={pos}
                onClick={() => handleAnswerClick(pos)}
                className="px-3 py-1.5 rounded-lg bg-accent-indigo text-white text-sm font-medium hover:bg-accent-indigo/80 transition-colors"
                title="클릭하면 여기서부터 취소"
              >
                {data.words[wordIdx]}
              </button>
            ))
          )}
        </div>
        {ordered.length > 0 && ordered.length < data.words.length && (
          <p className="text-xs text-text-tertiary">
            모든 단어를 배열하면 자동으로 제출됩니다. 배열된 단어를 클릭하면 취소됩니다.
          </p>
        )}
      </div>
    </div>
  );
}
