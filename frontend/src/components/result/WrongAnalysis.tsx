import type { AnswerDetail } from '../../services/test';

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
        </div>
        <div className="bg-[#F8F8F6] flex items-center h-11 px-6 border-y border-border-subtle">
          <span className="w-12 text-xs font-semibold text-text-tertiary">#</span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">단어</span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">뜻 (정답)</span>
          <span className="flex-1 text-xs font-semibold text-text-tertiary">학생 답변</span>
        </div>
        {wrong.map((a) => (
          <div
            key={a.question_order}
            className="flex items-center h-12 px-6 border-b border-border-subtle last:border-b-0"
          >
            <span className="w-12 text-sm font-bold text-text-secondary font-mono">
              {a.question_order}.
            </span>
            <span className="flex-1 text-sm font-semibold text-text-primary font-word">
              {a.word_english}
            </span>
            <span className="flex-1 text-[13px] font-medium text-correct font-display">
              {a.correct_answer}
            </span>
            <span className="flex-1 text-[13px] font-medium text-wrong font-display">
              {a.selected_answer || '미응답'}
            </span>
          </div>
        ))}
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
        {wrong.map((a) => (
          <div
            key={a.question_order}
            className="rounded-xl bg-white p-3 px-3.5 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-wrong font-word">
                {a.word_english}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-tertiary">
                학생: {a.selected_answer || '미응답'}
              </span>
              <span className="text-text-tertiary">&rarr;</span>
              <span className="text-correct font-semibold">{a.correct_answer}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
