# TRD (기술 요구사항 정의서)

> 개발자/AI 코딩 파트너가 참조하는 기술 문서입니다.
> 기술 표현을 사용하되, "왜 이 선택인지"를 함께 설명합니다.

---

## MVP 캡슐

| # | 항목 | 내용 |
|---|------|------|
| 1 | 목표 | 학생들의 영어 단어 실력을 빠르고 정확하게 테스트하여 레벨별로 분류 |
| 2 | 페르소나 | 학원 선생님(관리자) + 학생(테스트/학습자) |
| 3 | 핵심 기능 | FEAT-1: 단어 레벨 테스트 |
| 4 | 성공 지표 (노스스타) | 주 1회 이상 테스트 참여 학생 비율 |
| 5 | 입력 지표 | ① 신규 학생 테스트 완료율 ② 정기 테스트 참여율 |
| 6 | 비기능 요구 | 모바일+PC 반응형 웹 지원 |
| 7 | Out-of-scope | FEAT-2(리포트/통계), FEAT-3(학습 모드), 다크 모드, 수익화 |
| 8 | Top 리스크 | 학생들이 테스트에 흥미를 잃어 참여율이 낮아질 수 있음 |
| 9 | 완화/실험 | 친근한 톤의 피드백 + TTS로 발음 학습 요소 추가 |
| 10 | 다음 단계 | wordtest.xlsx 데이터 분석 및 레벨 체계 설계 |

---

## 1. 시스템 아키텍처

### 1.1 고수준 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Client      │────▶│     Server      │────▶│    Database     │
│  React + Vite   │     │    FastAPI      │     │   PostgreSQL    │
│  (반응형 웹)     │     │  (REST API)     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │  TTS Service    │
         │              │ (Web Speech API)│
         └──────────────┘                 │
                        └─────────────────┘
