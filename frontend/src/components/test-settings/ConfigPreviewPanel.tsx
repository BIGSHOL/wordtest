/**
 * Configuration preview panel - shows current test settings in real-time.
 * Includes inline test name editing and create/assign button.
 */
import { Info } from 'lucide-react';
import type { TestConfigState } from './TestConfigPanel';
import {
  ENGINE_FULL_LABELS,
  SKILL_AREA_OPTIONS,
  SKILL_TO_ENGINES,
} from '../../constants/engineLabels';

interface Props {
  config: TestConfigState;
  selectedStudentCount: number;
  wordCount: number;
  onNameChange: (name: string) => void;
  onAssign: () => void;
  onCreateConfig: () => void;
  canAssign: boolean;
  canCreateConfig: boolean;
  isSubmitting: boolean;
}

// ENGINE_FULL_LABELS, SKILL_AREA_LABELS
// → imported from '../../constants/engineLabels'

export function ConfigPreviewPanel({
  config, selectedStudentCount, wordCount,
  onNameChange, onAssign, onCreateConfig,
  canAssign, canCreateConfig, isSubmitting,
}: Props) {
  const effectiveCount =
    config.questionCount === -1
      ? parseInt(config.customQuestionCount) || 0
      : config.questionCount;

  const effectivePerQuestionTime =
    config.perQuestionTime === -1
      ? parseInt(config.customPerQuestionTime) || 0
      : config.perQuestionTime;

  const effectiveTotalTime =
    config.totalTime === -1
      ? parseInt(config.customTotalTime) * 60 || 0
      : config.totalTime;

  const selectedTypes = config.questionSelectionMode === 'engine'
    ? config.questionTypes
    : config.skillAreas;

  // Compute per-engine question counts (equal or manual distribution)
  const engineCounts: Record<string, number> = (() => {
    if (config.distributionMode === 'manual') return config.manualCounts;
    // Equal distribution
    if (selectedTypes.length === 0) return {};
    const base = Math.floor(effectiveCount / selectedTypes.length);
    const remainder = effectiveCount - base * selectedTypes.length;
    const result: Record<string, number> = {};
    selectedTypes.forEach((t, i) => { result[t] = base + (i < remainder ? 1 : 0); });
    return result;
  })();

  const hasScope = !!(config.bookStart && config.bookEnd && config.lessonStart && config.lessonEnd);
  const scopeText = hasScope
    ? `${config.bookStart} ${config.lessonStart} ~ ${config.bookEnd} ${config.lessonEnd}`
    : '미선택';

  const totalTimeInSeconds = config.timeMode === 'per_question'
    ? effectivePerQuestionTime * effectiveCount
    : effectiveTotalTime;

  const totalMinutes = Math.floor(totalTimeInSeconds / 60);
  const totalSeconds = totalTimeInSeconds % 60;
  const timeText = totalMinutes > 0
    ? `${totalMinutes}분 ${totalSeconds > 0 ? `${totalSeconds}초` : ''}`
    : `${totalSeconds}초`;

  // Auto-generate placeholder name
  const autoName = hasScope
    ? config.bookStart === config.bookEnd
      ? `${config.bookStart} ${config.lessonStart}-${config.lessonEnd}`
      : `${config.bookStart} ${config.lessonStart} ~ ${config.bookEnd} ${config.lessonEnd}`
    : '테스트 이름';

  const hasStudents = selectedStudentCount > 0;

  return (
    <div
      className="h-full rounded-2xl overflow-hidden flex flex-col"
      style={{ border: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 shrink-0"
        style={{ padding: '16px 28px', borderBottom: '1px solid #E8E8E6' }}
      >
        <Info className="w-4 h-4" style={{ color: '#2D9CAE' }} />
        <span className="text-[15px] font-bold text-text-primary">설정 미리보기</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '24px 28px' }}>
        <div className="space-y-4">
          {/* 테스트 이름 - 인라인 편집 */}
          <div>
            <div className="text-[11px] font-semibold text-text-secondary mb-1.5">테스트 이름</div>
            <input
              type="text"
              value={config.configName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={`${autoName} (자동생성)`}
              className="w-full rounded-lg text-[13px] font-semibold text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-[#2D9CAE]/30"
              style={{ padding: '8px 12px', border: '1px solid #E8E8E6', backgroundColor: '#FFFFFF' }}
            />
          </div>

          {/* 학생 수 */}
          <PreviewItem
            label="선택된 학생"
            value={selectedStudentCount > 0 ? `${selectedStudentCount}명` : '테스트만 생성'}
            isEmpty={selectedStudentCount === 0}
          />

          {/* 테스트 엔진 */}
          <PreviewItem
            label="테스트 엔진"
            value={config.engine === 'levelup' ? '레벨업 (적응형)' : '레거시 (고정형)'}
          />

          {/* 출제 범위 */}
          <PreviewItem
            label="출제 범위"
            value={scopeText}
            isEmpty={!hasScope}
          />

          {/* 단어 수 */}
          <PreviewItem
            label="단어 수"
            value={hasScope ? `${wordCount.toLocaleString()}개` : '-'}
            isEmpty={!hasScope}
          />

          {/* 시간 설정 */}
          <PreviewItem
            label="시간 설정"
            value={
              config.timeMode === 'per_question'
                ? `문제당 ${effectivePerQuestionTime}초`
                : `전체 ${Math.floor(effectiveTotalTime / 60)}분`
            }
          />

          {/* 문제 수 */}
          <PreviewItem
            label="문제 수"
            value={`${effectiveCount}문제`}
          />

          {/* 예상 소요 시간 */}
          <PreviewItem
            label="예상 소요 시간"
            value={timeText}
          />

          {/* 문제 유형 - 6대 영역별 그룹 + 문제 수 */}
          <div>
            <div className="text-[11px] font-semibold text-text-secondary mb-2">
              문제 유형
            </div>
            {selectedTypes.length === 0 ? (
              <div className="text-[13px] text-text-tertiary">미선택</div>
            ) : (
              <div className="space-y-2.5">
                {SKILL_AREA_OPTIONS
                  .map((area) => {
                    const engines = SKILL_TO_ENGINES[area.value] || [];
                    // engine 모드: 선택된 엔진만, skill 모드: 해당 영역이 선택되면 전체 엔진
                    const activeEngines = config.questionSelectionMode === 'engine'
                      ? engines.filter(e => config.questionTypes.includes(e))
                      : config.skillAreas.includes(area.value) ? engines : [];
                    if (activeEngines.length === 0) return null;
                    const areaTotal = activeEngines.reduce((sum, e) => sum + (engineCounts[e] ?? 0), 0);
                    return (
                      <div key={area.value}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <span style={{ fontSize: 11 }}>{area.icon}</span>
                            <span className="text-[10px] font-bold text-text-secondary">
                              {area.label}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold" style={{ color: '#2D9CAE' }}>
                            {areaTotal}문제
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {activeEngines.map(e => (
                            <span
                              key={e}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#E6F5F7', color: '#1A7A8A' }}
                            >
                              {ENGINE_FULL_LABELS[e] || e} {engineCounts[e] ?? 0}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - 생성/출제 버튼 */}
      <div
        className="shrink-0 space-y-3"
        style={{ padding: '16px 28px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FFFFFF' }}
      >
        <button
          onClick={hasStudents ? onAssign : onCreateConfig}
          disabled={hasStudents ? (!canAssign || isSubmitting) : (!canCreateConfig || isSubmitting)}
          className="w-full flex items-center justify-center rounded-[10px] text-sm font-semibold text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          style={{
            background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)',
            padding: '12px 24px',
          }}
        >
          {isSubmitting
            ? (hasStudents ? '출제 중...' : '생성 중...')
            : (hasStudents ? '테스트 출제하기' : '테스트 생성하기')
          }
        </button>
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-text-tertiary shrink-0 mt-0.5" />
          <p className="text-[10px] text-text-tertiary leading-relaxed">
            {hasStudents
              ? '선택한 학생에게 테스트가 즉시 출제됩니다'
              : '테스트만 먼저 생성하고, 나중에 학생에게 배정할 수 있습니다'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

function PreviewItem({
  label,
  value,
  isEmpty = false,
}: {
  label: string;
  value: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
      <span
        className={`text-[13px] font-semibold ${isEmpty ? 'text-text-tertiary' : 'text-text-primary'}`}
      >
        {value}
      </span>
    </div>
  );
}
