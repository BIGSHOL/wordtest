import { memo } from 'react';

type ChoiceState = 'default' | 'selected' | 'correct' | 'wrong' | 'disabled';

interface ChoiceButtonProps {
  index: number;
  text: string;
  state: ChoiceState;
  onClick: () => void;
}

const stateStyles: Record<ChoiceState, {
  bg: string;
  border: string;
  borderWidth: number;
  numBg: string;
  numText: string;
  textColor: string;
  opacity: number;
  shadow: string;
}> = {
  default: {
    bg: '#FFFFFF',
    border: '#E5E4E1',
    borderWidth: 1.5,
    numBg: '#EDECEA',
    numText: '#6D6C6A',
    textColor: '#1A1918',
    opacity: 1,
    shadow: '0 2px 8px #1A191808',
  },
  selected: {
    bg: '#EEF2FF',
    border: '#4F46E5',
    borderWidth: 2,
    numBg: '#4F46E5',
    numText: '#FFFFFF',
    textColor: '#4F46E5',
    opacity: 1,
    shadow: '0 2px 12px #4F46E520',
  },
  correct: {
    bg: '#D1FAE5',
    border: '#10B981',
    borderWidth: 2,
    numBg: '#10B981',
    numText: '#FFFFFF',
    textColor: '#065F46',
    opacity: 1,
    shadow: '0 2px 12px #10B98120',
  },
  wrong: {
    bg: '#FEE2E2',
    border: '#EF4444',
    borderWidth: 2,
    numBg: '#EF4444',
    numText: '#FFFFFF',
    textColor: '#991B1B',
    opacity: 1,
    shadow: '0 2px 12px #EF444420',
  },
  disabled: {
    bg: '#FFFFFF',
    border: '#E5E4E1',
    borderWidth: 1.5,
    numBg: '#EDECEA',
    numText: '#6D6C6A',
    textColor: '#1A1918',
    opacity: 0.4,
    shadow: '0 2px 8px #1A191808',
  },
};

export const ChoiceButton = memo(function ChoiceButton({ index, text, state, onClick }: ChoiceButtonProps) {
  const s = stateStyles[state];
  const isDisabled = state === 'disabled' || state === 'correct' || state === 'wrong';

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className="flex items-center gap-3 w-full h-14 md:h-[60px] px-5 rounded-2xl transition-all duration-200"
      style={{
        background: s.bg,
        border: `${s.borderWidth}px solid ${s.border}`,
        opacity: s.opacity,
        boxShadow: s.shadow,
        cursor: isDisabled ? 'default' : 'pointer',
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: s.numBg }}
      >
        <span className="font-display text-xs font-bold" style={{ color: s.numText }}>
          {index + 1}
        </span>
      </div>
      <span
        className="text-[16px]"
        style={{
          color: s.textColor,
          fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif",
          fontWeight: state === 'correct' || state === 'wrong' ? 600 : 500,
        }}
      >
        {text}
      </span>
    </button>
  );
});