```

### 1.2 컴포넌트 설명

| 컴포넌트 | 역할 | 왜 이 선택? |
|----------|------|-------------|
| Frontend (React+Vite) | 학생 테스트 UI, 선생님 관리 UI | 반응형 웹에 적합, 풍부한 UI 생태계, Vite로 빠른 개발 |
| Backend (FastAPI) | API 서버, 레벨 판정 로직, 데이터 관리 | Python 기반으로 xlsx 처리 용이(pandas), 자동 API 문서 |
| Database (PostgreSQL) | 단어 데이터, 학생/테스트 결과 저장 | 관계형 데이터 조회에 강함, 안정적, 무료 |
| TTS | 단어 발음 재생 | Web Speech API로 별도 서비스 불필요 |

---

## 2. 권장 기술 스택

### 2.1 프론트엔드

| 항목 | 선택 | 이유 | 벤더 락인 리스크 |
|------|------|------|-----------------|
| 프레임워크 | React 18+ | 풍부한 컴포넌트 생태계, 커뮤니티 지원 | 낮음 |
| 빌드 도구 | Vite | 빠른 HMR, 간편한 설정 | 낮음 |
| 언어 | TypeScript | 타입 안전성, 개발 생산성 | - |
| 스타일링 | TailwindCSS | 유틸리티 기반, 반응형 용이, 빠른 개발 | 낮음 |
| 상태관리 | Zustand | 가볍고 직관적, 보일러플레이트 최소 | 낮음 |
| HTTP 클라이언트 | Axios | 인터셉터, 에러 핸들링 편리 | 낮음 |
| 라우팅 | React Router v6 | 표준 라우팅 솔루션 | 낮음 |

### 2.2 백엔드

| 항목 | 선택 | 이유 | 벤더 락인 리스크 |
|------|------|------|-----------------|
| 프레임워크 | FastAPI | 비동기 지원, 자동 API 문서, Pydantic 통합 | 낮음 |
| 언어 | Python 3.11+ | xlsx 처리(openpyxl/pandas), 풍부한 생태계 | - |
| ORM | SQLAlchemy 2.0 | Python 표준 ORM, 비동기 지원 | 낮음 |
| 검증 | Pydantic v2 | FastAPI 기본 통합, 강력한 데이터 검증 | 낮음 |
| 마이그레이션 | Alembic | SQLAlchemy 표준 마이그레이션 도구 | 낮음 |
| xlsx 처리 | openpyxl | wordtest.xlsx 파싱용, 가벼움 | 낮음 |

### 2.3 데이터베이스

| 항목 | 선택 | 이유 |
|------|------|------|
| 메인 DB | PostgreSQL 15+ | 관계형 데이터에 강함, 복잡한 조회 지원, 안정적 |
| 캐시 | 없음 (MVP) | 소규모 사용, 불필요한 복잡도 제거 |

### 2.4 인프라

| 항목 | 선택 | 이유 |
|------|------|------|
| 컨테이너 | Docker + Docker Compose | 로컬 개발 일관성 (개발 환경 전용) |
| DB 호스팅 | **Supabase** (PostgreSQL) | 관리형 PostgreSQL, 무료 티어 충분, 글로벌 리전 |
| 호스팅 (BE) | **Railway** | Python 배포 간편, Nixpacks 빌드, 무료 크레딧 |
| 호스팅 (FE) | **Vercel** | React+Vite 최적화, 글로벌 CDN, 무료 |

---

## 3. 비기능 요구사항

### 3.1 성능

| 항목 | 요구사항 | 측정 방법 |
|------|----------|----------|
| API 응답 시간 | < 500ms (P95) | API 모니터링 |
| 초기 로딩 | < 3s (FCP) | Lighthouse |
| 테스트 문제 로딩 | < 1s | 사용자 체감 |

### 3.2 보안

| 항목 | 요구사항 |
|------|----------|
| 인증 | JWT + Refresh Token |
| 비밀번호 | bcrypt 해싱 |
| HTTPS | 필수 |
| 입력 검증 | 서버 측 Pydantic 검증 필수 |
| CORS | 프론트엔드 도메인만 허용 |

### 3.3 확장성

| 항목 | 현재 | 목표 |
|------|------|------|
| 동시 사용자 | MVP: 50명 | v2: 500명 |
| 단어 데이터 | wordtest.xlsx 기반 | v2: 관리자 단어 추가 기능 |
| 데이터 용량 | MVP: 500MB | v2: 5GB |

---

## 4. 외부 API 연동

### 4.1 인증

| 서비스 | 용도 | 필수/선택 | 연동 방식 |
|--------|------|----------|----------|
| 자체 인증 | 이메일+비밀번호 로그인 | 필수 | JWT |

### 4.2 기타 서비스

| 서비스 | 용도 | 필수/선택 | 비고 |
|--------|------|----------|------|
| Web Speech API | 단어 TTS 발음 재생 | 필수 | 브라우저 내장 API, 별도 비용 없음 |

---

## 5. 접근제어·권한 모델

### 5.1 역할 정의

| 역할 | 설명 | 권한 |
|------|------|------|
| Student | 학생 사용자 | 테스트 응시, 본인 결과 조회 |
| Teacher | 선생님(관리자) | 학생 관리, 테스트 관리, 전체 결과 조회 |

### 5.2 권한 매트릭스

| 리소스 | Student | Teacher |
|--------|---------|---------|
| 테스트 응시 | O | O |
| 본인 결과 조회 | O | O |
| 전체 학생 결과 조회 | - | O |
| 학생 계정 관리 | - | O |
| 단어 데이터 관리 | - | O |
| 테스트 설정 | - | O |

---

## 6. 데이터 생명주기

### 6.1 원칙

- **최소 수집**: 이름, 로그인 정보, 테스트 결과만 수집
- **내부 사용**: 학원 내부 관리 목적으로만 사용
- **보존 기한**: 학생 탈퇴 시 데이터 삭제

### 6.2 데이터 흐름

```
수집(테스트 응시) → 저장(DB) → 사용(결과 조회) → 보관(히스토리) → 삭제(탈퇴 시)
```

| 데이터 유형 | 보존 기간 | 삭제/익명화 |
|------------|----------|------------|
| 계정 정보 | 탈퇴 시 | 완전 삭제 |
| 테스트 결과 | 계정과 동일 | Cascade 삭제 |
| 단어 데이터 | 영구 | xlsx에서 재로드 가능 |

---

## 7. 테스트 전략 (Contract-First TDD)

### 7.1 개발 방식: Contract-First Development

본 프로젝트는 **계약 우선 개발(Contract-First Development)** 방식을 채택합니다.
BE/FE가 독립적으로 병렬 개발하면서도 통합 시 호환성을 보장합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    Contract-First 흐름                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 계약 정의 (Phase 0)                                     │
│     ├─ API 계약: contracts/*.contract.ts                   │
│     ├─ BE 스키마: backend/app/schemas/*.py                 │
│     └─ 타입 동기화: TypeScript ↔ Pydantic                  │
│                                                             │
│  2. 테스트 선행 작성 (RED)                                  │
│     ├─ BE 테스트: tests/api/*.py                           │
│     ├─ FE 테스트: src/__tests__/**/*.test.ts               │
│     └─ 모든 테스트가 실패하는 상태 (정상!)                  │
│                                                             │
│  3. Mock 생성 (FE 독립 개발용)                              │
│     └─ MSW 핸들러: src/mocks/handlers/*.ts                 │
│                                                             │
│  4. 병렬 구현 (RED→GREEN)                                   │
│     ├─ BE: 테스트 통과 목표로 구현                          │
│     └─ FE: Mock API로 개발 → 나중에 실제 API 연결          │
│                                                             │
│  5. 통합 검증                                               │
│     └─ Mock 제거 → E2E 테스트                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 테스트 피라미드

| 레벨 | 도구 | 커버리지 목표 | 위치 |
|------|------|-------------|------|
| Unit | pytest / Vitest | >= 80% | tests/unit/, src/__tests__/ |
| Integration | pytest / Vitest + MSW | Critical paths | tests/integration/ |
| E2E | Playwright | Key user flows | e2e/ |

### 7.3 테스트 도구

**백엔드:**
| 도구 | 용도 |
|------|------|
| pytest | 테스트 실행 |
| pytest-asyncio | 비동기 테스트 |
| httpx | API 클라이언트 (TestClient 대체) |
| Factory Boy | 테스트 데이터 생성 |
| pytest-cov | 커버리지 측정 |

**프론트엔드:**
| 도구 | 용도 |
|------|------|
| Vitest | 테스트 실행 |
| React Testing Library | 컴포넌트 테스트 |
| MSW (Mock Service Worker) | API 모킹 |
| Playwright | E2E 테스트 |

### 7.4 계약 파일 구조

```
wordlvtest/
├── contracts/                    # API 계약 (BE/FE 공유)
│   ├── types.ts                 # 공통 타입 정의
│   ├── auth.contract.ts         # 인증 API 계약
│   ├── test.contract.ts         # 레벨 테스트 API 계약
│   └── word.contract.ts         # 단어 데이터 API 계약
│
├── backend/
│   ├── app/schemas/             # Pydantic 스키마 (계약과 동기화)
│   │   ├── auth.py
│   │   ├── test.py
│   │   └── word.py
│   └── tests/
│       └── api/                 # API 테스트 (계약 기반)
│           ├── test_auth.py
│           ├── test_level_test.py
│           └── test_word.py
│
└── frontend/
    ├── src/
    │   ├── mocks/
    │   │   ├── handlers/        # MSW Mock 핸들러
    │   │   │   ├── auth.ts
    │   │   │   ├── test.ts
    │   │   │   └── word.ts
    │   │   └── data/            # Mock 데이터
    │   └── __tests__/
    │       └── api/             # API 테스트 (계약 기반)
    └── e2e/                     # E2E 테스트
