import { memo } from 'react';

interface MeaningCardProps {
  korean: string;
}

export const MeaningCard = memo(function MeaningCard({ korean }: MeaningCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-10 w-full"
      style={{
        borderRadius: 20,
        boxShadow: '0 4px 24px #1A191812',
      }}
    >
      <p className="font-display text-sm font-medium text-text-tertiary">
        다음 뜻에 해당하는 영단어는?
      </p>
      <h2 className="font-display text-[32px] md:text-[36px] font-bold text-text-primary leading-snug text-center">
        {korean}
      </h2>
    </div>
  );
});
