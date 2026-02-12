# 브라우저 E2E 테스트 실행 결과

> **실행일시**: 2026-02-12 17:40 KST  
> **테스트 서버**: `http://localhost:5173` (Vite) + `http://localhost:8000` (FastAPI)  
> **도구**: Playwright v1.58.2, Chromium (headless)

## 요약

| 전체 | 통과 | 실패 | 소요시간 |
|------|------|------|----------|
| 6    | 1    | 5    | ~46초    |

---

## 테스트별 결과

### ✅ 통과 (1건)

| 파일 | 테스트명 | 결과 |
|------|----------|------|
| `auth.spec.ts` | student can login with username | ✅ 통과 |

### ❌ 실패 (5건)

#### 1. `auth.spec.ts` — teacher can register and lands on dashboard
- **원인**: `text=대시보드` locator가 **2개 요소**와 매칭되어 strict mode 위반
  - `<span>대시보드</span>` (사이드바 링크)
  - `<h1>대시보드</h1>` (페이지 헤더)
- **수정방안**: `page.locator('h1:has-text("대시보드")')` 또는 `page.getByRole('heading', { name: '대시보드' })` 사용

#### 2. `auth.spec.ts` — teacher can login and logout
- **원인**: 위와 동일한 `text=대시보드` strict mode 위반 (같은 코드 패턴 사용)

#### 3. `teacher-dashboard.spec.ts` — teacher can create and see students
- **원인**: `registerTeacher()` 헬퍼가 `{ username, password, name }` 반환하지만 `teacher.email`로 접근
- **수정방안**: `teacher.email` → `teacher.username`으로 변경 (`loginViaUI(page, teacher.username, teacher.password)`)

#### 4. `teacher-dashboard.spec.ts` — teacher can view student test results
- **원인**: 위와 동일 — `teacher.email` 속성이 존재하지 않음 + API 호출 시 `email` 필드 사용
- **수정방안**: `teacher.email` → `teacher.username`, API 호출의 `email` → `username`

#### 5. `level-test.spec.ts` — student can start test, answer questions, and see results
- **원인**: `registerTeacher()` 반환값에서 `teacher.email`로 접근 시도
- **수정방안**: `teacher.email` → `teacher.username`

---

## 실패 스크린샷

대시보드 페이지는 정상 로드됨 (회원가입 → 리다이렉트 성공). `text=대시보드` locator만 수정 필요.

![대시보드 스크린샷](file:///F:/wordlvtest/frontend/test-results/auth-Authentication-teache-7c57a-ster-and-lands-on-dashboard-chromium/test-failed-1.png)

---

## 공통 수정 사항 요약

### 수정 1: `teacher.email` → `teacher.username` (3개 파일)
`registerTeacher()` 헬퍼는 `{ username, password, name }`을 반환하는데, 테스트 코드에서 `teacher.email`로 접근하고 있음.

### 수정 2: `text=대시보드` locator 변경 (auth.spec.ts)
```diff
-await expect(page.locator('text=대시보드')).toBeVisible();
+await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
```

### 수정 3: API 호출 필드명 (teacher-dashboard.spec.ts)  
```diff
-data: { email: student.username, password: student.password },
+data: { username: student.username, password: student.password },
```

---

## 내장 브라우저 도구 상태

| 항목 | 상태 |
|------|------|
| `$HOME` 환경변수 | ⚠️ 시스템 수준에서는 설정되었으나, 내장 브라우저 도구 실행 환경에 전파되지 않음 |
| Playwright CLI | ✅ 정상 동작 |
| 대안 | Playwright CLI로 직접 테스트 실행 가능 |
