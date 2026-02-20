import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Hash, AlertCircle, Loader2, Play, RotateCcw, BarChart3, AlertTriangle, LogIn } from 'lucide-react';
import { useTestStore } from '../../stores/testStore';
import { useMasteryStore } from '../../stores/masteryStore';
import { useStageTestStore } from '../../stores/stageTestStore';
import { useListeningTestStore } from '../../stores/listeningTestStore';

const CODE_LENGTH = 8;
const CODE_CHARS = /[^A-Z0-9]/g;

interface CompletedInfo {
  sessionId: string;
  assignmentId: string;
  code: string;
}

export function TestStartPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { startTestByCode } = useTestStore();
  const { startByCode: startMasteryByCode } = useMasteryStore();
  const { startByCode: startStageTestByCode } = useStageTestStore();
  const { startByCode: startListeningTestByCode } = useListeningTestStore();
  const [testCode, setTestCode] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedInfo, setCompletedInfo] = useState<CompletedInfo | null>(null);
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
      // Try mastery first (new system) — also detects stage tests and legacy engines
      const response = await startMasteryByCode(code);
      const engine = response.engine_type;

      // Route by engine_type if available, else by assignment_type
      if (engine) {
        if (engine.startsWith('xp_')) {
          // XP engines → mastery page (questions already loaded)
          navigate('/mastery', { replace: true });
          return;
        }
        if (engine === 'legacy_stage' || engine === 'legacy_listen') {
          // Legacy stage/listen → stage test page
          await startStageTestByCode(code);
          navigate('/stage-test', { replace: true });
          return;
        }
        if (engine === 'legacy_word') {
          // Legacy word → legacy test page
          await startTestByCode(code);
          navigate('/test', { replace: true });
          return;
        }
      }

      // Fallback: route by assignment_type (backward compat for NULL engine_type)
      if (response.assignment_type === 'stage_test') {
        await startStageTestByCode(code);
        navigate('/stage-test', { replace: true });
        return;
      }
      if (response.assignment_type === 'listening') {
        // Listening test: call separate start endpoint
        await startListeningTestByCode(code);
        navigate('/listening-test', { replace: true });
        return;
      }
      if (response.assignment_type === 'mastery') {
        navigate('/mastery', { replace: true });
        return;
      }
      // Fallback: legacy test system
      await startTestByCode(code);
      navigate('/test', { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const status = err?.response?.status;
      if (status === 409 && detail?.code === 'ALREADY_COMPLETED') {
        setCompletedInfo({
          sessionId: detail.session_id,
          assignmentId: detail.assignment_id,
          code,
        });
      } else if (detail === 'This test code has already been used') {
        setError('이미 사용된 테스트 코드입니다');
      } else if (detail === 'Invalid or inactive test code') {
        // Try legacy test start-by-code as fallback
        try {
          await startTestByCode(code);
          navigate('/test', { replace: true });
          return;
        } catch {
          setError('유효하지 않은 테스트 코드입니다');
        }
      } else {
        setError('학습을 시작할 수 없습니다');
      }
    } finally {
      setIsStarting(false);
    }
  };

  const handleRestart = async () => {
    if (!completedInfo) return;
    setIsStarting(true);
    setError(null);
    try {
      const response = await startMasteryByCode(completedInfo.code, true);
      const engine = response.engine_type;
      if (engine?.startsWith('xp_') || response.assignment_type === 'mastery') {
        navigate('/mastery', { replace: true });
      } else if (response.assignment_type === 'listening') {
        await startListeningTestByCode(completedInfo.code, true);
        navigate('/listening-test', { replace: true });
      } else if (engine === 'legacy_stage' || engine === 'legacy_listen' || response.assignment_type === 'stage_test') {
        await startStageTestByCode(completedInfo.code, true);
        navigate('/stage-test', { replace: true });
      }
    } catch {
      setError('재응시를 시작할 수 없습니다');
    } finally {
      setIsStarting(false);
    }
  };

  const handleViewReport = () => {
    if (!completedInfo) return;
    // Open full report in a popup window
    const url = `/mastery-report/${completedInfo.sessionId}`;
    const w = 960;
    const h = 800;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    window.open(url, 'report', `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
  };

  const composingRef = useRef(false);

  const handleCodeChange = (value: string) => {
    if (composingRef.current) return;
    const cleaned = value.toUpperCase().replace(CODE_CHARS, '').slice(0, CODE_LENGTH);
    setTestCode(cleaned);
    if (error) setError(null);
  };

  // Show already-completed choice screen
  if (completedInfo) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center md:justify-center lg:justify-center">
        <div className="flex flex-col w-full md:w-[480px] lg:w-[480px]">
          <div className="flex flex-col items-center gap-4 pt-[60px] md:pt-0 lg:pt-0 pb-8 px-6 md:px-8">
            <div
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, #22C55E, #16A34A)',
                boxShadow: '0 4px 20px #22C55E30',
              }}
            >
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1
              className="font-display text-[26px] font-bold text-text-primary"
              style={{ letterSpacing: -0.5 }}
            >
              이미 완료된 테스트
            </h1>
            <p className="font-display text-sm font-medium text-text-secondary text-center max-w-[300px]">
              이 테스트 코드는 이미 사용되었습니다.
              <br />
              재응시하거나 결과를 확인할 수 있습니다.
            </p>
          </div>

          {/* Warning */}
          <div className="px-6 md:px-8 mb-5">
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <span className="font-display text-[13px] font-medium text-amber-700 leading-relaxed">
                재응시 시 기존 결과는 유지되며 덮어쓰지 않습니다. 새로운 학습 기록이 별도로 저장됩니다.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3 px-6 md:px-8">
            <button
              onClick={handleRestart}
              disabled={isStarting}
              className="flex items-center justify-center gap-2.5 w-full h-14 rounded-2xl text-white transition-opacity disabled:opacity-40"
              style={{
                background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                boxShadow: '0 4px 16px #4F46E540',
              }}
            >
              {isStarting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RotateCcw className="w-5 h-5" />
              )}
              <span className="font-display text-[17px] font-bold">
                {isStarting ? '준비 중...' : '재응시하기'}
              </span>
            </button>

            <button
              onClick={handleViewReport}
              className="flex items-center justify-center gap-2.5 w-full h-14 rounded-2xl transition-opacity"
              style={{
                background: '#F5F4F1',
                border: '1.5px solid #E5E4E1',
              }}
            >
              <BarChart3 className="w-5 h-5 text-text-primary" />
              <span className="font-display text-[17px] font-bold text-text-primary">
                결과 보기
              </span>
            </button>

            <button
              onClick={() => { setCompletedInfo(null); setTestCode(''); }}
              className="font-display text-sm font-medium text-text-tertiary mt-2"
            >
              다른 코드 입력하기
            </button>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-[13px] text-red-500 font-display mt-4 px-6">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

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
          영단어 학습
        </h1>
        <p className="font-display text-sm font-medium text-text-secondary text-center max-w-[300px]">
          선생님이 보내준 학습 코드를 입력하세요
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
        <button
          onClick={() => navigate('/login')}
          className="flex items-center justify-center gap-2 mt-2"
        >
          <LogIn className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="font-display text-sm font-medium text-text-tertiary hover:text-text-secondary transition-colors">
            로그인 화면으로
          </span>
        </button>
      </div>
      </div>{/* end center container */}
    </div>
  );
}

export default TestStartPage;
