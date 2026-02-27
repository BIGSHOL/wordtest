/** grammar_error: 오류/올바른 문장 탐지 (복수 선택 지원) */
interface Props {
  data: {
    prompt: string;
    sentences: string[];
    select_count: number;
    invert?: boolean;
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarErrorCard({ data, selected, onSelect }: Props) {
  const selectedSet = new Set(selected ? selected.split(',') : []);
  const isMulti = data.select_count > 1;

  const toggle = (idx: number) => {
    const idxStr = String(idx);
    const next = new Set(selectedSet);
    if (next.has(idxStr)) {
      next.delete(idxStr);
    } else {
      if (!isMulti) {
        next.clear();
      }
      next.add(idxStr);
    }
    onSelect(Array.from(next).sort().join(','));
  };

  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">
        {data.prompt}
        {isMulti && (
          <span className="text-xs text-text-tertiary ml-2">({data.select_count}개 선택)</span>
        )}
      </div>

      <div className="space-y-2">
        {data.sentences.map((sentence, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-colors ${
              selectedSet.has(String(i))
                ? 'bg-accent-indigo/10 border-accent-indigo text-accent-indigo font-semibold'
                : 'bg-white border-border-subtle hover:bg-bg-muted text-text-primary'
            }`}
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              selectedSet.has(String(i)) ? 'bg-accent-indigo text-white' : 'bg-gray-100 text-text-tertiary'
            }`}>
              {String.fromCharCode(0x2460 + i)}
            </span>
            <span className="text-[15px] leading-relaxed">{sentence}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
