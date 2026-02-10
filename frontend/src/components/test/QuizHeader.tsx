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

  return (
    <div className="flex items-center justify-between h-14 px-5 w-full">
      <button
        onClick={() => navigate('/student')}
        className="w-10 h-10 rounded-full flex items-center justify-center"
      >
        <ArrowLeft className="w-[22px] h-[22px] text-text-primary" />
      </button>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-[5px] rounded-full px-3.5 py-[5px]"
          style={{
            background: `linear-gradient(90deg, ${rank.colors[0]}, ${rank.colors[1]})`,
            boxShadow: `0 0 8px ${rank.colors[0]}30`,
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
