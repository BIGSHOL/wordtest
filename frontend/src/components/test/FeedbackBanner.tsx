import { memo } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';

interface FeedbackBannerProps {
  isCorrect: boolean;
  correctAnswer?: string;
}

export const FeedbackBanner = memo(function FeedbackBanner({ isCorrect, correctAnswer }: FeedbackBannerProps) {
  if (isCorrect) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl bg-correct-light px-5 py-3.5 w-full">
        <CircleCheck className="w-[22px] h-[22px] text-correct shrink-0" />
        <span className="font-display text-[15px] font-semibold" style={{ color: '#065F46' }}>
          정답입니다! 잘했어요 🎉
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-wrong-light px-5 py-3.5 w-full">
      <CircleX className="w-[22px] h-[22px] text-wrong shrink-0" />
      <span className="font-display text-sm font-semibold" style={{ color: '#991B1B' }}>
        아쉬워요! 정답은 &lsquo;{correctAnswer}&rsquo; 입니다
      </span>
    </div>
  );
});
