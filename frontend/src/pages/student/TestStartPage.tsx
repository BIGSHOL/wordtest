import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Hash, Info, Play, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { testConfigService, type TestConfig } from '../../services/testConfig';
import { useTestStore } from '../../stores/testStore';

export function TestStartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { startTest } = useTestStore();
  const [testCode, setTestCode] = useState('');
  const [config, setConfig] = useState<TestConfig | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const autoStartTriggered = useRef(false);

  // Auto-validate & auto-start from URL query param (e.g. /test/start?code=A3X7K2)
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl && codeFromUrl.length === 6 && !autoStartTriggered.current) {
      autoStartTriggered.current = true;
      const cleaned = codeFromUrl.toUpperCase().replace(/[^A-Z0-9]/g, '');
      setTestCode(cleaned);
      autoValidateAndStart(cleaned);
    }
  }, [searchParams]);

  const autoValidateAndStart = async (code: string) => {
    setIsValidating(true);
    setValidationError(null);
    try {
      const result = await testConfigService.getConfigByCode(code);
      setConfig(result);
      // Auto-start immediately
      setIsStarting(true);
      await startTest(result.test_type, code);
      navigate('/test', { replace: true });
    } catch {
      setValidationError('유효하지 않은 테스트 코드입니다');
      setConfig(null);
      setIsStarting(false);
    } finally {
      setIsValidating(false);
    }
  };

  const composingRef = useRef(false);

  const handleCodeChange = (value: string) => {
    if (composingRef.current) return; // IME 조합 중에는 무시
    // Uppercase, alphanumeric only, max 6 chars
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setTestCode(cleaned);
    // Reset validation when code changes
    if (config) setConfig(null);
    if (validationError) setValidationError(null);
  };

  const handleValidate = async () => {
    if (testCode.length !== 6) {
      setValidationError('테스트 코드는 6자리입니다');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    try {
      const result = await testConfigService.getConfigByCode(testCode);
      setConfig(result);
    } catch {
      setValidationError('유효하지 않은 테스트 코드입니다');
      setConfig(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleStart = async () => {
    if (!config) return;
    setIsStarting(true);
    try {
      await startTest(config.test_type, testCode);
      navigate('/test');
    } catch {
      setValidationError('테스트를 시작할 수 없습니다');
    } finally {
      setIsStarting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}분 ${s}초` : `${m}분`;
  };

  // Show loading overlay when auto-starting from URL param
  if (autoStartTriggered.current && (isValidating || isStarting) && !validationError) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4 md:max-w-[480px] md:mx-auto">
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
          <div className="flex gap-2">
            <div
              className="flex items-center gap-2.5 h-12 px-4 rounded-xl bg-bg-surface flex-1"
              style={{ border: `1.5px solid ${validationError ? '#EF4444' : config ? '#22C55E' : '#E5E4E1'}` }}
            >
              <Hash className="w-[18px] h-[18px] text-text-tertiary shrink-0" />
              <input
                type="text"
                placeholder="A3X7K2"
                value={testCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={(e) => { composingRef.current = false; handleCodeChange((e.target as HTMLInputElement).value); }}
                onKeyDown={(e) => e.key === 'Enter' && !config && handleValidate()}
                className="font-display text-[15px] text-text-primary placeholder:text-text-tertiary bg-transparent outline-none w-full tracking-[0.2em] font-semibold"
                maxLength={6}
              />
            </div>
            <button
              onClick={handleValidate}
              disabled={testCode.length !== 6 || isValidating || !!config}
              className="h-12 px-4 rounded-xl font-display text-sm font-semibold transition-colors disabled:opacity-40"
              style={{
                background: config ? '#22C55E' : '#4F46E5',
                color: 'white',
              }}
            >
              {isValidating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : config ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                '확인'
              )}
            </button>
          </div>
          {validationError && (
            <div className="flex items-center gap-1.5 text-[13px] text-red-500 font-display">
              <AlertCircle className="w-3.5 h-3.5" />
              {validationError}
            </div>
          )}
        </div>

        {/* Config Info Card (shown after validation) */}
        {config && (
          <div
            className="flex flex-col gap-3 rounded-2xl bg-bg-surface p-5 w-full animate-in fade-in slide-in-from-top-2 duration-300"
            style={{ boxShadow: '0 2px 12px #1A191808' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-[18px] h-[18px] text-green-500" />
              <span className="font-display text-[15px] font-semibold text-text-primary">
                {config.name}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '문제 수', value: `${config.question_count}문제` },
                { label: '제한 시간', value: formatTime(config.time_limit_seconds) },
                { label: '레벨 범위', value: `Lv.${config.level_range_min} ~ ${config.level_range_max}` },
                { label: '교재', value: config.book_name || '전체' },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-bg-cream">
                  <span className="font-display text-[11px] text-text-tertiary">{item.label}</span>
                  <span className="font-display text-[13px] font-semibold text-text-primary">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules Card */}
        {!config && (
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
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-4 px-6 pb-10">
        <button
          onClick={handleStart}
          disabled={!config || isStarting}
          className="flex items-center justify-center gap-2.5 w-full h-14 rounded-2xl text-white disabled:opacity-40 transition-opacity"
          style={{
            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
            boxShadow: config ? '0 4px 16px #4F46E540' : 'none',
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
          {config ? '준비가 완료되었습니다. 시작 버튼을 눌러주세요' : '테스트 코드를 입력하고 확인 버튼을 눌러주세요'}
        </p>
      </div>
    </div>
  );
}

export default TestStartPage;
