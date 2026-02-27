/**
 * QuestionNavigator - two-row horizontal scrollable bar with progress indicator.
 * Splits questions into exactly 2 rows for compact display.
 */
import { memo, useEffect, useRef, useMemo } from 'react';

interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  answeredIndexes: Set<number>;
  onNavigate: (index: number) => void;
}

export const QuestionNavigator = memo(function QuestionNavigator({
  totalQuestions,
  currentIndex,
  answeredIndexes,
  onNavigate,
}: QuestionNavigatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const half = Math.ceil(totalQuestions / 2);
  const row1 = useMemo(() => Array.from({ length: half }, (_, i) => i), [half]);
  const row2 = useMemo(() => Array.from({ length: totalQuestions - half }, (_, i) => half + i), [half, totalQuestions]);

  // Auto-scroll to keep current question visible (horizontal)
  useEffect(() => {
    const btn = buttonRefs.current[currentIndex];
    const container = containerRef.current;
    if (!btn || !container) return;

    const btnLeft = btn.offsetLeft;
    const btnRight = btnLeft + btn.offsetWidth;
    const scrollLeft = container.scrollLeft;
    const viewWidth = container.clientWidth;

    if (btnLeft < scrollLeft + 16) {
      container.scrollTo({ left: btnLeft - 16, behavior: 'smooth' });
    } else if (btnRight > scrollLeft + viewWidth - 16) {
      container.scrollTo({ left: btnRight - viewWidth + 16, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const answeredCount = answeredIndexes.size;
  const progress = totalQuestions > 0 ? answeredCount / totalQuestions : 0;

  const renderButton = (i: number) => {
    const isAnswered = answeredIndexes.has(i);
    const isCurrent = i === currentIndex;

    let bg = '#F0EFED';
    let textColor = '#9C9B99';
    let border = 'transparent';
    let fontWeight = 500;

    if (isAnswered) {
      bg = '#4F46E5';
      textColor = '#FFFFFF';
    }
    if (isCurrent) {
      border = '#4F46E5';
      fontWeight = 700;
      if (!isAnswered) {
        bg = '#EEF2FF';
        textColor = '#4F46E5';
      }
    }

    return (
      <button
        key={i}
        ref={el => { buttonRefs.current[i] = el; }}
        onClick={() => onNavigate(i)}
        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-all duration-150"
        style={{
          background: bg,
          color: textColor,
          border: `2px solid ${border}`,
          fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif",
          fontSize: 10,
          fontWeight,
        }}
      >
        {i + 1}
      </button>
    );
  };

  return (
    <div className="w-full">
      {/* Progress bar + count */}
      <div className="flex items-center gap-2.5 px-4 pt-2 pb-1">
        <div
          className="flex-1 h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: '#EDECEA' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%`, backgroundColor: '#4F46E5' }}
          />
        </div>
        <span
          className="text-[11px] font-semibold shrink-0"
          style={{
            color: '#9C9B99',
            fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif",
          }}
        >
          {answeredCount}/{totalQuestions}
        </span>
      </div>

      {/* Two-row horizontal scroll */}
      <div
        ref={containerRef}
        className="overflow-x-auto px-4 pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex flex-col gap-[3px] min-w-max mx-auto">
          <div className="flex gap-[3px]">
            {row1.map(renderButton)}
          </div>
          <div className="flex gap-[3px]">
            {row2.map(renderButton)}
          </div>
        </div>
      </div>
    </div>
  );
});
