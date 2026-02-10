/**
 * Level badge component.
 */
interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'lg';
}

export function LevelBadge({ level, size = 'sm' }: LevelBadgeProps) {
  const colors = [
    '', // 0 placeholder
    'bg-level-1 text-green-900', // 1-3
    'bg-level-1 text-green-900',
    'bg-level-1 text-green-900',
    'bg-level-2 text-white',     // 4-6
    'bg-level-2 text-white',
    'bg-level-2 text-white',
    'bg-level-3 text-white',     // 7-9
    'bg-level-3 text-white',
    'bg-level-3 text-white',
    'bg-level-4 text-white',     // 10-12
    'bg-level-4 text-white',
    'bg-level-4 text-white',
    'bg-level-5 text-amber-900', // 13-15
    'bg-level-5 text-amber-900',
    'bg-level-5 text-amber-900',
  ];

  const colorClass = colors[level] || colors[1];
  const sizeClass = size === 'lg'
    ? 'w-20 h-20 text-2xl'
    : 'w-8 h-8 text-xs';

  return (
    <span className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-bold`}>
      Lv.{level}
    </span>
  );
}
