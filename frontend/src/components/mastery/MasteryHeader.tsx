/**
 * Mastery session header - adaptive level display with XP bar.
 * Shows rank badge with gradient + level change animations + XP progress.
 * Cartoon-style XP popup with base/speed/combo breakdown.
 */
import { useEffect, useRef, useState, memo } from 'react';
import {
  ArrowLeft, Shield, Sword, Award, Crown, Gem, Diamond, Star, Flame, Trophy,
} from 'lucide-react';
import { getLevelRank } from '../../types/rank';
import { ComboCounter } from './ComboCounter';
import type { XpBreakdown } from '../../stores/masteryStore';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield, sword: Sword, award: Award, crown: Crown,
  gem: Gem, diamond: Diamond, star: Star, flame: Flame, trophy: Trophy,
};

interface MasteryHeaderProps {
  level: number;          // rank (1-10)
  currentIndex: number;
  totalInBatch: number;
  combo: number;
  xp: number;             // current XP in this lesson
  lessonXp: number;        // XP needed for this lesson
  levelLabel: string;      // "1-3" format
  lastXpChange: number;    // XP change from last answer
  lastXpBreakdown: XpBreakdown | null;
  onExit: () => void;
}

export const MasteryHeader = memo(function MasteryHeader({
  level,
  currentIndex,
  totalInBatch,
  combo,
  xp,
  lessonXp,
  levelLabel,
  lastXpChange,
  lastXpBreakdown,
  onExit,
}: MasteryHeaderProps) {
  const rank = getLevelRank(level);
  const RankIcon = iconMap[rank.icon] || Award;
  const prevLevelRef = useRef(level);
  const [flashDelta, setFlashDelta] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [xpPopup, setXpPopup] = useState<{ breakdown: XpBreakdown; key: number } | null>(null);
  const xpPopupCounter = useRef(0);

  // XP popup effect
  const prevXpChangeRef = useRef(0);
  useEffect(() => {
    if (lastXpChange !== 0 && lastXpChange !== prevXpChangeRef.current && lastXpBreakdown) {
      prevXpChangeRef.current = lastXpChange;
      xpPopupCounter.current += 1;
      setXpPopup({ breakdown: lastXpBreakdown, key: xpPopupCounter.current });
      const t = setTimeout(() => setXpPopup(null), 1600);
      return () => clearTimeout(t);
    }
  }, [lastXpChange, lastXpBreakdown, currentIndex]);

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

  const xpFraction = lessonXp > 0 ? Math.min(xp / lessonXp, 1) : 0;

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
        @keyframes mastery-xp-popup {
          0% { opacity: 0; transform: translateY(8px) scale(0.7); }
          15% { opacity: 1; transform: translateY(-2px) scale(1.15); }
          30% { transform: translateY(0) scale(1); }
          75% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(6px) scale(0.9); }
        }
        @keyframes mastery-xp-penalty {
          0% { opacity: 0; transform: translateY(-4px) scale(0.8); }
          15% { opacity: 1; transform: translateY(2px) scale(1.1); }
          30% { transform: translateY(0) scale(1); }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translateY(8px) scale(0.9); }
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

        {/* Center: rank badge + combo (same row) + XP bar below */}
        <div className="flex flex-col items-center gap-1">
          {/* Top row: badge + combo aligned */}
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
                  {rank.name}
                </span>
                <span className="font-display text-[11px] font-medium text-white/70">
                  Lv.{levelLabel}
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

          {/* XP Progress Bar + XP popup */}
          <div className="relative">
            <div className="w-24 h-1.5 rounded-full bg-[#E5E4E1] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${xpFraction * 100}%`,
                  background: `linear-gradient(90deg, ${rank.colors[0]}, ${rank.colors[1]})`,
                }}
              />
            </div>
            {/* XP breakdown popup - cartoon style */}
            {xpPopup && (
              <div
                key={xpPopup.key}
                className="absolute left-1/2 top-full mt-1 pointer-events-none select-none"
                style={{
                  transform: 'translateX(-50%)',
                  animation: xpPopup.breakdown.total >= 0
                    ? 'mastery-xp-popup 1.6s ease-out forwards'
                    : 'mastery-xp-penalty 1.6s ease-out forwards',
                }}
              >
                {xpPopup.breakdown.total >= 0 ? (
                  /* Positive: show breakdown */
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    {/* Base */}
                    <span
                      style={{
                        fontFamily: "'Bangers', cursive",
                        fontSize: '18px',
                        color: '#FFFFFF',
                        WebkitTextStroke: '1.5px #22C55E',
                        textShadow: '0 2px 4px rgba(34,197,94,0.4)',
                        letterSpacing: '0.5px',
                      }}
                    >
                      +{xpPopup.breakdown.base}
                    </span>
                    {/* Speed bonus */}
                    {xpPopup.breakdown.speed > 0 && (
                      <span
                        style={{
                          fontFamily: "'Bangers', cursive",
                          fontSize: '16px',
                          color: '#FDE047',
                          WebkitTextStroke: '1px #CA8A04',
                          textShadow: '0 1px 3px rgba(202,138,4,0.5)',
                          letterSpacing: '0.5px',
                        }}
                      >
                        +{xpPopup.breakdown.speed}
                      </span>
                    )}
                    {/* Combo bonus */}
                    {xpPopup.breakdown.combo > 0 && (
                      <span
                        style={{
                          fontFamily: "'Bangers', cursive",
                          fontSize: '16px',
                          color: '#67E8F9',
                          WebkitTextStroke: '1px #0891B2',
                          textShadow: '0 1px 3px rgba(8,145,178,0.5)',
                          letterSpacing: '0.5px',
                        }}
                      >
                        +{xpPopup.breakdown.combo}
                      </span>
                    )}
                  </div>
                ) : (
                  /* Negative: penalty */
                  <span
                    style={{
                      fontFamily: "'Bangers', cursive",
                      fontSize: '20px',
                      color: '#FCA5A5',
                      WebkitTextStroke: '1.5px #DC2626',
                      textShadow: '0 2px 6px rgba(220,38,38,0.5)',
                      letterSpacing: '1px',
                    }}
                  >
                    {xpPopup.breakdown.total}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: counter */}
        <span className="font-display text-[15px] font-semibold text-text-secondary">
          {currentIndex + 1} / {totalInBatch}
        </span>
      </div>
    </>
  );
});
