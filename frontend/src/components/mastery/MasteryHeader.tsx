/**
 * Mastery session header - reuses QuizHeader rank badge style.
 * Shows level rank badge with dynamic gradient + level change animations.
 * Also shows combo counter for streaks.
 */
import { useEffect, useRef, useState, memo } from 'react';
import {
  ArrowLeft, Shield, Sword, Award, Crown, Gem, Diamond, Star, Flame, Trophy,
} from 'lucide-react';
import { getLevelRank } from '../../types/rank';
import { ComboCounter } from './ComboCounter';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield, sword: Sword, award: Award, crown: Crown,
  gem: Gem, diamond: Diamond, star: Star, flame: Flame, trophy: Trophy,
};

interface MasteryHeaderProps {
  level: number;
  lesson?: string;
  stage: number;
  currentIndex: number;
  totalInBatch: number;
  combo: number;
  onExit: () => void;
}

export const MasteryHeader = memo(function MasteryHeader({
  level,
  lesson,
  stage,
  currentIndex,
  totalInBatch,
  combo,
  onExit,
}: MasteryHeaderProps) {
  const rank = getLevelRank(level);
  const RankIcon = iconMap[rank.icon] || Award;
  const prevLevelRef = useRef(level);
  const [flashDelta, setFlashDelta] = useState(0);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (prevLevelRef.current !== level) {
      setFlashDelta(level - prevLevelRef.current);
      setFlashKey((k) => k + 1);
      prevLevelRef.current = level;
      const timer = setTimeout(() => setFlashDelta(0), 1200);
      return () => clearTimeout(timer);
    }
  }, [level]);

  const isUp = flashDelta > 0;
  const isDown = flashDelta < 0;
  const absDelta = Math.abs(flashDelta);
  const lessonNum = lesson ? parseInt(lesson.replace(/\D/g, ''), 10) || 1 : 1;

  // Scale effect by magnitude
  const badgeScale = isUp
    ? absDelta >= 3 ? 1.25 : absDelta >= 2 ? 1.15 : 1.1
    : isDown
    ? absDelta >= 3 ? 0.8 : absDelta >= 2 ? 0.85 : 0.95
    : 1;
  const ringWidth = flashDelta !== 0
    ? absDelta >= 3 ? 4 : absDelta >= 2 ? 3 : 2
    : 0;
  const ringColor = isUp ? '#22C55E' : '#EF4444';
  const glowSize = flashDelta !== 0 ? 8 + absDelta * 6 : 8;
  const glowColor = isUp
    ? `${rank.colors[0]}${absDelta >= 3 ? 'A0' : '60'}`
    : isDown
    ? `#EF4444${absDelta >= 3 ? 'A0' : absDelta >= 2 ? '80' : '60'}`
    : `${rank.colors[0]}30`;

  return (
    <>
      <style>{`
        @keyframes mastery-float-up {
          0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) translateY(-16px) scale(1.1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.8); }
        }
        @keyframes mastery-float-down {
          0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) translateY(10px) scale(1.1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(24px) scale(0.8); }
        }
        @keyframes mastery-ping-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes mastery-shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-3px) rotate(-1deg); }
          30% { transform: translateX(3px) rotate(1deg); }
          45% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
          75% { transform: translateX(-1px); }
        }
      `}</style>
      <div className="flex items-center justify-between h-14 px-5 md:h-[60px] md:px-8 lg:h-16 lg:px-12 w-full">
        {/* Left: back button */}
        <button
          onClick={onExit}
          className="w-10 h-10 rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-[22px] h-[22px] text-text-primary" />
        </button>

        {/* Center: rank badge + combo */}
        <div className="flex items-center gap-2">
          <div className="relative">
            {/* Badge */}
            <div
              className="flex items-center gap-[5px] rounded-full px-3.5 py-[5px] transition-all duration-300"
              style={{
                transform: `scale(${badgeScale})`,
                outline: ringWidth ? `${ringWidth}px solid ${ringColor}` : undefined,
                outlineOffset: '2px',
                borderRadius: '9999px',
                background: `linear-gradient(90deg, ${rank.colors[0]}, ${rank.colors[1]})`,
                boxShadow: `0 0 ${glowSize}px ${glowColor}`,
                animation: absDelta >= 3 && flashDelta !== 0 ? `mastery-shake ${isDown ? '0.5s' : '0.4s'} ease-in-out` : undefined,
              }}
            >
              <RankIcon className="w-3.5 h-3.5 text-white" />
              <span className="font-display text-[13px] font-bold text-white">
                {rank.name} {level}-{lessonNum}
              </span>
            </div>

            {/* Floating delta indicator */}
            {flashDelta !== 0 && (
              <span
                key={flashKey}
                className="absolute left-1/2 font-display font-bold pointer-events-none whitespace-nowrap select-none"
                style={{
                  top: isUp ? '-2px' : '100%',
                  color: isUp ? '#22C55E' : '#EF4444',
                  fontSize: absDelta >= 3 ? '16px' : absDelta >= 2 ? '14px' : '12px',
                  animation: `${isUp ? 'mastery-float-up' : 'mastery-float-down'} ${absDelta >= 3 ? '1s' : '0.8s'} ease-out forwards`,
                  textShadow: absDelta >= 2 ? '0 0 8px currentColor' : undefined,
                }}
              >
                {isUp
                  ? absDelta >= 3 ? '▲▲▲' : absDelta >= 2 ? '▲▲' : '▲'
                  : absDelta >= 3 ? '▼▼▼' : absDelta >= 2 ? '▼▼' : '▼'}
              </span>
            )}

            {/* Ping ring effect for big level changes */}
            {absDelta >= 2 && flashDelta !== 0 && (
              <div
                key={`ping-${flashKey}`}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: isUp
                    ? `linear-gradient(90deg, ${rank.colors[0]}40, ${rank.colors[1]}40)`
                    : 'rgba(239,68,68,0.25)',
                  animation: `mastery-ping-ring ${absDelta >= 3 ? '0.5s' : '0.7s'} ease-out forwards`,
                  animationIterationCount: absDelta >= 3 ? 2 : 1,
                }}
              />
            )}
          </div>

          {combo >= 2 && <ComboCounter combo={combo} />}
        </div>

        {/* Right: stage + counter */}
        <div className="flex items-center gap-3">
          <span className="font-display text-xs font-medium text-text-tertiary bg-bg-muted rounded-full px-2.5 py-1">
            {stage}단계
          </span>
          <span className="font-display text-[15px] font-semibold text-text-secondary">
            {currentIndex + 1} / {totalInBatch}
          </span>
        </div>
      </div>
    </>
  );
});
