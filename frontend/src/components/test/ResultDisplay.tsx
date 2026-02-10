/**
 * Test result display component.
 */
import { LevelBadge } from './LevelBadge';
import type { TestResultResponse } from '../../services/test';

interface ResultDisplayProps {
  result: TestResultResponse;
}

export function ResultDisplay({ result }: ResultDisplayProps) {
  const { test_session, answers } = result;
  const pct = test_session.total_questions > 0
    ? Math.round((test_session.correct_count / test_session.total_questions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Level & Score */}
      <div className="flex flex-col items-center gap-4">
        {test_session.determined_level && (
          <LevelBadge level={test_session.determined_level} size="lg" />
        )}
        <div className="text-center">
          <p className="text-3xl font-bold text-text-primary">
            {test_session.correct_count} / {test_session.total_questions}
          </p>
          <p className="text-lg text-text-secondary">정답률 {pct}%</p>
        </div>
      </div>

      {/* Answer details */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-text-primary">문제별 결과</h3>
        <div className="space-y-1">
          {answers.map((a) => (
            <div
              key={a.question_order}
              className={`flex items-center justify-between p-3 rounded-lg ${
                a.is_correct ? 'bg-correct/10' : 'bg-wrong/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-text-secondary w-6">
                  {a.question_order}
                </span>
                <span className="font-medium text-text-primary">{a.word_english}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {!a.is_correct && (
                  <span className="text-wrong line-through">{a.selected_answer || '미응답'}</span>
                )}
                <span className={a.is_correct ? 'text-correct font-medium' : 'text-text-secondary'}>
                  {a.correct_answer}
                </span>
                <span>{a.is_correct ? '✓' : '✗'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