```

### 7.5 TDD 사이클

모든 기능 개발은 다음 사이클을 따릅니다:

```
RED    → 실패하는 테스트 먼저 작성 (Phase 0에서 완료)
GREEN  → 테스트를 통과하는 최소한의 코드 구현
REFACTOR → 테스트 통과 유지하며 코드 개선
```

### 7.6 품질 게이트

**병합 전 필수 통과:**
- [ ] 모든 단위 테스트 통과
- [ ] 커버리지 >= 80%
- [ ] 린트 통과 (ruff / ESLint)
- [ ] 타입 체크 통과 (mypy / tsc)
- [ ] E2E 테스트 통과 (해당 기능)

**검증 명령어:**
```bash
# 백엔드
pytest --cov=app --cov-report=term-missing
ruff check .
mypy app/

# 프론트엔드
npm run test -- --coverage
npm run lint
npm run type-check

# E2E
npx playwright test
```

---

## 8. API 설계 원칙

### 8.1 RESTful 규칙

| 메서드 | 용도 | 예시 |
|--------|------|------|
| GET | 조회 | GET /api/v1/tests/{id}/result |
| POST | 생성 | POST /api/v1/tests |
| PUT | 전체 수정 | PUT /api/v1/students/{id} |
| PATCH | 부분 수정 | PATCH /api/v1/students/{id} |
| DELETE | 삭제 | DELETE /api/v1/students/{id} |

### 8.2 응답 형식

**성공 응답:**
```json
{
  "data": {
    "test_id": "uuid",
    "level": 3,
    "score": 85,
    "total_questions": 20
  },
  "meta": {
    "timestamp": "2026-02-10T10:00:00Z"
  }
}
```

**에러 응답:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "답변을 선택해주세요.",
    "details": [
      { "field": "answer", "message": "필수 항목입니다" }
    ]
  }
}
```

