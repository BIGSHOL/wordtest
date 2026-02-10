import { Volume2 } from 'lucide-react';

interface SentenceCardProps {
  sentenceBefore: string;
  sentenceAfter: string;
  blankText?: string;
}

export function SentenceCard({ sentenceBefore, sentenceAfter, blankText }: SentenceCardProps) {
  const speak = () => {
    const text = sentenceBefore + (blankText || '___') + sentenceAfter;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-bg-surface px-6 py-8 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-sm font-medium text-text-tertiary">
        빈칸에 알맞은 단어를 고르세요
      </p>
      <div className="flex items-center justify-center flex-wrap w-full">
        <span className="font-word text-[22px] font-medium text-text-primary" style={{ lineHeight: 1.6 }}>
          {sentenceBefore}
        </span>
        <span
          className="inline-flex items-center justify-center h-9 min-w-[100px] rounded-lg bg-accent-indigo-light border-2 border-accent-indigo mx-1"
        >
          <span className="font-word text-sm font-bold text-accent-indigo">
            {blankText || '?'}
          </span>
        </span>
        <span className="font-word text-[22px] font-medium text-text-primary" style={{ lineHeight: 1.6 }}>
          {sentenceAfter}
        </span>
      </div>
      <button
        onClick={speak}
        className="flex items-center gap-2 rounded-full bg-accent-indigo-light px-5 py-2.5"
      >
        <Volume2 className="w-[18px] h-[18px] text-accent-indigo" />
        <span className="font-display text-[13px] font-medium text-accent-indigo">예문 듣기</span>
      </button>
    </div>
  );
}
