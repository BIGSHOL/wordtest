/**
 * Answer choice card component.
 */
interface AnswerCardProps {
  text: string;
  index: number;
  selected: boolean;
  correct: boolean | null; // null = not revealed, true/false = revealed
  disabled: boolean;
  onClick: () => void;
}

const labels = ['A', 'B', 'C', 'D'];

export function AnswerCard({ text, index, selected, correct, disabled, onClick }: AnswerCardProps) {
  let classes = 'w-full p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-3';

  if (correct === null) {
    // Not yet revealed
    classes += selected
      ? ' border-primary bg-primary-light'
      : ' border-[#E2E8F0] bg-surface hover:border-primary/40 hover:bg-primary-light/50';
  } else if (correct) {
    // Correct answer
    classes += ' border-correct bg-correct/10';
  } else if (selected) {
    // Wrong selected answer
    classes += ' border-wrong bg-wrong/10';
  } else {
    classes += ' border-[#E2E8F0] bg-surface opacity-50';
  }

  if (disabled) {
    classes += ' cursor-default';
  } else {
    classes += ' cursor-pointer';
  }

  return (
    <button className={classes} onClick={onClick} disabled={disabled}>
      <span className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-sm font-bold text-text-secondary shrink-0">
        {labels[index]}
      </span>
      <span className="text-base font-medium text-text-primary">{text}</span>
    </button>
  );
}
