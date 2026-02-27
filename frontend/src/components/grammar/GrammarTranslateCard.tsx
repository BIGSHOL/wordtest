/** grammar_translate: 영작 (서술형) */
interface Props {
  data: {
    sentence_ko: string;
    hint_words?: string[];
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarTranslateCard({ data, selected, onSelect }: Props) {
  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">
        다음 우리말을 영어로 옮기세요.
      </div>

      {/* Korean sentence */}
      <div className="bg-white rounded-xl border border-border-subtle p-5">
        <p className="text-[17px] leading-relaxed text-text-primary font-medium">
          {data.sentence_ko}
        </p>
      </div>

      {/* Hint words */}
      {data.hint_words && data.hint_words.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-tertiary">힌트 단어</p>
          <div className="flex flex-wrap gap-2">
            {data.hint_words.map((word, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-lg bg-teal/10 text-teal font-medium text-sm border border-teal/20"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">영어 문장을 입력하세요</label>
        <textarea
          value={selected || ''}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="영어로 번역하여 입력하세요..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-border-subtle text-[15px] text-text-primary focus:outline-none focus:border-accent-indigo resize-none"
        />
      </div>
    </div>
  );
}
