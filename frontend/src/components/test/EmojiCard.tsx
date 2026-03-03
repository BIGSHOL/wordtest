import { memo } from 'react';

interface EmojiCardProps {
  emoji: string;
  prompt?: string;
}

export const EmojiCard = memo(function EmojiCard({ emoji, prompt }: EmojiCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-8 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-sm font-medium text-text-tertiary">
        {prompt || '\uC774\uBAA8\uC9C0\uC5D0 \uD574\uB2F9\uD558\uB294 \uC601\uB2E8\uC5B4\uB97C \uACE0\uB974\uC2DC\uC624'}
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
