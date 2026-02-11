/**
 * Login page — matches Pencil design (PC: split layout, Mobile: card).
 */
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { GraduationCap, Brain, TrendingUp, Users, EyeOff, Eye, Hash } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [testCode, setTestCode] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const handleTestCodeChange = (value: string) => {
    setTestCode(value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 8));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(formData);
      const user = useAuthStore.getState().user;

      // If test code is provided, go directly to test start
      if (testCode.length === 8) {
        navigate(`/test/start?code=${testCode}`, { replace: true });
        return;
      }

      const target = from || (user?.role === 'student' ? '/student' : '/dashboard');
      navigate(target, { replace: true });
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

        {/* Login Card */}
        <div className="w-full max-w-[360px] md:max-w-[440px] bg-white rounded-[20px] lg:rounded-none lg:shadow-none shadow-[0_2px_12px_rgba(26,25,24,0.03)] p-6 lg:p-0">
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            {/* Title */}
            <div className="flex flex-col gap-1">
              <h2
                className="text-lg lg:text-2xl font-bold text-[#1A1918]"
                style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px' }}
              >
                로그인
              </h2>
              <p
                className="hidden lg:block text-sm text-[#6D6C6A]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                계정에 로그인하세요
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Fields */}
            <div className="flex flex-col gap-4">
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
                    autoComplete="current-password"
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
            </div>

            {/* Test Code (optional) */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="testCode"
                className="text-[13px] font-medium text-[#1A1918]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                테스트 코드 <span className="text-[#9C9B99] font-normal">(선택)</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#9C9B99]" />
                <input
                  id="testCode"
                  type="text"
                  value={testCode}
                  onChange={(e) => handleTestCodeChange(e.target.value)}
                  className="w-full h-12 pl-10 pr-3.5 rounded-lg border border-[#E5E4E1] bg-white text-sm text-[#1A1918] placeholder-[#9C9B99] focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-colors tracking-[0.15em] font-semibold"
                  placeholder="코드 입력 시 바로 테스트 시작"
                  maxLength={8}
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                />
              </div>
              {testCode.length > 0 && testCode.length < 8 && (
                <p className="text-[11px] text-[#9C9B99]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  8자리 코드를 입력하세요 ({testCode.length}/8)
                </p>
              )}
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full h-12 rounded-lg text-white text-[15px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                testCode.length === 8
                  ? 'bg-[#4F46E5] hover:bg-[#4338CA]'
                  : 'bg-[#2D9CAE] hover:bg-[#268a9a]'
              }`}
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {isLoading
                ? '로그인 중...'
                : testCode.length === 8
                  ? '로그인 & 테스트 시작'
                  : '로그인'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#E5E4E1]" />
              <span className="text-xs text-[#9C9B99]" style={{ fontFamily: 'Outfit, sans-serif' }}>또는</span>
              <div className="flex-1 h-px bg-[#E5E4E1]" />
            </div>

            {/* Signup Button (PC) */}
            <Link
              to="/register"
              className="hidden lg:flex w-full h-12 rounded-lg border border-[#2D9CAE] items-center justify-center text-[15px] font-semibold text-[#2D9CAE] hover:bg-[#2D9CAE]/5 transition-colors"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              회원가입
            </Link>

            {/* Signup link (Mobile) */}
            <div className="flex lg:hidden items-center justify-center gap-1">
              <span className="text-[13px] text-[#6D6C6A]" style={{ fontFamily: 'Outfit, sans-serif' }}>
                계정이 없으신가요?
              </span>
              <Link
                to="/register"
                className="text-[13px] font-semibold text-[#2D9CAE]"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                회원가입
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

export default LoginPage;
