import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Hash, AlertCircle, Loader2, Play } from 'lucide-react';
import { useTestStore } from '../../stores/testStore';

const CODE_LENGTH = 8;
const CODE_CHARS = /[^A-HJ-NP-Z2-9]/g;

export function TestStartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { startTestByCode } = useTestStore();
  const [testCode, setTestCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStartTriggered = useRef(false);

  // Auto-start from URL query param (e.g. /test/start?code=HKWN3V7P)
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl && codeFromUrl.length === CODE_LENGTH && !autoStartTriggered.current) {
      autoStartTriggered.current = true;
      const cleaned = codeFromUrl.toUpperCase().replace(CODE_CHARS, '').slice(0, CODE_LENGTH);
      setTestCode(cleaned);
      handleStartByCode(cleaned);
    }
  }, [searchParams]);

  const handleStartByCode = async (code: string) => {
    if (code.length !== CODE_LENGTH) {
      setError(`테스트 코드는 ${CODE_LENGTH}자리입니다`);
      return;
    }

    setIsStarting(true);
    setError(null);
    try {
      await startTestByCode(code);
      navigate('/test', { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'This test code has already been used') {
        setError('이미 사용된 테스트 코드입니다');
      } else if (detail === 'Invalid or inactive test code') {
        setError('유효하지 않은 테스트 코드입니다');
      } else {
        setError('테스트를 시작할 수 없습니다');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const composingRef = useRef(false);

  const handleCodeChange = (value: string) => {
    if (composingRef.current) return;
    const cleaned = value.toUpperCase().replace(CODE_CHARS, '').slice(0, CODE_LENGTH);
    setTestCode(cleaned);
    if (error) setError(null);
  };

  // Show loading overlay when auto-starting from URL param
  if (autoStartTriggered.current && isStarting && !error) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
            boxShadow: '0 4px 20px #4F46E530',
          }}
        >
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        <h1 className="font-display text-xl font-bold text-text-primary">
          테스트 준비 중...
        </h1>
        <p className="font-display text-sm text-text-secondary">
          코드 {testCode} 검증 및 테스트를 시작합니다
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col items-center md:justify-center lg:justify-center">
      <div className="flex flex-col w-full md:w-[480px] lg:w-[480px]">
      {/* Top Section */}
      <div className="flex flex-col items-center gap-4 pt-[60px] md:pt-0 lg:pt-0 pb-8 px-6 md:px-8">
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
          선생님이 보내준 테스트 코드를 입력하세요
        </p>
      </div>

      {/* Form Section */}
      <div className="flex flex-col gap-5 px-6 md:px-8 w-full">
        {/* Input Group */}
        <div className="flex flex-col gap-2 w-full">
          <label className="font-display text-sm font-semibold text-text-primary">
            테스트 코드
          </label>
          <div
            className="flex items-center gap-2.5 h-12 px-4 rounded-xl bg-bg-surface"
            style={{ border: `1.5px solid ${error ? '#EF4444' : '#E5E4E1'}` }}
          >
            <Hash className="w-[18px] h-[18px] text-text-tertiary shrink-0" />
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="HKWN3V7P"
              value={testCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(e) => { composingRef.current = false; handleCodeChange((e.target as HTMLInputElement).value); }}
              onKeyDown={(e) => e.key === 'Enter' && testCode.length === CODE_LENGTH && handleStartByCode(testCode)}
              className="font-display text-[15px] text-text-primary placeholder:text-text-tertiary bg-transparent outline-none w-full tracking-[0.2em] font-semibold uppercase"
              maxLength={CODE_LENGTH}
            />
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-[13px] text-red-500 font-display">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
        </div>

        {/* Rules Card */}
        <div
          className="flex flex-col gap-3.5 rounded-2xl bg-bg-surface p-5 w-full"
          style={{ boxShadow: '0 2px 12px #1A191808' }}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-[18px] h-[18px] text-accent-indigo" />
            <span className="font-display text-[15px] font-semibold text-text-primary">
              테스트 안내
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              '선생님이 보내준 8자리 코드를 입력하세요',
              '코드 입력 후 바로 시험이 시작됩니다',
              '별도 로그인 없이 코드만으로 시험 가능합니다',
              '테스트 코드는 1회만 사용할 수 있습니다',
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

      {/* Spacer (mobile only) */}
      <div className="flex-1 md:hidden lg:hidden" />

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-4 px-6 md:px-8 pb-10 md:pb-0 md:pt-8 lg:pb-0 lg:pt-8">
        <button
          onClick={() => handleStartByCode(testCode)}
          disabled={testCode.length !== CODE_LENGTH || isStarting}
          className="flex items-center justify-center gap-2.5 w-full h-14 rounded-2xl text-white disabled:opacity-40 transition-opacity"
          style={{
            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
            boxShadow: testCode.length === CODE_LENGTH ? '0 4px 16px #4F46E540' : 'none',
          }}
        >
          {isStarting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5 text-white" />
          )}
          <span className="font-display text-[17px] font-bold">
            {isStarting ? '준비 중...' : '테스트 시작하기'}
          </span>
        </button>
        <p className="font-display text-xs font-medium text-text-tertiary">
          코드를 입력하고 시작 버튼을 눌러주세요
        </p>
      </div>
      </div>{/* end center container */}
    </div>
  );
}

export default TestStartPage;
