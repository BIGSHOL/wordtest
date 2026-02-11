import type { AnswerDetail } from '../../services/test';

function levelBadge(level: number) {
  if (level <= 3) return { text: `Lv.${level}`, color: 'text-[#4F46E5]', bg: 'bg-[#EEF2FF]' };
  if (level <= 5) return { text: `Lv.${level}`, color: 'text-[#EF4444]', bg: 'bg-[#FEF2F2]' };
  return { text: `Lv.${level}`, color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]' };
}

export function WrongAnalysis({ answers }: { answers: AnswerDetail[] }) {
  const wrong = answers.filter((a) => !a.is_correct);
  if (wrong.length === 0) return null;

  return (
    <>
      {/* PC: Table */}
      <div className="hidden lg:block rounded-2xl bg-white border border-border-subtle overflow-hidden w-full">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-base font-bold text-text-primary">
              틀린 단어 분석
            </h3>
            <span className="text-xs font-bold text-wrong bg-wrong-light px-2.5 py-0.5 rounded-full">
              {wrong.length}개
            </span>
          </div>
          <span className="text-xs font-medium text-text-tertiary">
            고급 어휘에서 오답률이 높습니다
          </span>
        </div>
        <div className="bg-[#F8F8F6] flex items-center h-11 px-6 border-y border-border-subtle">
          <span className="w-12 text-xs font-semibold text-text-tertiary">#</span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">단어</span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">뜻 (정답)</span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">학생 답변</span>
          <span className="w-20 text-xs font-semibold text-text-tertiary text-center">난이도</span>
          <span className="w-20 text-xs font-semibold text-text-tertiary text-right">응답시간</span>
        </div>
        {wrong.map((a) => {
          const badge = levelBadge(a.word_level);
          const timeStr = a.time_taken_seconds != null ? `${a.time_taken_seconds}초` : '-';
          const isSlowTime = a.time_taken_seconds != null && a.time_taken_seconds > 12;
          return (
            <div
              key={a.question_order}
              className="flex items-center h-12 px-6 border-b border-border-subtle last:border-b-0"
            >
              <span className="w-12 text-sm font-bold text-text-secondary font-mono whitespace-nowrap shrink-0">
                {a.question_order}.
              </span>
              <span className="flex-1 text-sm font-semibold text-text-primary font-word truncate min-w-0">
                {a.word_english}
              </span>
              <span className="flex-1 text-[13px] font-medium text-correct font-display truncate min-w-0">
                {a.correct_answer}
              </span>
              <span className="flex-1 text-[13px] font-medium text-wrong font-display truncate min-w-0">
                {a.selected_answer || '미응답'}
              </span>
              <span className="w-20 flex justify-center">
                <span className={`text-[11px] font-semibold ${badge.color} ${badge.bg} px-2 py-0.5 rounded-md`}>
                  {badge.text}
                </span>
              </span>
              <span className={`w-20 text-[13px] font-display text-right ${isSlowTime ? 'text-wrong font-semibold' : 'text-text-secondary font-medium'}`}>
                {timeStr}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile: Card layout */}
      <div className="lg:hidden flex flex-col gap-2.5 w-full">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-bold text-text-primary">
            틀린 단어 분석
          </h3>
          <span className="text-[11px] font-bold text-wrong bg-wrong-light px-2 py-0.5 rounded-lg">
            {wrong.length}개
          </span>
        </div>
        {wrong.map((a) => {
          const badge = levelBadge(a.word_level);
          const timeStr = a.time_taken_seconds != null ? `${a.time_taken_seconds}초` : '';
          return (
            <div
              key={a.question_order}
              className="rounded-xl bg-white p-3 px-3.5 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-wrong font-word">
                  {a.word_english}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold ${badge.color} ${badge.bg} px-1.5 py-0.5 rounded`}>
                    {badge.text}
                  </span>
                  {timeStr && (
                    <span className="text-[11px] text-text-tertiary">{timeStr}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-tertiary">
                  학생: {a.selected_answer || '미응답'}
                </span>
                <span className="text-text-tertiary">&rarr;</span>
                <span className="text-correct font-semibold">{a.correct_answer}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
