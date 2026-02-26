/**
 * User profile page — password change & account info.
 */
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import authService from '../../services/auth';
import { getErrorMessage } from '../../utils/error';
import { KeyRound, User as UserIcon, X } from 'lucide-react';

export function ProfilePage() {
  const { user, fetchUser } = useAuthStore();

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (user) setEditName(user.name || '');
  }, [user]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setIsLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await authService.updateProfile({ name: editName.trim() });
      await fetchUser();
      setIsEditingName(false);
      setMessage({ type: 'success', text: '이름이 변경되었습니다.' });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(error, '이름 변경에 실패했습니다.') });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordMismatch =
    passwordData.confirmPassword !== '' && passwordData.newPassword !== passwordData.confirmPassword;

  const canSubmitPassword =
    passwordData.currentPassword.trim() !== '' &&
    passwordData.newPassword.trim() !== '' &&
    passwordData.newPassword === passwordData.confirmPassword &&
    passwordData.newPassword.length >= 4;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitPassword) return;
    setMessage({ type: '', text: '' });
    setIsLoading(true);
    try {
      await authService.changePassword({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      });
      setIsChangingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: '비밀번호가 변경되었습니다.' });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(error, '비밀번호 변경에 실패했습니다.') });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal"></div>
        </div>
      </TeacherLayout>
    );
  }

  const roleLabel = user.role === 'master' ? '마스터' : '선생님';

  return (
    <TeacherLayout>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="font-display text-[26px] font-extrabold text-text-primary">프로필</h1>
          <p className="font-display text-[14px] text-text-secondary mt-1">
            계정 정보를 확인하고 비밀번호를 변경하세요
          </p>
        </div>

        {/* Message */}
        {message.text && (
          <div
            className={`px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-between ${
              message.type === 'success'
                ? 'bg-feedback-success/10 text-feedback-success'
                : 'bg-feedback-error/10 text-feedback-error'
            }`}
          >
            {message.text}
            <button onClick={() => setMessage({ type: '', text: '' })}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Account Info Card */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-teal" />
            <h2 className="text-lg font-semibold text-text-primary">계정 정보</h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-[100px_1fr] gap-y-3 items-center">
              <span className="text-sm font-medium text-text-tertiary">아이디</span>
              <span className="text-sm text-text-primary">{user.username || '-'}</span>

              <span className="text-sm font-medium text-text-tertiary">이름</span>
              {isEditingName ? (
                <form onSubmit={handleUpdateName} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2 py-1 border border-border-subtle rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-3 py-1 bg-teal text-white text-xs rounded font-medium hover:bg-teal/90 disabled:opacity-50"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsEditingName(false); setEditName(user.name || ''); }}
                    className="px-3 py-1 bg-bg-muted text-text-secondary text-xs rounded font-medium"
                  >
                    취소
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-primary">{user.name}</span>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-xs text-teal hover:underline"
                  >
                    수정
                  </button>
                </div>
              )}

              <span className="text-sm font-medium text-text-tertiary">역할</span>
              <span className="text-sm text-text-primary">{roleLabel}</span>

              <span className="text-sm font-medium text-text-tertiary">가입일</span>
              <span className="text-sm text-text-primary">
                {new Date(user.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Password Change Card */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-teal" />
            <h2 className="text-lg font-semibold text-text-primary">비밀번호 변경</h2>
          </div>

          {isChangingPassword ? (
            <form onSubmit={handleChangePassword}>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                    현재 비밀번호 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    placeholder="현재 비밀번호"
                    required
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                    새 비밀번호 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="새 비밀번호 (4자 이상)"
                    required
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                    새 비밀번호 확인 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="새 비밀번호 재입력"
                    required
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{
                      border: passwordMismatch ? '1px solid #EF4444' : '1px solid #E8E8E6',
                    }}
                  />
                  {passwordMismatch && (
                    <p className="mt-1 text-[11px] font-medium" style={{ color: '#EF4444' }}>
                      비밀번호가 일치하지 않습니다
                    </p>
                  )}
                </div>
              </div>
              <div
                className="flex items-center justify-end gap-3 px-6 py-4"
                style={{ borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-muted"
                  style={{ border: '1px solid #E8E8E6' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitPassword || isLoading}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
                  }}
                >
                  {isLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </form>
          ) : (
            <div className="px-6 py-5">
              <p className="text-sm text-text-secondary mb-4">
                보안을 위해 정기적으로 비밀번호를 변경하세요.
              </p>
              <button
                onClick={() => setIsChangingPassword(true)}
                className="px-4 py-2 text-sm font-medium text-teal border border-teal rounded-lg hover:bg-teal-light transition-colors"
              >
                비밀번호 변경
              </button>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

export default ProfilePage;
