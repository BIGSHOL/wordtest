/**
 * Student main page - Empty state with Pencil design.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { GraduationCap, BookOpen, Hash } from 'lucide-react';

export function StudentMainPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [testCode, setTestCode] = useState('');
  const composingRef = useRef(false);

  const handleCodeChange = (value: string) => {
    if (composingRef.current) return; // IME 조합 중에는 무시
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
    <div className="min-h-screen bg-bg-cream flex flex-col">
      <div className="flex-1 flex flex-col items-center px-6 md:max-w-[480px] md:mx-auto w-full">
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
              placeholder="테스트 코드 입력"
              value={testCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(e) => { composingRef.current = false; handleCodeChange((e.target as HTMLInputElement).value); }}
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-sm font-display tracking-[0.15em] font-semibold"
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
    </div>
  );
}

export default StudentMainPage;
