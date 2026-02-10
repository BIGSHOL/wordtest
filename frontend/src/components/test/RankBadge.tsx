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

  return (
    <div
      className="rounded-full flex items-center justify-center"
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
}
