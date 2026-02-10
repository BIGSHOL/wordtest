import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getLevelRank } from '../../types/rank';

interface QuizHeaderProps {
  level: number;
  currentIndex: number;
  totalQuestions: number;
}

export function QuizHeader({ level, currentIndex, totalQuestions }: QuizHeaderProps) {
  const navigate = useNavigate();
  const rank = getLevelRank(level);
  const prevLevelRef = useRef(level);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (prevLevelRef.current !== level) {
      setFlash(level > prevLevelRef.current ? 'up' : 'down');
      prevLevelRef.current = level;
      const timer = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(timer);
    }
  }, [level]);

  return (
    <div className="flex items-center justify-between h-14 px-5 lg:h-16 lg:px-12 w-full">
      <button
        onClick={() => navigate('/student')}
        className="w-10 h-10 rounded-full flex items-center justify-center"
      >
        <ArrowLeft className="w-[22px] h-[22px] text-text-primary" />
      </button>

      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-[5px] rounded-full px-3.5 py-[5px] transition-all duration-300 ${
            flash === 'up' ? 'scale-110 ring-2 ring-green-400' :
            flash === 'down' ? 'scale-95 ring-2 ring-red-400' : ''
          }`}
          style={{
            background: `linear-gradient(90deg, ${rank.colors[0]}, ${rank.colors[1]})`,
            boxShadow: flash === 'up'
              ? `0 0 16px ${rank.colors[0]}60`
              : flash === 'down'
              ? `0 0 16px #EF444460`
              : `0 0 8px ${rank.colors[0]}30`,
          }}
        >
          <Award className="w-3.5 h-3.5 text-white" />
          <span className="font-display text-[13px] font-bold text-white">
            Lv.{level} {rank.name}
          </span>
        </div>
      </div>

      <span className="font-display text-[15px] font-semibold text-text-secondary">
        {currentIndex + 1} / {totalQuestions}
      </span>
    </div>
  );
}
