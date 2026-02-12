import { useState } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';

type Tab = 'difficulty' | 'grade';

const TABS: { key: Tab; label: string; desc: string; src: string }[] = [
  {
    key: 'difficulty',
    label: '난이도 분석',
    desc: '15개 교재의 난이도 심층 분석',
    src: '/analysis/difficulty_analysis.html',
  },
  {
    key: 'grade',
    label: '학년 매칭',
    desc: '난이도 기반 추천 학년 매칭',
    src: '/analysis/grade_matching.html',
  },
];

export function AnalysisPage() {
  const [activeTab, setActiveTab] = useState<Tab>('difficulty');
  const current = TABS.find((t) => t.key === activeTab)!;

  return (
    <TeacherLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
            분석
          </h1>
          <p className="text-[13px] text-text-secondary">
            교재 난이도 데이터와 학년별 매칭 분석을 확인합니다
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? '#EBF8FA' : '#F5F4F1',
                  color: isActive ? '#2D9CAE' : '#6D6C6A',
                  border: isActive ? '1.5px solid #2D9CAE' : '1px solid #E8E8E6',
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Iframe container */}
        <div
          className="bg-white border border-border-subtle rounded-2xl overflow-hidden"
          style={{ minHeight: 'calc(100vh - 220px)' }}
        >
          <iframe
            key={current.key}
            src={current.src}
            title={current.label}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 220px)', minHeight: 600 }}
          />
        </div>
      </div>
    </TeacherLayout>
  );
}

export default AnalysisPage;
