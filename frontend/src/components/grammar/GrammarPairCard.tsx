/** grammar_pair: (A)(B) 짝짓기 */
interface Props {
  data: {
    stem: string;
    paired_choices: string[][];
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarPairCard({ data, selected, onSelect }: Props) {
  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">
        (A), (B)에 들어갈 말이 바르게 짝지어진 것을 고르세요.
      </div>

      {/* Stem with (A), (B) highlighted */}
      <div className="bg-white rounded-xl border border-border-subtle p-5">
        <p className="text-[17px] leading-relaxed text-text-primary font-medium">
          {data.stem.split(/(\(A\)|\(B\))/).map((part, i) => {
            if (part === '(A)' || part === '(B)') {
              return (
                <span
                  key={i}
                  className="inline-block px-2 py-0.5 mx-1 rounded bg-accent-indigo/10 text-accent-indigo font-bold text-sm"
                >
                  {part}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      </div>

      {/* Paired choices */}
      <div className="space-y-2">
        {data.paired_choices.map((pair, i) => (
          <button
            key={i}
            onClick={() => onSelect(String(i))}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition-colors ${
              selected === String(i)
                ? 'bg-accent-indigo/10 border-accent-indigo text-accent-indigo font-semibold'
                : 'bg-white border-border-subtle hover:bg-bg-muted text-text-primary'
            }`}
          >
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              selected === String(i) ? 'bg-accent-indigo text-white' : 'bg-gray-100 text-text-tertiary'
            }`}>
              {String.fromCharCode(0x2460 + i)}
            </span>
            <span className="text-[15px]">
              {pair.map((word, j) => (
                <span key={j}>
                  {j > 0 && ' — '}
                  {word}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
