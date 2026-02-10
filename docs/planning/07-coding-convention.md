# Coding Convention & AI Collaboration Guide

> 고품질/유지보수/보안을 위한 인간-AI 협업 운영 지침서입니다.

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

## 1. 핵심 원칙

### 1.1 신뢰하되, 검증하라 (Don't Trust, Verify)

AI가 생성한 코드는 반드시 검증해야 합니다:

- [ ] 코드 리뷰: 생성된 코드 직접 확인
- [ ] 테스트 실행: 자동화 테스트 통과 확인
- [ ] 보안 검토: 민감 정보 노출 여부 확인
- [ ] 동작 확인: 실제로 실행하여 기대 동작 확인

### 1.2 최종 책임은 인간에게

- AI는 도구이고, 최종 결정과 책임은 개발자에게 있습니다
- 이해하지 못하는 코드는 사용하지 않습니다
- 의심스러운 부분은 반드시 질문합니다

---

## 2. 프로젝트 구조

### 2.1 디렉토리 구조

```
wordlvtest/
├── contracts/                    # API 계약 (BE/FE 공유)
│   ├── types.ts
│   ├── auth.contract.ts
│   ├── test.contract.ts
│   └── word.contract.ts
│
├── frontend/
│   ├── src/
│   │   ├── components/          # 재사용 컴포넌트
│   │   │   ├── ui/              # 기본 UI (Button, Input, Card 등)
│   │   │   └── test/            # 테스트 관련 컴포넌트
│   │   ├── pages/               # 페이지 컴포넌트
│   │   │   ├── auth/            # 로그인, 회원가입
│   │   │   ├── student/         # 학생 화면
│   │   │   └── teacher/         # 선생님 화면
│   │   ├── hooks/               # 커스텀 훅
│   │   ├── utils/               # 유틸리티 함수
│   │   ├── services/            # API 호출
│   │   ├── stores/              # Zustand 상태 관리
│   │   ├── types/               # TypeScript 타입
│   │   ├── mocks/               # MSW Mock 핸들러
│   │   └── __tests__/           # 테스트
│   ├── e2e/                     # E2E 테스트
│   └── public/
│
├── backend/
│   ├── app/
│   │   ├── models/              # SQLAlchemy 모델
│   │   ├── routes/              # FastAPI 라우트
│   │   ├── schemas/             # Pydantic 스키마
│   │   ├── services/            # 비즈니스 로직
│   │   ├── utils/               # 유틸리티
│   │   └── core/                # 설정, 보안, DB 연결
│   ├── tests/
│   │   ├── api/                 # API 테스트
│   │   └── unit/                # 단위 테스트
│   └── alembic/                 # DB 마이그레이션
│
├── data/
│   └── wordtest.xlsx            # 단어 데이터 원본
│
├── docs/
│   └── planning/                # 기획 문서 (소크라테스 산출물)
│
├── docker-compose.yml
├── .env.example
└── .gitignore
```

### 2.2 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 파일 (컴포넌트) | PascalCase | `TestQuestion.tsx` |
| 파일 (유틸/훅) | camelCase | `useTestSession.ts` |
| 파일 (Python) | snake_case | `test_service.py` |
| React 컴포넌트 | PascalCase | `AnswerCard` |
| 함수/변수 (JS) | camelCase | `getTestResult` |
| 함수/변수 (Python) | snake_case | `get_test_result` |
| 상수 | UPPER_SNAKE | `MAX_QUESTIONS` |
| CSS 클래스 | TailwindCSS 유틸리티 | `bg-primary text-white` |
| API 엔드포인트 | kebab-case | `/api/v1/test-sessions` |
| DB 테이블 | snake_case (복수형) | `test_sessions` |
| DB 컬럼 | snake_case | `correct_count` |

---

## 3. 아키텍처 원칙

### 3.1 뼈대 먼저 (Skeleton First)

1. 전체 구조를 먼저 잡고
2. 빈 함수/컴포넌트로 스켈레톤 생성
3. 하나씩 구현 채워나가기

### 3.2 작은 모듈로 분해

- 한 파일에 200줄 이하 권장
- 한 함수에 50줄 이하 권장
- 한 컴포넌트에 100줄 이하 권장

### 3.3 관심사 분리

| 레이어 | 역할 | 예시 |
|--------|------|------|
| UI | 화면 표시 | React 컴포넌트 (TestQuestion, AnswerCard) |
| 상태 | 데이터 관리 | Zustand 스토어 (useTestStore, useAuthStore) |
| 서비스 | API 통신 | Axios 래퍼 (testService, authService) |
| 유틸 | 순수 함수 | 레벨 계산, 점수 산정 |

---

## 4. AI 소통 원칙

### 4.1 하나의 채팅 = 하나의 작업

- 한 번에 하나의 명확한 작업만 요청
- 작업 완료 후 다음 작업 진행
- 컨텍스트가 길어지면 새 대화 시작

### 4.2 컨텍스트 명시

**좋은 예:**
> "TASKS 문서의 T2.1을 구현해주세요.
> Database Design의 TEST_SESSION 엔티티를 참조하고,
> TRD의 기술 스택(FastAPI + SQLAlchemy)을 따라주세요."

