/** grammar_order: 단어 배열 (서술형) */
interface Props {
  data: {
    words: string[];
    sentence_ko?: string;
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarOrderCard({ data, selected, onSelect }: Props) {
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

      {/* Word chips */}
      <div className="flex flex-wrap gap-2">
        {data.words.map((word, i) => (
          <span
            key={i}
            className="px-4 py-2 rounded-xl bg-accent-indigo/10 text-accent-indigo font-semibold text-sm border border-accent-indigo/20"
          >
            {word}
          </span>
        ))}
      </div>

      {/* Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">문장을 입력하세요</label>
        <textarea
          value={selected || ''}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="단어를 올바른 순서로 배열하여 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-border-subtle text-[15px] text-text-primary focus:outline-none focus:border-accent-indigo resize-none"
        />
      </div>
    </div>
  );
}
