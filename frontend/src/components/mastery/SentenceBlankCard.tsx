/**
 * Sentence fill-in-the-blank card for higher-level words.
 * Shows English sentence with ____ and optional Korean translation.
 */
import { memo } from 'react';
import { BookOpen, Volume2 } from 'lucide-react';
import { speakSentence } from '../../utils/tts';

interface SentenceBlankCardProps {
  /** English sentence with ____ replacing the target word */
  sentenceBlank: string;
  /** Korean meaning of the target word */
  korean?: string;
  /** Korean translation of the full sentence */
  sentenceKo?: string;
  /** Full English sentence (for TTS) */
  sentenceEn?: string;
  /** Stage number for prompt text */
  stage: number;
}

const STAGE_PROMPTS: Record<number, string> = {
  1: '빈칸에 들어갈 단어의 뜻은?',
  2: '빈칸에 들어갈 영단어는?',
  3: '문장을 듣고 빈칸의 단어를 입력하세요',
  4: '문장을 듣고 빈칸 단어의 뜻을 고르세요',
  5: '빈칸에 들어갈 영단어를 입력하세요',
};

export const SentenceBlankCard = memo(function SentenceBlankCard({
  sentenceBlank,
  korean,
  sentenceKo,
  sentenceEn,
  stage,
}: SentenceBlankCardProps) {
  // Split sentence around ____ and render with highlight
  const parts = sentenceBlank.split('____');

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-bg-surface px-5 md:px-8 py-8 w-full"
      style={{ borderRadius: 20, boxShadow: '0 4px 24px #1A191812' }}
    >
      {/* Badge */}
      <div className="flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1">
        <BookOpen className="w-3.5 h-3.5 text-violet-500" />
        <span className="font-display text-[11px] font-semibold text-violet-600">예문 문제</span>
      </div>

      {/* Prompt */}
      <p className="font-display text-sm font-medium text-text-tertiary text-center">
        {STAGE_PROMPTS[stage] || '빈칸에 들어갈 단어는?'}
      </p>

      {/* Sentence with blank */}
      <p className="font-word text-[20px] md:text-[22px] font-medium text-text-primary leading-relaxed text-center px-2">
        {parts[0]}
        <span
          className="inline-block min-w-[60px] border-b-[3px] border-accent-indigo mx-1 text-center"
          style={{ borderBottomStyle: 'dashed' }}
        >
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </span>
        {parts[1]}
      </p>

      {/* Korean meaning of the target word */}
      {korean && (
        <p className="font-display text-[17px] font-bold text-accent-indigo text-center mt-1">
          {korean}
        </p>
      )}

      {/* TTS button for sentence */}
      {sentenceEn && (
        <button
          onClick={() => speakSentence(sentenceEn)}
          className="flex items-center gap-2 rounded-full bg-accent-indigo-light px-4 py-2 mt-1"
        >
          <Volume2 className="w-4 h-4 text-accent-indigo" />
          <span className="font-display text-[12px] font-medium text-accent-indigo">문장 듣기</span>
        </button>
      )}
    </div>
  );
});
