---
name: verify-frontend-routes
description: 프론트엔드 Route-Page-Nav-Store-Service 간 참조 일관성을 검증합니다. 페이지 추가/라우트 변경 후 사용.
---

# 프론트엔드 라우트 일관성 검증

## Purpose

1. **Route → Page 매핑** — App.tsx의 모든 라우트가 실제 존재하는 페이지 컴포넌트를 참조하는지 검증
2. **Nav → Route 동기화** — TeacherLayout 네비게이션 항목이 App.tsx 라우트와 일치하는지 검증
3. **LazyRetry 경로** — 지연 로딩 import 경로가 실제 파일과 일치하는지 검증
4. **Store → Service 참조** — 스토어에서 호출하는 API 서비스 함수가 존재하는지 검증

## When to Run

- 새 페이지 또는 라우트 추가 후
- TeacherLayout 네비게이션 항목 변경 후
- 서비스 또는 스토어 파일 수정 후
- 페이지 파일 이름 변경 또는 이동 후

## Related Files

| File | Purpose |
|------|---------|
| `frontend/src/App.tsx` | 라우트 정의 및 LazyRetry import |
| `frontend/src/components/layout/TeacherLayout.tsx` | 교사 사이드바 네비게이션 |
| `frontend/src/pages/teacher/DashboardPage.tsx` | 대시보드 페이지 |
| `frontend/src/pages/teacher/StudentManagePage.tsx` | 학생 관리 페이지 |
| `frontend/src/pages/teacher/TestSettingsPage.tsx` | 테스트 설정 페이지 |
| `frontend/src/pages/teacher/WordDatabasePage.tsx` | 단어 DB 페이지 |
| `frontend/src/pages/teacher/StatisticsPage.tsx` | 통계 페이지 |
| `frontend/src/pages/teacher/AnalysisPage.tsx` | 분석 페이지 |
| `frontend/src/pages/teacher/StudentResultPage.tsx` | 학생 결과 페이지 |
| `frontend/src/pages/teacher/MasteryReportPage.tsx` | 마스터리 리포트 페이지 |
| `frontend/src/pages/teacher/ProfilePage.tsx` | 프로필 페이지 |
| `frontend/src/pages/student/MainPage.tsx` | 학생 메인 페이지 |
| `frontend/src/pages/student/TestStartPage.tsx` | 테스트 시작 페이지 |
| `frontend/src/pages/student/UnifiedTestPage.tsx` | 통합 테스트 페이지 (레벨업/레거시 공용) |
| `frontend/src/pages/student/StudentReportPage.tsx` | 학생 리포트 페이지 |
| `frontend/src/pages/auth/LoginPage.tsx` | 로그인 페이지 |
| `frontend/src/pages/auth/RegisterPage.tsx` | 회원가입 페이지 |
| `frontend/src/stores/auth.ts` | 인증 스토어 |
| `frontend/src/stores/unifiedTestStore.ts` | 통합 테스트 스토어 (레벨업/레거시 공용) |
| `frontend/src/services/api.ts` | Axios 인스턴스 |
| `frontend/src/services/auth.ts` | 인증 API 서비스 |
| `frontend/src/services/unifiedTest.ts` | 통합 테스트 API 서비스 |
| `frontend/src/services/stats.ts` | 통계 API 서비스 |
| `frontend/src/services/student.ts` | 학생 API 서비스 |
| `frontend/src/services/word.ts` | 단어 API 서비스 |
| `frontend/src/services/testConfig.ts` | 테스트 설정 API 서비스 |
| `frontend/src/services/testAssignment.ts` | 테스트 배정 API 서비스 |
| `frontend/src/types/test.ts` | 레거시 테스트 결과 조회용 타입 (TestSessionData, AnswerDetail) |

## Workflow

### Step 1: LazyRetry import 경로 검증

**도구:** Read, Glob

App.tsx에서 `lazyRetry(() => import(...))` 패턴을 찾고, 각 경로의 실제 파일 존재 여부를 확인합니다.

