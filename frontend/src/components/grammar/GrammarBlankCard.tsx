/** grammar_blank: 빈칸 5지선다 */
interface Props {
  data: {
    stem: string;
    choices: string[];
    sentence_ko?: string;
    grammar_point?: string;
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarBlankCard({ data, selected, onSelect }: Props) {
  return (
    <div className="space-y-5">
      {/* Prompt */}
      <div className="text-sm font-semibold text-accent-indigo">
        다음 빈칸에 들어갈 알맞은 말을 고르세요.
      </div>

      {/* Stem */}
      <div className="bg-white rounded-xl border border-border-subtle p-5">
        <p className="text-[17px] leading-relaxed text-text-primary font-medium">
          {data.stem.split('___').map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <span className="inline-block w-20 border-b-2 border-accent-indigo mx-1" />
              )}
            </span>
          ))}
        </p>
        {data.sentence_ko && (
          <p className="text-sm text-text-tertiary mt-2">{data.sentence_ko}</p>
        )}
      </div>

      {/* Choices */}
      <div className="space-y-2">
        {data.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => onSelect(String(i))}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-colors ${
              selected === String(i)
                ? 'bg-accent-indigo/10 border-accent-indigo text-accent-indigo font-semibold'
                : 'bg-white border-border-subtle hover:bg-bg-muted text-text-primary'
            }`}
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              selected === String(i) ? 'bg-accent-indigo text-white' : 'bg-gray-100 text-text-tertiary'
            }`}>
              {String.fromCharCode(0x2460 + i)}
            </span>
            <span className="text-[15px]">{choice}</span>
          </button>
        ))}
      </div>

      {data.grammar_point && (
        <p className="text-xs text-text-tertiary">{data.grammar_point}</p>
      )}
    </div>
  );
}
