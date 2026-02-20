import { memo } from 'react';

interface EmojiCardProps {
  emoji: string;
}

export const EmojiCard = memo(function EmojiCard({ emoji }: EmojiCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-8 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-sm font-medium text-text-tertiary">
        다음 이모지에 해당하는 영단어는?
      </p>
      <div
        className="flex items-center justify-center"
        style={{ fontSize: 120, lineHeight: 1.1, minHeight: 140 }}
      >
        {emoji}
      </div>
    </div>
  );
});
