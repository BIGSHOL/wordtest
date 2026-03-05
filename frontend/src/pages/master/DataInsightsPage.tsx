import { useState } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import {
  masterStatsService,
  type SystemOverview,
  type CalibrationResponse,
  type BadQuestionResponse,
  type ErrorPatternResponse,
  type SrsOptimizationData,
} from '../../services/masterStats';
import {
  Users,
  UserCog,
  BookOpen,
  FileText,
  Database,
  GraduationCap,
  Loader2,
  BarChart3,
  AlertTriangle,
  Microscope,
} from 'lucide-react';
import { logger } from '../../utils/logger';

type TabId = 'overview' | 'calibration' | 'quality' | 'errors' | 'srs';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: '시스템 개요' },
  { id: 'calibration', label: '난이도 보정' },
  { id: 'quality', label: '문제 품질' },
  { id: 'errors', label: '오답 패턴' },
  { id: 'srs', label: 'SRS 데이터' },
];

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <BarChart3 className="w-10 h-10" style={{ color: '#9C9B99' }} />
      <p className="text-sm text-text-tertiary">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#2D9CAE' }} />
      <span className="text-sm text-text-secondary">로딩 중...</span>
    </div>
  );
}

function MiniStatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white border border-[#E8E8E6] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div style={{ backgroundColor: iconBg, padding: 10, borderRadius: 12 }}>
          <Icon style={{ color: iconColor }} className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium text-[#9C9B99]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[#3D3D3C]">{value.toLocaleString()}</p>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: number }) {
  let bg = '#DCFCE7';
  let color = '#16A34A';
  let label = '기본';
  if (difficulty === 2) { bg = '#FEF3C7'; color = '#D97706'; label = '중급'; }
  else if (difficulty >= 3) { bg = '#FEE2E2'; color = '#DC2626'; label = '고급'; }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}

function GapBadge({ gap }: { gap: number }) {
  let bg = '#DCFCE7';
  let color = '#16A34A';
  if (gap >= 2) { bg = '#FEE2E2'; color = '#DC2626'; }
  else if (gap >= 1) { bg = '#FEF3C7'; color = '#D97706'; }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {gap >= 0 ? `+${gap}` : `${gap}`}
    </span>
  );
}

