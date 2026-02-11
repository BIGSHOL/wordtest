/**
 * Registration page — matches Pencil design (PC: CZuUD, Mobile: TkBFC).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { GraduationCap, Brain, TrendingUp, Users, EyeOff, Eye } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
  });

  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (formData.password !== formData.confirmPassword) {
      setValidationError('비밀번호가 일치하지 않습니다');
      return;
    }

    if (formData.password.length < 8) {
      setValidationError('비밀번호는 8자 이상이어야 합니다');
      return;
    }

    try {
      await register({
        username: formData.username,
        password: formData.password,
        name: formData.name,
      });
      navigate('/dashboard', { replace: true });
    } catch {
      // Error is handled by store
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel — gradient branding (hidden on mobile) */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center gap-10 px-15 py-20"
        style={{ background: 'linear-gradient(180deg, #4F46E5 0%, #7C3AED 100%)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-10">
          <div className="w-[72px] h-[72px] rounded-full bg-white/[.13] flex items-center justify-center">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <h1
              className="text-4xl font-bold text-white"
              style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}
            >
              WordLvTest
            </h1>
            <p className="text-base text-white/80" style={{ fontFamily: 'Outfit, sans-serif' }}>
              영어 어휘력 레벨 테스트
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-white/80 shrink-0" />
            <span className="text-[15px] font-medium text-white/80" style={{ fontFamily: 'Outfit, sans-serif' }}>
              AI 기반 맞춤형 레벨 테스트
            </span>
          </div>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-white/80 shrink-0" />
            <span className="text-[15px] font-medium text-white/80" style={{ fontFamily: 'Outfit, sans-serif' }}>
              학생별 성장 추이 분석
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-white/80 shrink-0" />
            <span className="text-[15px] font-medium text-white/80" style={{ fontFamily: 'Outfit, sans-serif' }}>
              간편한 학급 관리
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel (PC) / Full screen (Mobile) */}
      <div className="flex-1 flex flex-col justify-center items-center bg-[#F5F4F1] lg:bg-white px-6 py-15 lg:px-15">
        {/* Mobile-only branding */}
        <div className="flex flex-col items-center gap-3 mb-8 lg:hidden">
          <div
            className="w-14 h-14 rounded-[14px] flex items-center justify-center"
            style={{ background: 'linear-gradient(180deg, #4F46E5 0%, #7C3AED 100%)' }}
          >
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1
            className="text-xl font-bold text-[#1A1918]"
            style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px' }}
          >
            WordLvTest
          </h1>
          <p className="text-[13px] text-[#6D6C6A]" style={{ fontFamily: 'Outfit, sans-serif' }}>
            영어 어휘력 레벨 테스트
          </p>
        </div>

        {/* Register Card */}
        <div className="w-full max-w-[360px] md:max-w-[440px] bg-white rounded-[20px] lg:rounded-none lg:shadow-none shadow-[0_2px_12px_rgba(26,25,24,0.03)] p-6 lg:p-0">
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            {/* Title */}
            <div className="flex flex-col gap-1">
              <h2
                className="text-lg lg:text-2xl font-bold text-[#1A1918]"
                style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px' }}
              >
                회원가입
              </h2>
              <p
                className="hidden lg:block text-sm text-[#6D6C6A]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                새 계정을 만들어보세요
              </p>
            </div>

            {/* Error */}
            {displayError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{displayError}</p>
              </div>
            )}

            {/* Fields */}
            <div className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="name"
                  className="text-[13px] font-medium text-[#1A1918]"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  이름
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="h-12 px-3.5 rounded-lg border border-[#E5E4E1] bg-white text-sm text-[#1A1918] placeholder-[#9C9B99] focus:outline-none focus:border-[#2D9CAE] focus:ring-1 focus:ring-[#2D9CAE] transition-colors"
                  placeholder="이름을 입력하세요"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                />
              </div>

              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="username"
                  className="text-[13px] font-medium text-[#1A1918]"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  아이디
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="h-12 px-3.5 rounded-lg border border-[#E5E4E1] bg-white text-sm text-[#1A1918] placeholder-[#9C9B99] focus:outline-none focus:border-[#2D9CAE] focus:ring-1 focus:ring-[#2D9CAE] transition-colors"
                  placeholder="아이디를 입력하세요"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-[13px] font-medium text-[#1A1918]"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full h-12 px-3.5 pr-11 rounded-lg border border-[#E5E4E1] bg-white text-sm text-[#1A1918] placeholder-[#9C9B99] focus:outline-none focus:border-[#2D9CAE] focus:ring-1 focus:ring-[#2D9CAE] transition-colors"
                    placeholder="비밀번호를 입력하세요"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9C9B99] hover:text-[#6D6C6A] transition-colors"
                  >
                    {showPassword ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-[13px] font-medium text-[#1A1918]"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  비밀번호 확인
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full h-12 px-3.5 pr-11 rounded-lg border border-[#E5E4E1] bg-white text-sm text-[#1A1918] placeholder-[#9C9B99] focus:outline-none focus:border-[#2D9CAE] focus:ring-1 focus:ring-[#2D9CAE] transition-colors"
                    placeholder="비밀번호를 다시 입력하세요"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9C9B99] hover:text-[#6D6C6A] transition-colors"
                  >
                    {showConfirmPassword ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Register Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-lg bg-[#2D9CAE] text-white text-[15px] font-semibold hover:bg-[#268a9a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {isLoading ? '가입 중...' : '회원가입'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#E5E4E1]" />
              <span className="text-xs text-[#9C9B99]" style={{ fontFamily: 'Outfit, sans-serif' }}>또는</span>
              <div className="flex-1 h-px bg-[#E5E4E1]" />
            </div>

            {/* Login Button (PC) */}
            <Link
              to="/login"
              className="hidden lg:flex w-full h-12 rounded-lg border border-[#2D9CAE] items-center justify-center text-[15px] font-semibold text-[#2D9CAE] hover:bg-[#2D9CAE]/5 transition-colors"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              로그인
            </Link>

            {/* Login link (Mobile) */}
            <div className="flex lg:hidden items-center justify-center gap-1">
              <span className="text-[13px] text-[#6D6C6A]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                이미 계정이 있으신가요?
              </span>
              <Link
                to="/login"
                className="text-[13px] font-semibold text-[#2D9CAE]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                로그인
              </Link>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p
          className="mt-8 text-xs text-[#9C9B99] text-center"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          &copy; 2026 WordLvTest
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