```bash
Grep pattern="lazyRetry.*import\(" path="frontend/src/App.tsx" output_mode="content"
```

각 import 경로에 대해:
```bash
Glob pattern="frontend/src/pages/**/<ComponentName>.tsx"
```

**PASS 기준:** 모든 lazyRetry import 경로가 실제 .tsx 파일과 매치됨.

**FAIL:** 존재하지 않는 파일을 import하면 런타임 chunk load 에러 발생.

### Step 2: Route path → Page 컴포넌트 매핑 검증

**도구:** Read

App.tsx의 `<Route path="..." element={<Component />} />` 패턴을 분석합니다.

```bash
Grep pattern="<Route path=" path="frontend/src/App.tsx" output_mode="content"
```

**PASS 기준:** 모든 Route의 element에 사용된 컴포넌트가 위 lazyRetry 또는 직접 import로 정의됨.

**FAIL:** 정의되지 않은 컴포넌트를 Route element로 사용하면 빌드 에러 발생.

### Step 3: TeacherLayout 네비게이션 ↔ Route 동기화

**도구:** Read

TeacherLayout.tsx의 navItems 배열과 App.tsx의 teacher 라우트를 비교합니다.

```bash
Grep pattern="to: '/" path="frontend/src/components/layout/TeacherLayout.tsx" output_mode="content"
Grep pattern='path="/' path="frontend/src/App.tsx" output_mode="content"
```

**PASS 기준:**
- TeacherLayout의 모든 `to:` 경로가 App.tsx의 Route path로 존재
- 교사 전용 Route에 `roles={['teacher']}` guard 존재

**FAIL:** 네비게이션 항목이 존재하지 않는 라우트를 가리키면 404 에러 발생.

### Step 4: Store → Service import 검증

**도구:** Grep

각 스토어 파일에서 import하는 서비스 함수가 해당 서비스 파일에 존재하는지 확인합니다.

```bash
Grep pattern="^import.*from.*services/" path="frontend/src/stores/" output_mode="content"
```

각 import된 함수에 대해 서비스 파일에서 `export` 확인:
```bash
Grep pattern="export (const|function|async)" path="frontend/src/services/" output_mode="content"
```

**PASS 기준:** 모든 스토어가 import하는 서비스 함수가 해당 서비스에서 export됨.

**FAIL:** 존재하지 않는 서비스 함수를 호출하면 빌드 에러 발생.

### Step 5: TypeScript 빌드 검증

**도구:** Bash

프론트엔드 타입 체크로 전체 참조 일관성을 최종 검증합니다.

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

**PASS 기준:** 타입 체크 에러 0개.

**FAIL:** 타입 에러가 있으면 참조 불일치 존재.

## Output Format

```markdown
## 프론트엔드 라우트 검증 결과

| 검사 항목 | 상태 | 이슈 수 | 상세 |
|-----------|------|---------|------|
| LazyRetry 경로 | PASS/FAIL | N | ... |
| Route → Page 매핑 | PASS/FAIL | N | ... |
| Nav ↔ Route 동기화 | PASS/FAIL | N | ... |
| Store → Service 참조 | PASS/FAIL | N | ... |
| TypeScript 빌드 | PASS/FAIL | N | ... |
```

## Exceptions

1. **public 라우트** — `/login`, `/register`, `/test/start`, `/unified-test`, `/mastery-report/:sessionId`는 인증 guard가 없는 것이 정상. 누구나 접근 가능한 페이지.
2. **직접 import 페이지** — `LoginPage`, `RegisterPage`는 lazyRetry 없이 직접 import하는 것이 정상 (인증 전 즉시 로드 필요).
3. **학생 라우트 네비게이션** — 학생 페이지는 TeacherLayout이 아닌 별도 레이아웃을 사용하므로 TeacherLayout navItems에 없는 것이 정상.
4. **types/ 디렉토리** — `frontend/src/types/test.ts`는 서비스가 아닌 타입 정의 파일로, 스토어에서 직접 import하지 않는 것이 정상. 컴포넌트에서 직접 import하여 사용.