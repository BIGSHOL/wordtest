import { memo, useState } from 'react';

/**
 * Convert an emoji character to a Google Noto Emoji SVG URL via jsDelivr CDN.
 *
 * Examples:
 *   🐕 (U+1F415)           → emoji_u1f415.svg
 *   👨‍🍳 (U+1F468 U+200D U+1F373) → emoji_u1f468_200d_1f373.svg
 *   ☀️ (U+2600 U+FE0F)     → emoji_u2600.svg  (FE0F stripped)
 */
function emojiToNotoUrl(emoji: string): string | null {
  if (!emoji) return null;
  try {
    const codepoints = [...emoji]
      .map((c) => c.codePointAt(0)!)
      .filter((cp) => cp !== 0xfe0f) // Strip variation selector-16
      .map((cp) => cp.toString(16).padStart(4, '0'));
    if (codepoints.length === 0) return null;
    return `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/svg/emoji_u${codepoints.join('_')}.svg`;
  } catch {
    return null;
  }
}

interface EmojiCardProps {
  emoji: string;
  prompt?: string;
}

export const EmojiCard = memo(function EmojiCard({ emoji, prompt }: EmojiCardProps) {
  const [svgFailed, setSvgFailed] = useState(false);
  const notoUrl = emojiToNotoUrl(emoji);

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-8 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-sm font-medium text-text-tertiary">
        {prompt || '이모지에 해당하는 영단어를 고르시오'}
      </p>
      <div
        className="flex items-center justify-center"
        style={{ minHeight: 140 }}
      >
        {notoUrl && !svgFailed ? (
          <img
            src={notoUrl}
            alt={emoji}
            width={120}
            height={120}
            style={{ width: 120, height: 120 }}
            onError={() => setSvgFailed(true)}
            draggable={false}
          />
        ) : (
          <span style={{ fontSize: 120, lineHeight: 1.1 }}>{emoji}</span>
        )}
      </div>
    </div>
  );
});
