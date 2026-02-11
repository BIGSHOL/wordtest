/**
 * Combo counter - shows consecutive correct answer streak.
 */
import { memo } from 'react';
import { Flame } from 'lucide-react';

interface ComboCounterProps {
  combo: number;
}

export const ComboCounter = memo(function ComboCounter({ combo }: ComboCounterProps) {
  if (combo < 2) return null;

  const isHot = combo >= 5;
  const isFire = combo >= 10;

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all duration-300"
      style={{
        background: isFire ? '#FEF3C7' : isHot ? '#FFF7ED' : '#F0FDF4',
        border: `1.5px solid ${isFire ? '#F59E0B' : isHot ? '#FB923C' : '#86EFAC'}`,
      }}
    >
      <Flame
        className="w-4 h-4"
        style={{ color: isFire ? '#F59E0B' : isHot ? '#FB923C' : '#22C55E' }}
      />
      <span
        className="font-display text-[13px] font-bold tabular-nums"
        style={{ color: isFire ? '#B45309' : isHot ? '#C2410C' : '#166534' }}
      >
        {combo} COMBO
      </span>
    </div>
  );
});
