/** grammar_common: 공통 단어 / 나머지와 다른 하나 */
interface Props {
  data: {
    prompt: string;
    sentences: string[];
    choices: string[];
    different_sentences?: string[];
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarCommonCard({ data, selected, onSelect }: Props) {
  const allSentences = [...data.sentences, ...(data.different_sentences || [])];

  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">
        {data.prompt}
      </div>

      {/* Sentences with blanks */}
      <div className="bg-white rounded-xl border border-border-subtle p-5 space-y-3">
        {allSentences.map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs font-bold text-text-tertiary mt-0.5 shrink-0">
              {String.fromCharCode(0x2460 + i)}
            </span>
            <p className="text-[15px] leading-relaxed text-text-primary">
              {s.split('___').map((part, j, arr) => (
                <span key={j}>
                  {part}
                  {j < arr.length - 1 && (
                    <span className="inline-block w-16 border-b-2 border-accent-indigo mx-1" />
                  )}
                </span>
              ))}
            </p>
          </div>
        ))}
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
    </div>
  );
}