### 8.3 주요 API 엔드포인트 (MVP)

| 엔드포인트 | 메서드 | 설명 | 역할 |
|-----------|--------|------|------|
| /api/v1/auth/register | POST | 선생님 계정 생성 | Teacher |
| /api/v1/auth/login | POST | 로그인 | All |
| /api/v1/auth/refresh | POST | 토큰 갱신 | All |
| /api/v1/students | GET | 학생 목록 조회 | Teacher |
| /api/v1/students | POST | 학생 계정 생성 | Teacher |
| /api/v1/tests/start | POST | 테스트 시작 | Student |
| /api/v1/tests/{id}/answer | POST | 답변 제출 | Student |
| /api/v1/tests/{id}/result | GET | 테스트 결과 조회 | All |
| /api/v1/words/tts | GET | 단어 발음 (Web Speech API 보조) | All |

### 8.4 API 버저닝

| 방식 | 예시 | 채택 여부 |
|------|------|----------|
| URL 경로 | /api/v1/... | 채택 |

---

## 9. 병렬 개발 지원 (Git Worktree)

### 9.1 개요

BE/FE를 완전히 독립된 환경에서 병렬 개발할 때 Git Worktree를 사용합니다.

### 9.2 Worktree 구조

```
~/projects/
├── wordlvtest/                    # 메인 (main 브랜치)
├── wordlvtest-auth-be/            # Worktree: feature/auth-be
├── wordlvtest-auth-fe/            # Worktree: feature/auth-fe
├── wordlvtest-leveltest-be/       # Worktree: feature/leveltest-be
└── wordlvtest-leveltest-fe/       # Worktree: feature/leveltest-fe
```

### 9.3 명령어

```bash
# Worktree 생성
git worktree add ../wordlvtest-auth-be -b feature/auth-be
git worktree add ../wordlvtest-auth-fe -b feature/auth-fe

# 각 Worktree에서 독립 작업
cd ../wordlvtest-auth-be && pytest tests/api/test_auth.py
cd ../wordlvtest-auth-fe && npm run test -- src/__tests__/auth/

# 테스트 통과 후 병합
git checkout main
git merge --no-ff feature/auth-be
git merge --no-ff feature/auth-fe

# Worktree 정리
git worktree remove ../wordlvtest-auth-be
git worktree remove ../wordlvtest-auth-fe
```

### 9.4 병합 규칙

| 조건 | 병합 가능 |
|------|----------|
| 단위 테스트 통과 | 필수 |
| 커버리지 >= 80% | 필수 |
| 린트/타입 체크 통과 | 필수 |
| E2E 테스트 통과 | 권장 |

---

## Decision Log 참조

| ID | 항목 | 선택 | 근거 |
|----|------|------|------|
| D-16 | 백엔드 | FastAPI | Python 기반, xlsx 처리 용이, 자동 API 문서 |
| D-17 | 프론트엔드 | React + Vite | 반응형 웹 적합, 풍부한 생태계 |
| D-18 | 데이터베이스 | PostgreSQL | 관계형 데이터 강점, 안정적, 무료 |
| D-11 | 외부 연동 | TTS (Web Speech API) | 브라우저 내장, 추가 비용 없음 |
| D-12 | 데이터 저장 | 클라우드 서버 | 어디서든 접속, 중앙 관리 |
