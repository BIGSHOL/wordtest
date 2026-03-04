/** grammar_common: 공통 단어 / 나머지와 다른 하나 — 문장 자체가 보기 */
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

      {/* Each sentence is a selectable choice */}
      <div className="space-y-3">
        {allSentences.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(String(i))}
            className={`flex flex-col gap-1.5 w-full px-5 py-4 rounded-xl border text-left transition-colors ${
              selected === String(i)
                ? 'bg-accent-indigo/10 border-accent-indigo'
                : 'bg-white border-border-subtle hover:bg-bg-muted'
            }`}
          >
            <span className={`text-sm font-bold ${
              selected === String(i) ? 'text-accent-indigo' : 'text-text-tertiary'
            }`}>
              {String.fromCharCode(0x2460 + i)}
            </span>
            <p className={`text-[15px] leading-relaxed ${
              selected === String(i) ? 'text-accent-indigo font-semibold' : 'text-text-primary'
            }`}>
              {s.split('___').map((part, j, arr) => (
                <span key={j}>
                  {part}
                  {j < arr.length - 1 && (
                    <span className="inline-block w-16 border-b-2 border-accent-indigo mx-1" />
                  )}
                </span>
              ))}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
