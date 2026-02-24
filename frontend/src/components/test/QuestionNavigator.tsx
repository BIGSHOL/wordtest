/**
 * QuestionNavigator - horizontal scrollable bar of numbered circle buttons.
 * Shows answered/unanswered/current state for each question.
 */
import { memo, useEffect, useRef } from 'react';

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

  // Auto-scroll to keep current question visible
  useEffect(() => {
    const btn = buttonRefs.current[currentIndex];
    const container = containerRef.current;
    if (!btn || !container) return;

    const btnLeft = btn.offsetLeft;
    const btnRight = btnLeft + btn.offsetWidth;
    const containerScrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;

    if (btnLeft < containerScrollLeft + 16) {
      container.scrollTo({ left: btnLeft - 16, behavior: 'smooth' });
    } else if (btnRight > containerScrollLeft + containerWidth - 16) {
      container.scrollTo({ left: btnRight - containerWidth + 16, behavior: 'smooth' });
    }
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto py-2 px-4"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="flex gap-1.5 min-w-max">
        {Array.from({ length: totalQuestions }, (_, i) => {
          const isAnswered = answeredIndexes.has(i);
          const isCurrent = i === currentIndex;

          let bg = '#EDECEA';
          let textColor = '#6D6C6A';
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
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-150"
              style={{
                background: bg,
                color: textColor,
                border: `2px solid ${border}`,
                fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif",
                fontSize: 12,
                fontWeight,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
});
