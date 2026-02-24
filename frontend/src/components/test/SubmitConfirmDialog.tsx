/**
 * SubmitConfirmDialog - modal to confirm batch exam submission.
 */
import { memo } from 'react';

interface SubmitConfirmDialogProps {
  isOpen: boolean;
  totalQuestions: number;
  answeredCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SubmitConfirmDialog = memo(function SubmitConfirmDialog({
  isOpen,
  totalQuestions,
  answeredCount,
  onConfirm,
  onCancel,
}: SubmitConfirmDialogProps) {
  if (!isOpen) return null;

  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl px-7 py-8 flex flex-col gap-5"
        style={{ boxShadow: '0 8px 40px #1A191820' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          className="font-display text-xl font-bold text-center"
          style={{ color: '#3D3D3C' }}
        >
          제출하시겠습니까?
        </h2>

        {/* Stats */}
        <div
          className="rounded-2xl px-5 py-4 flex flex-col gap-2"
          style={{ background: '#F8F8F6', border: '1px solid #E8E8E6' }}
        >
          <p className="font-display text-sm text-center" style={{ color: '#6D6C6A' }}>
            전체{' '}
            <span className="font-bold" style={{ color: '#3D3D3C' }}>
              {totalQuestions}
            </span>
            문제 중{' '}
            <span className="font-bold" style={{ color: '#4F46E5' }}>
              {answeredCount}
            </span>
            개 답변,{' '}
            <span className="font-bold" style={{ color: unansweredCount > 0 ? '#D97706' : '#3D3D3C' }}>
              {unansweredCount}
            </span>
            개 미답변
          </p>
          {unansweredCount > 0 && (
            <p
              className="font-display text-xs text-center font-semibold"
              style={{ color: '#D97706' }}
            >
              미답변 문제는 오답 처리됩니다
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-12 rounded-2xl font-display text-[15px] font-semibold transition-opacity active:opacity-70"
            style={{
              background: '#F0EFED',
              color: '#6D6C6A',
            }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-12 rounded-2xl font-display text-[15px] font-bold text-white transition-opacity active:opacity-80"
            style={{
              background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
              boxShadow: '0 4px 16px #4F46E540',
            }}
          >
            제출
          </button>
        </div>
      </div>
    </div>
  );
});
