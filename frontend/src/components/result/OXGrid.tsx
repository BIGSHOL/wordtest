import { CircleCheck, CircleX } from 'lucide-react';
import type { AnswerDetail, TestSessionData } from '../../services/test';

export function OXGrid({
  answers,
  session,
}: {
  answers: AnswerDetail[];
  session: TestSessionData;
}) {
  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-5 lg:p-6 w-full">
      <div className="flex items-center gap-2.5 mb-4">
        <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
          문제별 결과
        </h3>
        <span className="text-[11px] font-bold text-teal bg-teal-light px-2 py-0.5 rounded-lg font-display">
          {session.total_questions}문제
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 lg:gap-2">
        {answers.map((a) => (
          <div
            key={a.question_order}
            className={`flex flex-col items-center justify-center rounded-lg lg:rounded-[10px] w-11 h-12 lg:w-[52px] lg:h-16 ${
              a.is_correct ? 'bg-[#ECFDF5]' : 'bg-[#FEF2F2]'
            }`}
            title={`${a.question_order}. ${a.word_english}`}
          >
            <span
              className={`text-[9px] font-display font-semibold ${
                a.is_correct ? 'text-[#065F46]' : 'text-[#991B1B]'
              }`}
            >
              {a.question_order}
            </span>
            {a.is_correct ? (
              <CircleCheck className="w-3.5 h-3.5 text-correct" />
            ) : (
              <CircleX className="w-3.5 h-3.5 text-wrong" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
