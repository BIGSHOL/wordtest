/**
 * Growth stage icon - represents word mastery level.
 * Seed → Sprout → Sapling → Tree → Fruit
 */
import { memo } from 'react';
import { Sprout, TreePine, TreeDeciduous, Cherry, Circle } from 'lucide-react';
import type { StageNumber } from '../../types/mastery';
import { STAGE_CONFIG } from '../../types/mastery';

interface GrowthIconProps {
  stage: StageNumber | 0 | 6; // 0=not started, 6=mastered
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

const SIZES = { sm: 16, md: 24, lg: 36 };

export const GrowthIcon = memo(function GrowthIcon({ stage, size = 'md', animate }: GrowthIconProps) {
  const s = SIZES[size];
  const animClass = animate ? 'animate-bounce' : '';

  if (stage === 0) {
    return <Circle className={animClass} size={s} style={{ color: '#D1D5DB' }} />;
  }

  if (stage === 6) {
    // Mastered - golden fruit with glow
    return (
      <div className={`relative ${animClass}`}>
        <Cherry size={s} style={{ color: '#EF4444' }} />
        <div
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 8px #FFD70060', pointerEvents: 'none' }}
        />
      </div>
    );
  }

  const color = STAGE_CONFIG[stage as StageNumber]?.color ?? '#9CA3AF';

  switch (stage) {
    case 1:
      return <Circle className={animClass} size={s} style={{ color }} fill={color} />;
    case 2:
      return <Sprout className={animClass} size={s} style={{ color }} />;
    case 3:
      return <TreePine className={animClass} size={s} style={{ color }} />;
    case 4:
      return <TreeDeciduous className={animClass} size={s} style={{ color }} />;
    case 5:
      return <Cherry className={animClass} size={s} style={{ color }} />;
    default:
      return <Circle size={s} style={{ color: '#D1D5DB' }} />;
  }
});