function AccuracyBar({ pct, color = '#2D9CAE' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F5F4F1' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-medium w-10 text-right shrink-0" style={{ color: '#6D6C6A' }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function HorizontalBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F5F4F1' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-medium w-12 text-right shrink-0" style={{ color: '#6D6C6A' }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function FlagBadge({ reason }: { reason: string }) {
  let bg = '#DCFCE7';
  let color = '#16A34A';
  let label = reason;
  if (reason === 'extreme_easy') { bg = '#DCFCE7'; color = '#16A34A'; label = '너무 쉬움'; }
  else if (reason === 'extreme_hard') { bg = '#FEE2E2'; color = '#DC2626'; label = '너무 어려움'; }
  else if (reason === 'extreme_slow') { bg = '#FEF3C7'; color = '#D97706'; label = '혼동 유발'; }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}

// --- Tab Sections ---

function OverviewSection({ data }: { data: SystemOverview }) {
  const totalSessions = data.total_learning_sessions + data.total_grammar_sessions;
  const totalAnswers = data.total_learning_answers + data.total_grammar_answers;

  const maxDaily = Math.max(
    ...data.daily_growth.map(d => d.learning_sessions + d.grammar_sessions),
    1,
  );

  return (
    <div className="space-y-6">
      {/* Row 1 */}
      <div className="grid grid-cols-4 gap-4">
        <MiniStatCard icon={Users} label="총 학생 수" value={data.total_students} iconBg="#EBF8FA" iconColor="#2D9CAE" />
        <MiniStatCard icon={UserCog} label="총 선생님 수" value={data.total_teachers} iconBg="#EEF2FF" iconColor="#4F46E5" />
        <MiniStatCard icon={BookOpen} label="총 세션 수" value={totalSessions} iconBg="#F0FDF4" iconColor="#16A34A" />
        <MiniStatCard icon={FileText} label="총 답변 수" value={totalAnswers} iconBg="#FFFBEB" iconColor="#D97706" />
      </div>
      {/* Row 2 */}
      <div className="grid grid-cols-4 gap-4">
        <MiniStatCard icon={Database} label="총 단어 수" value={data.total_words} iconBg="#EFF6FF" iconColor="#2563EB" />
        <MiniStatCard icon={GraduationCap} label="총 문법 문제 수" value={data.total_grammar_questions} iconBg="#EEF2FF" iconColor="#4F46E5" />
        <MiniStatCard icon={BookOpen} label="단어 세션" value={data.total_learning_sessions} iconBg="#F0FDF4" iconColor="#16A34A" />
        <MiniStatCard icon={BookOpen} label="문법 세션" value={data.total_grammar_sessions} iconBg="#FFF7ED" iconColor="#EA580C" />
      </div>

      {/* 30-day growth bar chart */}
      <div className="bg-white border border-[#E8E8E6] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[15px] font-bold text-[#3D3D3C]">30일 세션 성장</h2>
          <span className="px-3 py-1 rounded-full bg-[#EBF8FA] text-[11px] font-medium text-[#2D9CAE]">
            최근 30일
          </span>
        </div>
        {data.daily_growth.length === 0 ? (
          <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
        ) : (
          <div className="flex items-end gap-1" style={{ height: 140 }}>
            {data.daily_growth.map((day, i) => {
              const total = day.learning_sessions + day.grammar_sessions;
              const barH = maxDaily > 0 ? Math.max((total / maxDaily) * 120, total > 0 ? 4 : 0) : 0;
              const dateLabel = new Date(day.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${dateLabel}: ${total}건`}>
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: barH,
                      background: 'linear-gradient(180deg, #2D9CAE 0%, #3DBDC8 100%)',
                      minHeight: total > 0 ? 2 : 0,
                    }}
                  />
                  {i % 5 === 0 && (
                    <span className="text-[9px] text-[#9C9B99]" style={{ whiteSpace: 'nowrap' }}>
                      {dateLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CalibrationSection({ data }: { data: CalibrationResponse }) {
  const [subTab, setSubTab] = useState<'word' | 'grammar'>('word');

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle */}
      <div className="flex gap-2">
        {(['word', 'grammar'] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              backgroundColor: subTab === t ? '#2D9CAE' : '#F5F4F1',
              color: subTab === t ? '#fff' : '#6D6C6A',
            }}
          >
            {t === 'word' ? '단어' : '문법'}
          </button>
        ))}
      </div>

      {subTab === 'word' ? (
        <div className="bg-white border border-[#E8E8E6] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E8E8E6]">
            <h2 className="text-[15px] font-bold text-[#3D3D3C]">단어 난이도 보정 목록</h2>
          </div>
          {data.word_calibrations.length === 0 ? (
            <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #E8E8E6', height: 36 }}>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] pl-6 pr-2">#</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">단어</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">뜻</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">교재</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">레벨</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 min-w-[120px]">정답률</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">제안</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 pr-6">갭</th>
                  </tr>
                </thead>
                <tbody>
                  {data.word_calibrations.map((item, i) => (
                    <tr key={item.word_id} style={{ borderBottom: '1px solid #F0F0EE', height: 44 }} className="hover:bg-[#F8F8F6] transition-colors">
                      <td className="text-[12px] text-[#9C9B99] pl-6 pr-2">{i + 1}</td>
                      <td className="text-[12px] font-medium text-[#3D3D3C] px-2 whitespace-nowrap">{item.english}</td>
                      <td className="text-[12px] text-[#6D6C6A] px-2 whitespace-nowrap" style={{ maxWidth: 80 }}>{item.korean}</td>
                      <td className="text-[12px] text-[#6D6C6A] px-2 whitespace-nowrap" style={{ maxWidth: 100 }}>{item.book_name}</td>
                      <td className="text-[12px] text-[#6D6C6A] px-2">{item.curriculum_level}</td>
                      <td className="px-2" style={{ minWidth: 120 }}>
                        <AccuracyBar pct={item.actual_accuracy * 100} />
                      </td>
                      <td className="text-[12px] text-[#6D6C6A] px-2">{item.suggested_level}</td>
                      <td className="px-2 pr-6">
                        <GapBadge gap={item.gap} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E6] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E8E8E6]">
            <h2 className="text-[15px] font-bold text-[#3D3D3C]">문법 난이도 보정 목록</h2>
          </div>
          {data.grammar_calibrations.length === 0 ? (
            <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #E8E8E6', height: 36 }}>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] pl-6 pr-2">#</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">유형</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">교재/챕터</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">난이도</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 min-w-[120px]">정답률</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">제안</th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 pr-6">갭</th>
                  </tr>
                </thead>
                <tbody>
                  {data.grammar_calibrations.map((item, i) => (
                    <tr key={item.question_id} style={{ borderBottom: '1px solid #F0F0EE', height: 44 }} className="hover:bg-[#F8F8F6] transition-colors">
                      <td className="text-[12px] text-[#9C9B99] pl-6 pr-2">{i + 1}</td>
                      <td className="text-[12px] text-[#6D6C6A] px-2 whitespace-nowrap">{item.question_type_label}</td>
                      <td className="px-2" style={{ maxWidth: 180 }}>
                        <div className="text-[12px] font-medium text-[#3D3D3C] truncate">{item.book_title}</div>
                        <div className="text-[11px] text-[#9C9B99] truncate">{item.chapter_title}</div>
                      </td>
                      <td className="px-2">
                        <DifficultyBadge difficulty={item.assigned_difficulty} />
                      </td>
                      <td className="px-2" style={{ minWidth: 120 }}>
                        <AccuracyBar pct={item.actual_accuracy * 100} />
                      </td>
                      <td className="px-2">
                        <DifficultyBadge difficulty={item.suggested_difficulty} />
                      </td>
                      <td className="px-2 pr-6">
                        <GapBadge gap={item.gap} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QualitySection({ data }: { data: BadQuestionResponse }) {
  return (
    <div className="space-y-6">
      {/* Grammar issues */}
      <div className="bg-white border border-[#E8E8E6] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8E8E6] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: '#D97706' }} />
          <h2 className="text-[15px] font-bold text-[#3D3D3C]">문법 문제 품질 이슈</h2>
          <span className="ml-auto px-3 py-1 rounded-full bg-[#FEF3C7] text-[11px] font-medium text-[#D97706]">
            {data.grammar_issues.length}건
          </span>
        </div>
        {data.grammar_issues.length === 0 ? (
          <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #E8E8E6', height: 36 }}>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] pl-6 pr-2">#</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">유형</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">교재/챕터</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">난이도</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 min-w-[120px]">정답률</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">시도 수</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 pr-6">이슈 유형</th>
                </tr>
              </thead>
              <tbody>
                {data.grammar_issues.map((item, i) => (
                  <tr key={item.question_id} style={{ borderBottom: '1px solid #F0F0EE', height: 44 }} className="hover:bg-[#F8F8F6] transition-colors">
                    <td className="text-[12px] text-[#9C9B99] pl-6 pr-2">{i + 1}</td>
                    <td className="text-[12px] text-[#6D6C6A] px-2 whitespace-nowrap">{item.question_type_label}</td>
                    <td className="px-2" style={{ maxWidth: 180 }}>
                      <div className="text-[12px] font-medium text-[#3D3D3C] truncate">{item.book_title}</div>
                      <div className="text-[11px] text-[#9C9B99] truncate">{item.chapter_title}</div>
                    </td>
                    <td className="px-2">
                      <DifficultyBadge difficulty={item.difficulty} />
                    </td>
                    <td className="px-2" style={{ minWidth: 120 }}>
                      <AccuracyBar pct={item.accuracy * 100} color="#EF4444" />
                    </td>
                    <td className="text-[12px] text-[#6D6C6A] px-2">{item.attempt_count.toLocaleString()}</td>
                    <td className="px-2 pr-6">
                      <FlagBadge reason={item.flag_reason} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Word issues */}
      <div className="bg-white border border-[#E8E8E6] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8E8E6] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: '#EF4444' }} />
          <h2 className="text-[15px] font-bold text-[#3D3D3C]">단어 품질 이슈</h2>
          <span className="ml-auto px-3 py-1 rounded-full bg-[#FEE2E2] text-[11px] font-medium text-[#DC2626]">
            {data.word_issues.length}건
          </span>
        </div>
        {data.word_issues.length === 0 ? (
          <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #E8E8E6', height: 36 }}>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] pl-6 pr-2">#</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">단어</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">뜻</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">교재</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">레벨</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 min-w-[120px]">정답률</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">시도 수</th>
                  <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 pr-6">이슈 유형</th>
                </tr>
              </thead>
              <tbody>
                {data.word_issues.map((item, i) => (
                  <tr key={item.word_id} style={{ borderBottom: '1px solid #F0F0EE', height: 44 }} className="hover:bg-[#F8F8F6] transition-colors">
                    <td className="text-[12px] text-[#9C9B99] pl-6 pr-2">{i + 1}</td>
                    <td className="text-[12px] font-medium text-[#3D3D3C] px-2 whitespace-nowrap">{item.english}</td>
                    <td className="text-[12px] text-[#6D6C6A] px-2 whitespace-nowrap" style={{ maxWidth: 80 }}>{item.korean}</td>
                    <td className="text-[12px] text-[#6D6C6A] px-2 whitespace-nowrap" style={{ maxWidth: 100 }}>{item.book_name}</td>
                    <td className="text-[12px] text-[#6D6C6A] px-2">{item.curriculum_level}</td>
                    <td className="px-2" style={{ minWidth: 120 }}>
                      <AccuracyBar pct={item.accuracy * 100} color="#EF4444" />
                    </td>
                    <td className="text-[12px] text-[#6D6C6A] px-2">{item.attempt_count.toLocaleString()}</td>
                    <td className="px-2 pr-6">
                      <FlagBadge reason={item.flag_reason} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorPatternsSection({ data }: { data: ErrorPatternResponse }) {
  const maxConfusion = Math.max(...data.confused_word_pairs.map(p => p.confusion_count), 1);
  const maxWordAcc = Math.max(...data.word_question_type_breakdown.map(q => q.total), 1);
  const maxGrammarAcc = Math.max(...data.grammar_question_type_breakdown.map(q => q.total), 1);

  return (
    <div className="space-y-6">
      {/* Confused pairs */}
      <div className="bg-white border border-[#E8E8E6] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8E8E6]">
          <h2 className="text-[15px] font-bold text-[#3D3D3C]">혼동 단어 쌍</h2>
        </div>
        {data.confused_word_pairs.length === 0 ? (
          <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #E8E8E6', height: 36 }}>
                <th className="text-left text-[11px] font-semibold text-[#9C9B99] pl-6 pr-2">#</th>
                <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">정답</th>
                <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">오답 선택</th>
                <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 pr-6 min-w-[160px]">혼동 횟수</th>
              </tr>
            </thead>
            <tbody>
              {data.confused_word_pairs.map((pair, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F0F0EE', height: 44 }} className="hover:bg-[#F8F8F6] transition-colors">
                  <td className="text-[12px] text-[#9C9B99] pl-6 pr-2">{i + 1}</td>
                  <td className="text-[12px] font-medium text-[#3D3D3C] px-2">{pair.correct_answer}</td>
                  <td className="text-[12px] text-[#EF4444] px-2">{pair.wrong_answer}</td>
                  <td className="px-2 pr-6" style={{ minWidth: 160 }}>
                    <HorizontalBar value={pair.confusion_count} max={maxConfusion} color="#EF4444" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Word engine breakdown */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white border border-[#E8E8E6] rounded-2xl p-6">
          <h2 className="text-[15px] font-bold text-[#3D3D3C] mb-4">단어 문제 유형별 정확도</h2>
          {data.word_question_type_breakdown.length === 0 ? (
            <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
          ) : (
            <div className="space-y-3">
              {data.word_question_type_breakdown.map(q => (
                <div key={q.question_type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-[#3D3D3C]">{q.label}</span>
                    <span className="text-[11px] text-[#9C9B99]">{q.total.toLocaleString()}건</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F5F4F1' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(q.accuracy_pct, 100)}%`, backgroundColor: '#2D9CAE' }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold w-10 text-right shrink-0" style={{ color: '#2D9CAE' }}>
                      {Math.round(q.accuracy_pct)}%
                    </span>
                  </div>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden mt-1" style={{ backgroundColor: '#F5F4F1' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(q.total / maxWordAcc) * 100}%`, backgroundColor: '#E8E8E6' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E8E8E6] rounded-2xl p-6">
          <h2 className="text-[15px] font-bold text-[#3D3D3C] mb-4">문법 문제 유형별 정확도</h2>
          {data.grammar_question_type_breakdown.length === 0 ? (
            <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
          ) : (
            <div className="space-y-3">
              {data.grammar_question_type_breakdown.map(q => (
                <div key={q.question_type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-[#3D3D3C]">{q.label}</span>
                    <span className="text-[11px] text-[#9C9B99]">{q.total.toLocaleString()}건</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F5F4F1' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(q.accuracy_pct, 100)}%`, backgroundColor: '#4F46E5' }}
                      />
                    </div>
                    <span className="text-[12px] font-semibold w-10 text-right shrink-0" style={{ color: '#4F46E5' }}>
                      {Math.round(q.accuracy_pct)}%
                    </span>
                  </div>
                  <div className="flex-1 h-2.5 rounded-full overflow-hidden mt-1" style={{ backgroundColor: '#F5F4F1' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(q.total / maxGrammarAcc) * 100}%`, backgroundColor: '#E8E8E6' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STAGE_NAMES: Record<number, string> = { 1: '1단계', 2: '2단계', 3: '3단계', 4: '4단계', 5: '마스터' };
const STAGE_COLORS: Record<number, string> = {
  1: '#16A34A',
  2: '#2563EB',
  3: '#7C3AED',
  4: '#EA580C',
  5: '#DC2626',
};

function SrsSection({ data }: { data: SrsOptimizationData }) {
  const maxStageCount = Math.max(...data.stage_distribution.map(s => s.count), 1);

  return (
    <div className="space-y-6">
      {/* Total mastered */}
      <div className="bg-white border border-[#E8E8E6] rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div style={{ backgroundColor: '#FEE2E2', padding: 12, borderRadius: 14 }}>
            <GraduationCap style={{ color: '#DC2626' }} className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-[#9C9B99]">총 마스터 단어 수</p>
            <p className="text-3xl font-bold text-[#3D3D3C]">{data.total_mastered.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Stage distribution */}
        <div className="bg-white border border-[#E8E8E6] rounded-2xl p-6">
          <h2 className="text-[15px] font-bold text-[#3D3D3C] mb-5">단계별 단어 분포</h2>
          {data.stage_distribution.length === 0 ? (
            <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
          ) : (
            <div className="space-y-3">
              {data.stage_distribution
                .sort((a, b) => a.stage - b.stage)
                .map(s => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="text-[12px] font-medium text-[#6D6C6A] w-14 shrink-0">
                      {STAGE_NAMES[s.stage] ?? `${s.stage}단계`}
                    </span>
                    <div className="flex-1 h-5 rounded-[10px] overflow-hidden" style={{ backgroundColor: '#F5F4F1' }}>
                      <div
                        className="h-full rounded-[10px] flex items-center justify-end pr-2"
                        style={{
                          width: `${(s.count / maxStageCount) * 100}%`,
                          backgroundColor: STAGE_COLORS[s.stage] ?? '#6D6C6A',
                        }}
                      >
                        {s.count > 0 && (
                          <span className="text-[10px] font-bold text-white">{s.count.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[12px] text-[#6D6C6A] w-16 text-right shrink-0">
                      {s.count.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Avg days per stage */}
        <div className="bg-white border border-[#E8E8E6] rounded-2xl p-6">
          <h2 className="text-[15px] font-bold text-[#3D3D3C] mb-5">단계별 평균 체류 기간</h2>
          {data.avg_days_per_stage.length === 0 ? (
            <EmptyState message="충분한 데이터가 쌓이면 분석 결과가 표시됩니다" />
          ) : (
            <div className="space-y-3">
              {data.avg_days_per_stage
                .sort((a, b) => a.stage - b.stage)
                .map(s => (
                  <div key={s.stage} className="flex items-center justify-between py-2 border-b border-[#F0F0EE] last:border-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: STAGE_COLORS[s.stage] ?? '#6D6C6A' }}
                      />
                      <span className="text-[13px] font-medium text-[#3D3D3C]">
                        {STAGE_NAMES[s.stage] ?? `${s.stage}단계`}
                      </span>
                    </div>
                    <span className="text-[15px] font-bold" style={{ color: STAGE_COLORS[s.stage] ?? '#6D6C6A' }}>
                      {s.avg_days.toFixed(1)}일
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Placeholder */}
      <div className="bg-white border border-[#E8E8E6] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Microscope className="w-4 h-4" style={{ color: '#9C9B99' }} />
          <h2 className="text-[15px] font-bold text-[#3D3D3C]">복습 리텐션 분석</h2>
        </div>
        <p className="text-sm text-[#9C9B99]">복습 리텐션 분석은 향후 업데이트 예정입니다.</p>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function DataInsightsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const [overviewData, setOverviewData] = useState<SystemOverview | null>(null);
  const [calibrationData, setCalibrationData] = useState<CalibrationResponse | null>(null);
  const [qualityData, setQualityData] = useState<BadQuestionResponse | null>(null);
  const [errorData, setErrorData] = useState<ErrorPatternResponse | null>(null);
  const [srsData, setSrsData] = useState<SrsOptimizationData | null>(null);

  const [loadingTabs, setLoadingTabs] = useState<Set<TabId>>(new Set());
  const [loadedTabs, setLoadedTabs] = useState<Set<TabId>>(new Set());
  const [errorTabs, setErrorTabs] = useState<Set<TabId>>(new Set());

  const fetchTab = async (tab: TabId) => {
    if (loadedTabs.has(tab) || loadingTabs.has(tab)) return;

    setLoadingTabs(prev => new Set(prev).add(tab));
    setErrorTabs(prev => { const s = new Set(prev); s.delete(tab); return s; });

    try {
      switch (tab) {
        case 'overview': {
          const data = await masterStatsService.getOverview();
          setOverviewData(data);
          break;
        }
        case 'calibration': {
          const data = await masterStatsService.getCalibration();
          setCalibrationData(data);
          break;
        }
        case 'quality': {
          const data = await masterStatsService.getBadQuestions();
          setQualityData(data);
          break;
        }
        case 'errors': {
          const data = await masterStatsService.getErrorPatterns();
          setErrorData(data);
          break;
        }
        case 'srs': {
          const data = await masterStatsService.getSrsData();
          setSrsData(data);
          break;
        }
      }
      setLoadedTabs(prev => new Set(prev).add(tab));
    } catch (err) {
      logger.error(`Failed to fetch tab ${tab}:`, err);
      setErrorTabs(prev => new Set(prev).add(tab));
    } finally {
      setLoadingTabs(prev => { const s = new Set(prev); s.delete(tab); return s; });
    }
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    fetchTab(tab);
  };

  // Load first tab on mount
  useState(() => { fetchTab('overview'); });

  const isLoading = loadingTabs.has(activeTab);
  const hasError = errorTabs.has(activeTab);

  function renderTabContent() {
    if (isLoading) return <LoadingState />;
    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle className="w-10 h-10" style={{ color: '#D97706' }} />
          <p className="text-sm text-[#6D6C6A]">데이터를 불러오지 못했습니다.</p>
          <button
            onClick={() => {
              setLoadedTabs(prev => { const s = new Set(prev); s.delete(activeTab); return s; });
              fetchTab(activeTab);
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
          >
            다시 시도
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return overviewData ? <OverviewSection data={overviewData} /> : null;
      case 'calibration':
        return calibrationData ? <CalibrationSection data={calibrationData} /> : null;
      case 'quality':
        return qualityData ? <QualitySection data={qualityData} /> : null;
      case 'errors':
        return errorData ? <ErrorPatternsSection data={errorData} /> : null;
      case 'srs':
        return srsData ? <SrsSection data={srsData} /> : null;
      default:
        return null;
    }
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#3D3D3C] mb-1">데이터 인사이트</h1>
            <p className="text-[13px] text-[#6D6C6A]">시스템 전체 학습 데이터 분석</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all"
              style={{
                backgroundColor: activeTab === tab.id ? '#2D9CAE' : '#F5F4F1',
                color: activeTab === tab.id ? '#fff' : '#6D6C6A',
              }}
            >
              {tab.label}
              {loadingTabs.has(tab.id) && (
                <Loader2
                  className="inline-block ml-1.5 w-3 h-3 animate-spin"
                  style={{ verticalAlign: 'middle' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>{renderTabContent()}</div>
      </div>
    </TeacherLayout>
  );
}
