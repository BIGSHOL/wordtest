import { CircleX } from 'lucide-react';

interface WrongWordCardProps {
  english: string;
  correctAnswer: string;
}

export function WrongWordCard({ english, correctAnswer }: WrongWordCardProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-[14px] bg-bg-surface p-4 px-[18px] md:px-5 w-full"
      style={{
        border: '1px solid #E5E4E1',
        boxShadow: '0 1px 6px #1A191806',
      }}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-wrong" />
          <span className="font-word text-base font-bold text-text-primary">
            {english}
          </span>
        </div>
        <CircleX className="w-5 h-5 text-wrong" />
      </div>
      <div className="flex items-center gap-2 w-full">
        <span className="font-display text-[13px] font-medium text-text-tertiary">정답:</span>
        <span className="font-display text-sm font-semibold text-correct">{correctAnswer}</span>
      </div>
    </div>
  );
}