**나쁜 예:**
> "테스트 API 만들어줘"

### 4.3 기존 코드 재사용

- 새로 만들기 전에 기존 코드 확인 요청
- 중복 코드 방지
- 일관성 유지

### 4.4 프롬프트 템플릿

```
## 작업
{{무엇을 해야 하는지}}

## 참조 문서
- {{문서명}} 섹션 {{번호}}

## 제약 조건
- {{지켜야 할 것}}

## 예상 결과
- {{생성될 파일}}
- {{기대 동작}}
```

---

## 5. 보안 체크리스트

### 5.1 절대 금지

- [ ] 비밀정보 하드코딩 금지 (API 키, 비밀번호, 토큰)
- [ ] .env 파일 커밋 금지
- [ ] SQL 직접 문자열 조합 금지 (SQL Injection)
- [ ] 사용자 입력 그대로 출력 금지 (XSS)

### 5.2 필수 적용

- [ ] 모든 사용자 입력 검증 (Pydantic 서버 측 검증)
- [ ] 비밀번호 bcrypt 해싱
- [ ] HTTPS 사용
- [ ] CORS 설정 (프론트엔드 도메인만 허용)
- [ ] JWT 토큰 기반 인증
- [ ] 역할(role) 기반 접근 제어 (teacher/student)

### 5.3 환경 변수 관리

```bash
# .env.example (커밋 O)
DATABASE_URL=postgresql://user:password@localhost:5432/wordlvtest
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# .env (커밋 X) - .gitignore에 포함
DATABASE_URL=postgresql://real:real@prod:5432/wordlvtest
JWT_SECRET=abc123xyz789...
```

---

## 6. 테스트 워크플로우

### 6.1 즉시 실행 검증

코드 작성 후 바로 테스트:

```bash
# 백엔드
pytest backend/tests/ -v

# 프론트엔드
npm run test

# E2E
npx playwright test
```

### 6.2 오류 로그 공유 규칙

오류 발생 시 AI에게 전달할 정보:

1. 전체 에러 메시지
2. 관련 코드 스니펫
3. 재현 단계
4. 이미 시도한 해결책

**예시:**
```
## 에러
TypeError: Cannot read property 'level' of undefined

## 코드
const level = testResult.level;  // line 42

## 재현
1. 테스트 완료 전에
2. /result 페이지 접근

## 시도한 것
- testResult가 undefined인지 확인 → 비동기 로딩 문제
```

---

## 7. Git 워크플로우

### 7.1 브랜치 전략

```
main              # 프로덕션
├── develop       # 개발 통합
│   ├── feature/feat-0-auth
│   ├── feature/feat-1-leveltest-be
│   ├── feature/feat-1-leveltest-fe
│   └── fix/test-score-calculation
```

### 7.2 커밋 메시지

```
<type>(<scope>): <subject>

<body>
```

**타입:**
- `feat`: 새 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링
- `docs`: 문서
- `test`: 테스트
- `chore`: 기타

**예시:**
```
feat(test): 단어 레벨 테스트 API 구현

- POST /api/v1/tests/start 엔드포인트 추가
- 레벨별 문제 출제 로직 구현
- TRD 섹션 8.3 구현 완료
```

---

## 8. 코드 품질 도구

### 8.1 필수 설정

| 도구 | 프론트엔드 | 백엔드 |
|------|-----------|--------|
| 린터 | ESLint | Ruff |
| 포매터 | Prettier | Ruff format |
| 타입 체크 | TypeScript (strict) | mypy |

### 8.2 Pre-commit 훅

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: frontend-lint
        name: Frontend Lint
        entry: npm run lint --prefix frontend
        language: system
      - id: backend-lint
        name: Backend Lint
        entry: ruff check backend/
        language: system
      - id: backend-format
        name: Backend Format
        entry: ruff format --check backend/
        language: system
```

---

## 9. 도메인 용어 사전

프로젝트 전체에서 일관되게 사용할 용어:

| 한국어 | 영어 (코드) | 설명 |
|--------|------------|------|
| 선생님 | teacher | 관리자 역할 |
| 학생 | student | 테스트 응시자 |
| 단어 | word | 영어 단어 데이터 |
| 레벨 | level | 단어/학생 수준 (1~N) |
| 테스트 세션 | test_session | 1회 테스트 전체 |
| 테스트 답변 | test_answer | 개별 문제 답변 |
| 배치 테스트 | placement | 신규 학생 레벨 판정 |
| 정기 테스트 | periodic | 정기 레벨 재평가 |
| 점수 | score | 0~100 점수 |
| 정답 | correct | 맞은 답 |
| 오답 | wrong / incorrect | 틀린 답 |

---

## Decision Log 참조

| ID | 항목 | 선택 | 근거 |
|----|------|------|------|
| D-16 | 백엔드 | FastAPI + Python | xlsx 처리 용이, 자동 API 문서 |
| D-17 | 프론트엔드 | React + Vite + TypeScript | 반응형 웹, 타입 안전성 |
| D-18 | DB | PostgreSQL + SQLAlchemy | 관계형 데이터 강점 |
| D-11 | TTS | Web Speech API | 브라우저 내장, 비용 무료 |
