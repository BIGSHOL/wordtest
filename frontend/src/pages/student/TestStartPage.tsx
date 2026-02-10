import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Hash, Info, Play } from 'lucide-react';

export function TestStartPage() {
  const navigate = useNavigate();
  const [testCode, setTestCode] = useState('');

  const handleStart = () => {
    // Navigate to test page (code is optional for placement test)
    navigate('/test');
  };

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col md:max-w-[480px] md:mx-auto">
      {/* Top Section */}
      <div className="flex flex-col items-center gap-4 pt-[60px] pb-8 px-6">
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
            boxShadow: '0 4px 20px #4F46E530',
          }}
        >
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1
          className="font-display text-[26px] font-bold text-text-primary"
          style={{ letterSpacing: -0.5 }}
        >
          영단어 레벨테스트
        </h1>
        <p className="font-display text-sm font-medium text-text-secondary text-center max-w-[300px]">
          나의 영어 어휘력 레벨을 확인해보세요
        </p>
      </div>

      {/* Form Section */}
      <div className="flex flex-col gap-5 px-6 w-full">
        {/* Input Group */}
        <div className="flex flex-col gap-2 w-full">
          <label className="font-display text-sm font-semibold text-text-primary">
            테스트 코드
          </label>
          <div
            className="flex items-center gap-2.5 h-12 px-4 rounded-xl bg-bg-surface w-full"
            style={{ border: '1.5px solid #E5E4E1' }}
          >
            <Hash className="w-[18px] h-[18px] text-text-tertiary shrink-0" />
            <input
              type="text"
              placeholder="테스트 코드를 입력하세요 (예: A3X7K2)"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value)}
              className="font-display text-[15px] text-text-primary placeholder:text-text-tertiary bg-transparent outline-none w-full"
            />
          </div>
        </div>

        {/* Rules Card */}
        <div
          className="flex flex-col gap-3.5 rounded-2xl bg-bg-surface p-5 w-full"
          style={{ boxShadow: '0 2px 12px #1A191808' }}
        >
          <div className="flex items-center gap-2">
            <Info className="w-[18px] h-[18px] text-accent-indigo" />
            <span className="font-display text-[15px] font-semibold text-text-primary">
              테스트 안내
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              '선생님이 출제한 테스트 코드를 입력하세요',
              '코드 입력 시 설정된 문제가 자동 로딩됩니다',
              '정답률에 따라 난이도가 자동 조정됩니다',
              '테스트 코드는 선생님에게 문의하세요',
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary mt-1.5 shrink-0" />
                <span className="font-display text-[13px] font-medium text-text-secondary leading-relaxed">
                  {rule}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-4 px-6 pb-10">
        <button
          onClick={handleStart}
          className="flex items-center justify-center gap-2.5 w-full h-14 rounded-2xl text-white"
          style={{
            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
            boxShadow: '0 4px 16px #4F46E540',
          }}
        >
          <Play className="w-5 h-5 text-white" />
          <span className="font-display text-[17px] font-bold">테스트 시작하기</span>
        </button>
        <p className="font-display text-xs font-medium text-text-tertiary">
          테스트 코드를 입력하면 바로 시작할 수 있습니다
        </p>
      </div>
    </div>
  );
}

export default TestStartPage;
