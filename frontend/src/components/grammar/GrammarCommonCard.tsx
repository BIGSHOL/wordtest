/** grammar_common: 공통 단어 / 나머지와 다른 하나 — multiple data variants */
import { renderStem, cleanPrompt } from './grammarUtils';

interface Props {
  data: {
    prompt: string;
    sentences: string[];
    choices?: string[];
    correct_index?: number;
    different_sentences?: string[];
  };
  selected: string | undefined;
  onSelect: (answer: string) => void;
}

export function GrammarCommonCard({ data, selected, onSelect }: Props) {
  const prompt = cleanPrompt(data.prompt);
  const hasChoices = data.choices && data.choices.length > 0;
  const needsTextInput = !hasChoices && /쓰세요/.test(data.prompt);

  // Variant 1: Has separate choices — sentences are context, choices are selectable
  if (hasChoices) {
    return (
      <div className="space-y-5">
        <div className="text-sm font-semibold text-accent-indigo">{prompt}</div>

        {/* Sentences as read-only context */}
        <div className="space-y-3">
          {data.sentences.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-border-subtle px-5 py-4">
              <span className="text-sm font-bold text-text-tertiary">{String.fromCharCode(0x2460 + i)}</span>
              <p className="text-[15px] leading-relaxed text-text-primary mt-1">
                {renderStem(s)}
              </p>
            </div>
          ))}
        </div>

        {/* Selectable choices */}
        <div className="space-y-2">
          {data.choices!.map((choice, i) => (
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
              <span className="text-[15px]">{choice}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Variant 2: No choices, prompt says "쓰세요" — need text input
  if (needsTextInput) {
    return (
      <div className="space-y-5">
        <div className="text-sm font-semibold text-accent-indigo">{prompt}</div>

        {/* Sentences as context */}
        <div className="space-y-3">
          {data.sentences.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-border-subtle px-5 py-4">
              <span className="text-sm font-bold text-text-tertiary">{String.fromCharCode(0x2460 + i)}</span>
              <p className="text-[15px] leading-relaxed text-text-primary mt-1">
                {renderStem(s)}
              </p>
            </div>
          ))}
        </div>

        {/* Text input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">답을 입력하세요</label>
          <input
            type="text"
            value={selected || ''}
            onChange={(e) => onSelect(e.target.value)}
            placeholder="공통으로 들어갈 말을 입력하세요..."
            className="w-full px-4 py-3 rounded-xl border border-border-subtle text-[15px] text-text-primary focus:outline-none focus:border-accent-indigo"
          />
        </div>
      </div>
    );
  }

  // Variant 3: No choices, "고르세요" — sentences ARE the selectable options (original behavior)
  const allSentences = [...data.sentences, ...(data.different_sentences || [])];
  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold text-accent-indigo">{prompt}</div>

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
              {renderStem(s)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
