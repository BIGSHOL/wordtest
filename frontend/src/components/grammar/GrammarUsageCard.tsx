/** grammar_usage: 밑줄 친 부분의 쓰임이 다른 것 */
import { renderLines, cleanPrompt } from './grammarUtils';

interface Props {
  data: {
    prompt: string;
    sentences: string[];
    underlined_word?: string;
    choices?: string[];
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarUsageCard({ data, selected, onSelect }: Props) {
  const prompt = cleanPrompt(data.prompt);

  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">
        {prompt}
      </div>

      {/* 보기 (reference choices like ⓐ ~할 수 있다) */}
      {data.choices && data.choices.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-border-subtle px-5 py-4">
          <div className="text-xs font-bold text-text-tertiary mb-2">&lt;보기&gt;</div>
          <div className="space-y-1">
            {data.choices.map((choice, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-text-primary">
                {choice}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data.sentences.map((sentence, i) => (
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
            <span className="text-[15px] leading-relaxed">{renderLines(sentence)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
