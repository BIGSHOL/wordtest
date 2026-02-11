import {
  Shield, Sword, Award, Crown, Gem, Diamond, Star, Flame, Trophy,
} from 'lucide-react';
import { type RankInfo } from '../../types/rank';

interface RankBadgeProps {
  rank: RankInfo;
  size?: 'sm' | 'lg';
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  shield: Shield,
  sword: Sword,
  award: Award,
  crown: Crown,
  gem: Gem,
  diamond: Diamond,
  star: Star,
  flame: Flame,
  trophy: Trophy,
};

export function RankBadge({ rank, size = 'sm' }: RankBadgeProps) {
  const Icon = iconMap[rank.icon] || Award;
  const dim = size === 'lg' ? 100 : 36;
  const iconDim = size === 'lg' ? 44 : 18;

  const badge = (
    <div
      className="rounded-full flex items-center justify-center relative z-10"
      style={{
        width: dim,
        height: dim,
        background: `linear-gradient(180deg, ${rank.colors[0]}, ${rank.colors[1]})`,
        boxShadow: `0 0 ${size === 'lg' ? 24 : 8}px ${rank.colors[0]}40`,
      }}
    >
      <Icon
        className={size === 'lg' ? 'w-11 h-11' : 'w-[18px] h-[18px]'}
        style={{ color: rank.iconColor, width: iconDim, height: iconDim }}
      />
    </div>
  );

  if (size !== 'lg') return badge;

  // Large badge: animated aura ring + pulse glow
  const [c0, c1] = rank.colors;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 130, height: 130 }}>
      {/* Rotating conic-gradient ring */}
      <div
        className="absolute inset-0 rounded-full animate-[spin_6s_linear_infinite]"
        style={{
          background: `conic-gradient(from 0deg, ${c0}00, ${c0}AA, ${c1}AA, ${c0}00)`,
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
        }}
      />
      {/* Pulsing glow */}
      <div
        className="absolute rounded-full animate-[pulse_3s_ease-in-out_infinite]"
        style={{
          inset: 6,
          background: `radial-gradient(circle, ${c0}18 0%, ${c0}00 70%)`,
        }}
      />
      {badge}
    </div>
  );
}
