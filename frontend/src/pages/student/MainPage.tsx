/**
 * Student main page
 * - Mobile: 모바일 전용 UI
 * - PC (lg 이상): PC Empty State 디자인
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { GraduationCap, BookOpen, Hash, KeyRound } from 'lucide-react';

export function StudentMainPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [testCode, setTestCode] = useState('');
  const composingRef = useRef(false);

  const handleCodeChange = (value: string) => {
    if (composingRef.current) return;
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setTestCode(cleaned);
  };

  const handleStart = () => {
    if (testCode.length === 6) {
      navigate(`/test/start?code=${testCode}`);
    } else {
      navigate('/test/start');
    }
  };

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center">
      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col items-center px-6 w-full md:w-[520px] md:mx-auto lg:hidden">
        {/* Top section */}
        <div className="pt-16 flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
          >
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold font-display text-text-primary">
            영단어 레벨테스트
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            안녕하세요, {user?.name}님!
          </p>
        </div>

        {/* Main card */}
        <div className="mt-8 w-full bg-surface rounded-2xl border border-border-subtle p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-bg-muted flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-text-tertiary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-text-primary">
            테스트를 시작해보세요
          </h2>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            선생님이 배정한 테스트를 진행하고<br />
            나의 영어 어휘력 레벨을 확인할 수 있습니다
          </p>

          {/* Test code input */}
          <div className="mt-6 w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-bg-cream">
            <Hash className="w-5 h-5 text-text-tertiary flex-shrink-0" />
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="테스트 코드 입력"
              value={testCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(e) => { composingRef.current = false; handleCodeChange((e.target as HTMLInputElement).value); }}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-sm font-display tracking-[0.15em] font-semibold uppercase"
              maxLength={6}
            />
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="mt-6 w-full py-4 rounded-xl text-white font-display font-semibold text-base shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
        >
          레벨 테스트 시작
        </button>
      </div>

      {/* PC Layout - centered empty state */}
      <div className="hidden lg:flex flex-col items-center w-[520px]">
        {/* Top Section */}
        <div className="flex flex-col items-center gap-4 pb-10">
          <div
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
              boxShadow: '0 4px 20px #4F46E530',
            }}
          >
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-[26px] font-bold text-text-primary" style={{ letterSpacing: -0.5 }}>
            영단어 레벨테스트
          </h1>
          <p className="font-display text-sm font-medium text-text-secondary text-center">
            나의 영어 어휘력 레벨을 확인해보세요
          </p>
        </div>

        {/* Empty Area */}
        <div className="flex flex-col items-center gap-5 py-10">
          <div className="w-16 h-16 rounded-full bg-bg-muted flex items-center justify-center">
            <KeyRound className="w-8 h-8 text-text-tertiary" />
          </div>
          <div className="text-center">
            <h2 className="font-display text-lg font-bold text-text-primary">
              테스트 코드가 필요합니다
            </h2>
            <p className="mt-2 font-display text-sm text-text-secondary leading-relaxed">
              선생님에게 테스트 코드를 받은 후<br />
              코드를 입력하여 시작해보세요
            </p>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col items-center gap-4 pt-10 w-full">
          <button
            onClick={() => navigate('/test/start')}
            className="flex items-center justify-center gap-2.5 w-full h-14 rounded-2xl text-white"
            style={{
              background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
              boxShadow: '0 4px 16px #4F46E540',
            }}
          >
            <Hash className="w-5 h-5 text-white" />
            <span className="font-display text-[17px] font-bold">코드 입력하러 가기</span>
          </button>
          <p className="font-display text-xs font-medium text-text-tertiary">
            테스트 코드는 선생님에게 문의하세요
          </p>
        </div>
      </div>
    </div>
  );
}

export default StudentMainPage;
