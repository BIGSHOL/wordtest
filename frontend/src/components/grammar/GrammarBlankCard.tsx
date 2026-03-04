/** grammar_blank: 빈칸 5지선다 — 다중 빈칸 순차 선택 + 미리보기 지원 */
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { cleanPrompt } from './grammarUtils';

interface Props {
  data: {
    stem: string;
    choices: string[];
    sentence_ko?: string;
    grammar_point?: string;
    prompt?: string;
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

/** Count ___ blanks in stem */
function countBlanks(stem: string): number {
  const cleaned = stem.replace(/\[([^\]]+\/[^\]]+)\]/g, '___');
  const matches = cleaned.match(/___/g);
  return matches ? matches.length : 1;
}

/** Render stem with selected answers filled into blanks */
function renderStemWithFills(
  stem: string,
  selections: (number | null)[],
  choices: string[],
): ReactNode {
  // Replace [opt/opt] bracket notation with ___
  const cleaned = stem.replace(/\[([^\]]+\/[^\]]+)\]/g, '___');
  const lines = cleaned.split('\n');
  let blankIdx = 0;

  return lines.map((line, lineIdx) => {
    const parts = line.split('___');
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {parts.map((part, j) => {
          const isLast = j === parts.length - 1;
          const curBlank = blankIdx;
          if (!isLast) blankIdx++;

          return (
            <span key={j}>
              {part}
              {!isLast && (
                selections[curBlank] !== null ? (
                  <span className="inline-block px-2 py-0.5 mx-1 rounded-lg bg-accent-indigo/15 text-accent-indigo font-bold border-b-2 border-accent-indigo">
                    {choices[selections[curBlank]!]}
                  </span>
                ) : (
                  <span className="inline-block w-20 border-b-2 border-accent-indigo mx-1" />
                )
              )}
            </span>
          );
        })}
      </span>
    );
  });
}

export function GrammarBlankCard({ data, selected, onSelect }: Props) {
  const blankCount = countBlanks(data.stem);
  const isMultiBlank = blankCount > 1;

  // Internal selections state for multi-blank (array of choice indices)
  const [selections, setSelections] = useState<(number | null)[]>(() =>
    Array(blankCount).fill(null),
  );

  // Sync selections from external `selected` prop (e.g., navigating back)
  useEffect(() => {
    if (selected && isMultiBlank) {
      const indices = selected.split(',').map((s) => (s === '' ? null : Number(s)));
      if (indices.length === blankCount) {
        setSelections(indices);
      }
    } else if (!selected && isMultiBlank) {
      setSelections(Array(blankCount).fill(null));
    }
  }, [selected, blankCount, isMultiBlank]);

  // For single blank: derive "selection" from `selected` prop
  const singleSelected = !isMultiBlank && selected != null ? [Number(selected)] : !isMultiBlank ? [null] : [];

  const displaySelections = isMultiBlank ? selections : singleSelected as (number | null)[];

  // Check if a choice index is selected (in any blank)
  const getBlankForChoice = useCallback(
    (choiceIdx: number): number | null => {
      const pos = displaySelections.indexOf(choiceIdx);
      return pos !== -1 ? pos : null;
    },
    [displaySelections],
  );

  const handleClick = useCallback(
    (choiceIdx: number) => {
      if (isMultiBlank) {
        setSelections((prev) => {
          const next = [...prev];
          // If already selected, deselect it
          const existingPos = next.indexOf(choiceIdx);
          if (existingPos !== -1) {
            next[existingPos] = null;
            return next;
          }
          // Find first empty blank and fill it
          const emptyPos = next.indexOf(null);
          if (emptyPos !== -1) {
            next[emptyPos] = choiceIdx;
          }
          // If all blanks filled, submit
          if (next.every((s) => s !== null)) {
            // Use setTimeout to let state update first
            setTimeout(() => onSelect(next.join(',')), 0);
          }
          return next;
        });
      } else {
        // Single blank: toggle or select
        if (selected === String(choiceIdx)) {
          // Can't "deselect" in single mode since onSelect already submitted
          return;
        }
        onSelect(String(choiceIdx));
      }
    },
    [isMultiBlank, onSelect, selected],
  );

  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">
        {cleanPrompt(data.prompt || '다음 빈칸에 들어갈 알맞은 말을 고르세요.')}
      </div>

      <div className="bg-white rounded-xl border border-border-subtle p-5">
        <p className="text-[17px] leading-relaxed text-text-primary font-medium">
          {renderStemWithFills(data.stem, displaySelections, data.choices)}
        </p>
        {data.sentence_ko && (
          <p className="text-sm text-text-tertiary mt-2">{data.sentence_ko}</p>
        )}
      </div>

      {isMultiBlank && (
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <span className="bg-accent-indigo/10 text-accent-indigo px-2 py-0.5 rounded-full font-medium">
            빈칸 {blankCount}개
          </span>
          <span>순서대로 선택하세요. 다시 클릭하면 취소됩니다.</span>
        </div>
      )}

      <div className="space-y-2">
        {data.choices.map((choice, i) => {
          const blankPos = getBlankForChoice(i);
          const isSelected = isMultiBlank ? blankPos !== null : selected === String(i);

          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-colors ${
                isSelected
                  ? 'bg-accent-indigo/10 border-accent-indigo text-accent-indigo font-semibold'
                  : 'bg-white border-border-subtle hover:bg-bg-muted text-text-primary'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isSelected ? 'bg-accent-indigo text-white' : 'bg-gray-100 text-text-tertiary'
                }`}
              >
                {isSelected && isMultiBlank && blankPos !== null
                  ? blankPos + 1
                  : String.fromCharCode(0x2460 + i)}
              </span>
              <span className="text-[15px]">{choice}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
