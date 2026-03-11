/**
 * Update log page — displays version history organized by audience tabs.
 * Accessible to all authenticated roles.
 */
import { History, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

type AudienceTab = 'teacher' | 'student' | 'admin' | 'external';

interface UpdateEntry {
  date: string;
  version?: string;
  items: { text: string; tag?: 'new' | 'fix' | 'improve' }[];
}

const TAG_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  new: { label: '신규', bg: '#EBF8FA', color: '#2D9CAE' },
  fix: { label: '수정', bg: '#FEF2F2', color: '#EF4444' },
  improve: { label: '개선', bg: '#F0FDF4', color: '#16A34A' },
};

const ROLE_TAB_MAP: Record<string, AudienceTab> = {
  teacher: 'teacher',
  student: 'student',
  master: 'admin',
};

const ROLE_LABEL: Record<AudienceTab, string> = {
  teacher: '선생님',
  student: '학생',
  admin: '어드민',
  external: '외부',
};

// ────────────────────────────────────────────────
//  UPDATE DATA (커밋 기반 정리)
// ────────────────────────────────────────────────

const UPDATES: Record<AudienceTab, UpdateEntry[]> = {
  teacher: [
    {
      date: '2026-03-11',
      version: 'v2.8',
      items: [
        { text: '대시보드 / 생성된 테스트 / 출제 현황에 출제자·시험제목 컬럼 추가', tag: 'new' },
        { text: '능률 VOCA 전용 레벨테스트 리포트 (4단계 차트 + Step 뱃지)', tag: 'new' },
        { text: '교재 선택 드롭다운 시리즈별 대분류 구분 (optgroup)', tag: 'improve' },
      ],
    },
    {
      date: '2026-03-10',
      version: 'v2.7',
      items: [
        { text: '능률 VOCA 4개 교재 시리즈 탭 필터 UI 추가', tag: 'new' },
        { text: 'POWER VOCA 탭 하나로 합체 + 시리즈 탭 필터링 쿼리 반영', tag: 'fix' },
        { text: '학생 xlsx 일괄 업로드 기능', tag: 'new' },
      ],
    },
    {
      date: '2026-03-07',
      version: 'v2.6',
      items: [
        { text: '더미 데이터 500건 시드 + [DUMMY] 태그 체계 적용', tag: 'improve' },
        { text: '통계 API teacher_id 제한 제거 — 모든 학생 결과 조회 가능', tag: 'improve' },
        { text: '학생/과제 삭제 시 리포트 보존 (CASCADE → SET NULL)', tag: 'fix' },
        { text: '동학년 평균 동적화 + 다양한 더미 학생 시드', tag: 'improve' },
      ],
    },
    {
      date: '2026-03-05',
      version: 'v2.5',
      items: [
        { text: '문법 문제 관리 UI — 인라인 편집/미리보기/검증/비활성화', tag: 'new' },
        { text: '문법 카드 UX 개선 — 다중 빈칸 미리보기, 단어 배열 클릭', tag: 'improve' },
        { text: '문법 테스트 per-question 모드 자동 제출', tag: 'improve' },
        { text: '문법 문제 보기 4개 미만 필터링 + 번호 뱃지 추가', tag: 'fix' },
      ],
    },
    {
      date: '2026-03-03',
      version: 'v2.4',
      items: [
        { text: '단어/문법 위저드 단계 통일 + 유형별 배분 적용', tag: 'improve' },
        { text: '문법 PDF 추출 1,119문항 + AI 채점 시스템', tag: 'new' },
        { text: '전체 테스트 결과 — 단어/문법/레벨 필터 분리', tag: 'improve' },
        { text: '문법/단어 출제현황 테이블 통일', tag: 'improve' },
        { text: '문법 테스트 타이머 추가 (total/per_question 모드)', tag: 'new' },
      ],
    },
    {
      date: '2026-02-28',
      version: 'v2.3',
      items: [
        { text: '6대축 동적 평균 + 문법 리포트 + 더미 시드 스크립트', tag: 'new' },
        { text: 'EMOJI_MAP 확장 + Noto SVG 렌더링 + 이모지 필터', tag: 'improve' },
        { text: '이모지/반의어 등 제한적 유형 — 전체 범위에서 강제 매칭', tag: 'fix' },
      ],
    },
    {
      date: '2026-02-25',
      version: 'v2.2',
      items: [
        { text: '유형별 프롬프트 다양화 + 출제 순서를 교사 설정 순서대로 적용', tag: 'improve' },
        { text: '레벨업 과속 방지 — 5연속 정답 조건 + 오답 시 감점 제거', tag: 'fix' },
        { text: '유형별 문제 할당 시 호환 단어만 사용 + 출제 순서 보존', tag: 'fix' },
      ],
    },
  ],
  student: [
    {
      date: '2026-03-11',
      version: 'v2.8',
      items: [
        { text: '능률 VOCA 레벨테스트 결과 리포트 전용 UI (4단계 차트)', tag: 'new' },
      ],
    },
    {
      date: '2026-03-10',
      version: 'v2.7',
      items: [
        { text: '적응형 레벨테스트 XP 공식 복원 + 레벨별 문제 풀 분리', tag: 'fix' },
        { text: '적응형 레벨테스트 레벨업 시 문제 풀 전환 버그 수정', tag: 'fix' },
      ],
    },
    {
      date: '2026-03-05',
      version: 'v2.5',
      items: [
        { text: '문법 카드 다중 빈칸 미리보기, 단어 배열 클릭 UX 개선', tag: 'improve' },
        { text: '문법 테스트 per-question 자동 제출 지원', tag: 'improve' },
        { text: '정답 선택 후 1초 뒤 자동 다음 문제 이동', tag: 'improve' },
      ],
    },
    {
      date: '2026-03-03',
      version: 'v2.4',
      items: [
        { text: '문법 테스트 타이머 추가 (총시간/문제당 모드)', tag: 'new' },
        { text: 'AI 채점으로 영작/문장전환 자동 평가', tag: 'new' },
      ],
    },
    {
      date: '2026-02-28',
      version: 'v2.3',
      items: [
        { text: 'Noto SVG 이모지 렌더링 개선', tag: 'improve' },
        { text: '레벨테스트 적응형 문제 유형 순서 보존', tag: 'fix' },
      ],
    },
    {
      date: '2026-02-25',
      version: 'v2.2',
      items: [
        { text: '유형별 프롬프트 다양화 — 더 자연스러운 문제 지시문', tag: 'improve' },
        { text: '레벨업 과속 방지 — 5연속 정답 조건 적용', tag: 'fix' },
      ],
    },
  ],
  admin: [
    {
      date: '2026-03-11',
      version: 'v2.8',
      items: [
        { text: '능률 VOCA 더미 리포트 시딩 스크립트 추가', tag: 'new' },
        { text: 'Backend RecentTest/TestConfig/TestAssignment에 teacher_name 필드 추가', tag: 'improve' },
      ],
    },
    {
      date: '2026-03-10',
      version: 'v2.7',
      items: [
        { text: '능률 VOCA 4개 교재 임포트 + 시리즈 탭 필터 API', tag: 'new' },
        { text: '더미 데이터 [DUMMY] 태그 체계 + 일괄 삭제/재생성 스크립트', tag: 'improve' },
        { text: 'xlsx 일괄 업로드 API (학생 배치 등록)', tag: 'new' },
      ],
    },
    {
      date: '2026-03-07',
      version: 'v2.6',
      items: [
        { text: '마스터계정 전용 데이터 인사이트 페이지', tag: 'new' },
        { text: 'RLS 전체 테이블 활성화 — Supabase Security Advisor 에러 해결', tag: 'fix' },
        { text: 'bcrypt 4.0.1 고정 + passlib 호환성 확보', tag: 'fix' },
        { text: 'alembic_version 테이블 RLS 누락 추가', tag: 'fix' },
      ],
    },
    {
      date: '2026-03-05',
      version: 'v2.5',
      items: [
        { text: '문법 PDF 추출 스크립트 (1,119문항 자동 변환)', tag: 'new' },
        { text: 'grammar.py Annotated+Depends 충돌 — Railway 배포 실패 수정', tag: 'fix' },
      ],
    },
    {
      date: '2026-03-03',
      version: 'v2.4',
      items: [
        { text: 'CASCADE → SET NULL 마이그레이션 (리포트 보존)', tag: 'improve' },
        { text: 'stats 엔드포인트 teacher_id 제한 전면 제거', tag: 'improve' },
        { text: '레벨테스트 출제현황 teacher_id 필터 제거', tag: 'fix' },
      ],
    },
  ],
  external: [
    {
      date: '2026-03-11',
      version: 'v2.8',
      items: [
        { text: '능률 VOCA 전용 레벨테스트 리포트 지원', tag: 'new' },
        { text: '대시보드에 출제자·시험제목 정보 표시', tag: 'new' },
        { text: '교재 선택 UI 시리즈별 분류 개선', tag: 'improve' },
      ],
    },
    {
      date: '2026-03-10',
      version: 'v2.7',
      items: [
        { text: '능률 VOCA 중등 4개 교재 시리즈 추가', tag: 'new' },
        { text: '학생 엑셀 일괄 업로드 기능', tag: 'new' },
        { text: '적응형 레벨테스트 안정성 개선', tag: 'fix' },
      ],
    },
    {
      date: '2026-03-07',
      version: 'v2.6',
      items: [
        { text: '데이터 인사이트 (마스터 전용 분석 도구)', tag: 'new' },
        { text: '보안 강화 — 전체 DB Row-Level Security 적용', tag: 'improve' },
      ],
    },
    {
      date: '2026-03-05',
      version: 'v2.5',
      items: [
        { text: '문법 문제 DB 관리 시스템 (편집/미리보기/검증)', tag: 'new' },
        { text: '문법 카드 사용성 대폭 개선', tag: 'improve' },
      ],
    },
    {
      date: '2026-03-03',
      version: 'v2.4',
      items: [
        { text: '문법 테스트 시스템 정식 출시 (8종 유형 + 타이머 + AI 채점)', tag: 'new' },
        { text: '단어/문법 통합 테스트 결과 페이지', tag: 'new' },
      ],
    },
    {
      date: '2026-02-28',
      version: 'v2.3',
      items: [
        { text: '6대축 역량 분석 리포트', tag: 'new' },
        { text: '이모지 연상 문제 유형 추가', tag: 'new' },
      ],
    },
    {
      date: '2026-02-25',
      version: 'v2.2',
      items: [
        { text: '적응형 XP 레벨 시스템 도입', tag: 'new' },
        { text: '문제 유형별 커스텀 배분 기능', tag: 'new' },
      ],
    },
  ],
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export default function UpdateLogPage() {
  const { user } = useAuthStore();
  const tab: AudienceTab = ROLE_TAB_MAP[user?.role ?? ''] ?? 'external';
  const entries = UPDATES[tab];
  const label = ROLE_LABEL[tab];

  return (
    <div className="min-h-screen bg-[#F8F8F6]">
      <div className="max-w-[860px] mx-auto py-10 px-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)' }}>
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0D0D0D]">업데이트 내역</h1>
            <p className="text-xs text-[#7A7A7A]">{label}용 WordTest 변경사항</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-0">
          {entries.map((entry, idx) => (
            <div key={`${entry.date}-${idx}`} className="relative flex gap-5">
              {/* Timeline line */}
              <div className="flex flex-col items-center shrink-0 w-3">
                <div className="w-3 h-3 rounded-full bg-[#2D9CAE] border-2 border-white shadow-sm mt-1.5 shrink-0" />
                {idx < entries.length - 1 && <div className="w-px flex-1 bg-[#E8E8E6]" />}
              </div>

              {/* Content card */}
              <div className="flex-1 pb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-bold text-[#0D0D0D]">{formatDate(entry.date)}</span>
                  {entry.version && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
                    >
                      {entry.version}
                    </span>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-[#E8E8E6] p-4 space-y-2.5">
                  {entry.items.map((item, j) => {
                    const tagStyle = item.tag ? TAG_STYLE[item.tag] : null;
                    return (
                      <div key={j} className="flex items-start gap-2.5">
                        <ChevronRight className="w-3.5 h-3.5 text-[#C0BFBD] mt-0.5 shrink-0" />
                        {tagStyle && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-px"
                            style={{ backgroundColor: tagStyle.bg, color: tagStyle.color }}
                          >
                            {tagStyle.label}
                          </span>
                        )}
                        <span className="text-sm text-[#3D3C3A] leading-snug">{item.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
