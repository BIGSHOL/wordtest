/** grammar_transform: 문장 전환 (서술형) */
interface Props {
  data: {
    original: string;
    instruction: string;
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarTransformCard({ data, selected, onSelect }: Props) {
  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">
        다음 문장을 지시대로 바꿔 쓰세요.
      </div>

      {/* Original sentence */}
      <div className="bg-white rounded-xl border border-border-subtle p-5 space-y-3">
        <p className="text-[17px] leading-relaxed text-text-primary font-medium">
          {data.original}
        </p>
        <div className="inline-block px-3 py-1 rounded-lg bg-amber-50 border border-amber-200">
          <span className="text-sm font-semibold text-amber-700">{data.instruction}</span>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">답을 입력하세요</label>
        <textarea
          value={selected || ''}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="영문으로 답을 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-border-subtle text-[15px] text-text-primary focus:outline-none focus:border-accent-indigo resize-none"
        />
      </div>
    </div>
  );
}
