# WordLvTest - English Vocabulary & Grammar Testing Platform

영어 학원 학생/교사를 위한 단어·문법 레벨 테스트 앱

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy (async) + Alembic |
| Frontend | React 19 + TypeScript + Vite 7 + TailwindCSS 4 + Zustand |
| Database | PostgreSQL (Supabase) |
| Deployment | Railway (backend) + Vercel (frontend) + Supabase (DB) |
| TTS | Edge TTS (Microsoft Neural) + Gemini 2.5 Flash Lite fallback |
| Auth | JWT (python-jose) + bcrypt (pinned 4.0.1) + refresh token rotation |

## Project Structure

```
wordtest/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, 14 routers, CORS, GZip
│   │   ├── api/v1/              # 14 router files (~80 endpoints)
│   │   ├── models/              # 21 SQLAlchemy models
│   │   ├── schemas/             # 14 Pydantic schema files
│   │   ├── services/            # Business logic + question engines
│   │   │   └── question_engines/  # 12 question type generators
│   │   ├── core/                # Config, DB, auth dependencies
│   │   └── utils/               # Helpers
│   ├── alembic/versions/        # 26 migrations
│   ├── scripts/                 # 36 utility scripts
│   ├── tests/                   # 82 pytest tests (async, SQLite in-memory)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/               # 23 pages (auth/teacher/student/master)
│   │   ├── components/          # 69 components
│   │   │   ├── grammar/         # 13 files (8 card types + editor/validation)
│   │   │   ├── mastery/         # 9 files (XP system UI)
│   │   │   ├── test/            # 20 files (question cards, timer, feedback)
│   │   │   ├── report/          # 6 files (charts, metrics)
│   │   │   ├── result/          # 7 files (student results)
│   │   │   └── test-settings/   # 6 files (config panels)
│   │   ├── services/            # 12 API service files
│   │   ├── stores/              # 3 Zustand stores (auth, unified, grammar)
│   │   ├── types/               # 6 type definition files
│   │   └── hooks/               # useSound, useTimer
│   └── package.json
├── MASTERY_SYSTEM.md            # XP-based adaptive mastery system design doc
└── CLAUDE.md
```

## User Roles

| Role | Access |
|------|--------|
| `master` | 전체 시스템 관리, 교사 CRUD, 시스템 통계 |
| `teacher` | 학생 관리, 단어/문법 DB, 테스트 설정, 성적 조회 |
| `student` | 테스트 응시, 본인 결과 조회 |

## Backend API Endpoints

### Auth (`/api/v1/auth`)
- `POST /register`, `/login/json`, `/refresh`, `/logout`, `/password/change`

### Users (`/api/v1/users`)
- `GET /me`, `PATCH /me`, `DELETE /me`

### Students (`/api/v1/students`)
- `POST /`, `GET /`, `PATCH /{id}`, `DELETE /{id}`
- `POST /batch` (XLSX), `POST /batch-delete`

### Words (`/api/v1/words`)
- `GET /` (paginated, filtered), `POST /`, `PATCH /{id}`, `DELETE /{id}`
- `GET /books`, `/parts-of-speech`, `/lessons`, `/count-range`, `/compatible-counts`
- `GET /engine-audit`, `POST /engine-audit/refresh`

### Test Configs (`/api/v1/test-configs`)
- `GET /`, `POST /`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`, `POST /{id}/assign`

### Test Assignments (`/api/v1/test-assignments`)
- `POST /`, `GET /`, `DELETE /{id}`, `PATCH /{id}/unassign`, `PATCH /{id}/reset`

### Level-Up / Mastery (`/api/v1/levelup`)
- `POST /check-code` — 엔진 타입 확인
- `POST /start-by-code` — 적응형 세션 시작 (50문제)
- `POST /batch` — 레벨별 문제 풀 lazy load
- `POST /{session_id}/answer` — 개별 답 제출
- `POST /{session_id}/submit-batch` — 일괄 제출
- `POST /complete` — 세션 완료 (final_level 저장)

### Legacy Test (`/api/v1/legacy`)
- `POST /start-by-code`, `/{session_id}/answer`, `/{session_id}/submit-batch`, `/complete`

### Level Test (`/api/v1/level-test`)
- `POST /`, `GET /assignments`, `DELETE /assignments/{id}`

### Grammar (`/api/v1/grammar`)
- Books: `GET /books` (auto-seed), `GET /books/{book_id}/chapters`
- Questions: `GET /questions` (filters), `PATCH /questions/{id}`
- Configs: `POST /configs`, `GET /configs`, `PATCH /configs/{id}`, `DELETE /configs/{id}`
- Assignments: `POST /assign`, `GET /assignments`, `DELETE /assignments/{id}`, `PATCH /assignments/{id}/reset`
- Test flow: `POST /start-by-code`, `/{session_id}/answer`, `/{session_id}/batch-submit`, `/complete`

### Statistics (`/api/v1/stats`)
- `GET /all-results`, `/dashboard`, `/word-stats`, `/peer-ranking`, `/level-distribution`
- `GET /student/{id}/history`, `/student/{id}/mastery-report`, `/student/{id}/grammar-report`

### Master Statistics (`/api/v1/master-stats`) — master only
- `GET /overview`, `/word-calibration`, `/grammar-calibration`, `/question-accuracy`
- `GET /error-patterns`, `/srs-optimization`, `/bad-words`, `/bad-questions`

### TTS (`/api/v1/speak`)
- `GET /speak?text=...&voice=Aria` — Edge TTS + Gemini fallback

### Teachers (`/api/v1/teachers`) — master only
- `POST /`, `GET /`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`

## Database Models (21)

**Core**: User, AuthToken
**Words**: Word, WordExample, WordMastery
**Mastery**: LearningSession, LearningAnswer
**Legacy Test**: TestSession, TestAnswer, TestConfig, TestAssignment
**Grammar**: GrammarBook, GrammarChapter, GrammarPoint, GrammarSentence, GrammarQuestion, GrammarConfig, GrammarSession, GrammarAnswer
**Utility**: TtsCache

Key fields:
- `User.role`: "student" / "teacher" / "master"
- `Word.compatible_engines`: CSV of available question types
- `LearningSession.current_level`: adaptive level (1-15)
- `TestAssignment.engine_type`: "levelup" / "legacy"
- `TestAssignment.status`: "pending" / "in_progress" / "completed" / "deactivated"
- `GrammarQuestion.question_data`: JSONB (type-specific structure)

## Frontend Routes

```
# Auth
/login → LoginPage
/register → RegisterPage

# Teacher (role: teacher)
/dashboard → DashboardPage
/students → StudentManagePage
/students/:studentId/results → StudentResultPage
/students/:studentId/mastery/:sessionId → MasteryReportPage
/students/:studentId/grammar/:sessionId → GrammarReportPage
/words → WordDatabasePage
/test-settings → TestSettingsPage
/grammar-settings → GrammarSettingsPage
/level-test → LevelTestPage
/statistics → StatisticsPage
/test-results → AllTestResultsPage
/analysis → AnalysisPage
/profile → ProfilePage

# Master (role: master)
/teachers → TeacherManagePage

# Student (role: student)
/student → StudentMainPage
/test/start → TestStartPage
/unified-test → UnifiedTestPage
/grammar-test → GrammarTestPage
/mastery-report/:sessionId → StudentReportPage
```

## Grammar System

### 8 Question Types

| Type | Component | 한글 | Description |
|------|-----------|------|-------------|
| `grammar_blank` | GrammarBlankCard | 빈칸 채우기 | 보기에서 선택 (다중 빈칸 지원) |
| `grammar_error` | GrammarErrorCard | 오류 탐지 | 틀린 문장 선택 |
| `grammar_common` | GrammarCommonCard | 공통 단어 | 공통 단어 찾기 |
| `grammar_usage` | GrammarUsageCard | 쓰임 구별 | 올바른 쓰임 선택 |
| `grammar_transform` | GrammarTransformCard | 문장 전환 | 문장 변형 작성 |
| `grammar_order` | GrammarOrderCard | 단어 배열 | 클릭으로 순서 배열 |
| `grammar_translate` | GrammarTranslateCard | 영작 | 한→영 작문 |
| `grammar_pair` | GrammarPairCard | (A)(B) 짝짓기 | 짝 맞추기 |

### Multi-blank (grammar_blank)
- `___` 개수로 다중 빈칸 감지
- 순서대로 선택, 같은 보기 재클릭으로 취소
- `correct_indices` (배열) vs `correct_index` (단일) 구분
- 모든 빈칸 채우면 자동 제출

### Validation (`grammarValidation.ts`)
- error/warn/ok 3단계
- 프롬프트 미설정, 보기 부족 (4개 미만), 다중 빈칸 경고
- `GrammarDatabasePanel`에서 필터링 가능

## Mastery System (XP-Based Adaptive)

**설계문서**: `MASTERY_SYSTEM.md` (source of truth)

- 15 레벨 (Books 1-15), 각 25 레슨 × 20 단어
- 50문제 세션, 실시간 XP 기반 레벨 변동
- Internal stage (1-5) → question_type 결정 (유저에게 비공개)

**XP 계산**:
- 정답: +7 (현재 레벨) 또는 +3 (하위 레벨) + 속도 보너스 +5 + 콤보 +1~5
- 오답: -5, 연속 2회 -8, 3회+ -12
- 레슨당 XP = 5 + (book × 5)

**SRS**: mastered 단어에 review_due_at (3/7/30일) 자동 설정

## Word Question Engines (12)

| Engine | Type | Timer |
|--------|------|-------|
| en_to_ko | 영→한 선택 | 5s |
| ko_to_en | 한→영 선택 | 5s |
| listen_en | 듣기 영어 선택 | 10s |
| listen_ko | 듣기 한국어 선택 | 10s |
| ko_type | 한→영 타이핑 | 15s |
| listen_type | 듣기+타이핑 | 15s |
| sentence | 문장 맥락 선택 | 10s |
| sentence_type | 문장 맥락 타이핑 | 15s |
| antonym_choice | 반의어 선택 | 5s |
| antonym_type | 반의어 타이핑 | 15s |
| emoji | 이모지 연상 선택 | 5s |

## Testing

| Type | Tool | Count | Notes |
|------|------|-------|-------|
| Backend | pytest + pytest-asyncio + httpx | 82 | SQLite in-memory (aiosqlite) |
| Frontend unit | Vitest + MSW + Testing Library | 25 | vitest.config: exclude `e2e/**` |
| E2E | Playwright (chromium) | 6 | workers=1 (DB 안정성) |

## Scripts (`backend/scripts/`)

**데이터 생성**: `generate_examples.py` (Gemini), `generate_antonyms.py`
**임포트**: `import_grammar.py` (PDF→DB), `import_students.py` (XLSX), `import_examples.py`
**시딩**: `seed_diverse_students.py`, `seed_demo.py`, `seed_dummy_results.py`, `seed_dummy_grammar_results.py`
**DB 관리**: `check_db_integrity.py`, `normalize_words.py`, `auto_level_words.py`, `audit_word_engines.py`
**계정**: `create_master_account.py`, `restore_demo_teacher.py`

## Skills

커스텀 검증 및 유지보수 스킬은 `.claude/skills/`에 정의되어 있습니다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, CLAUDE.md를 관리합니다 |
| `verify-question-pipeline` | 문제 생성 파이프라인 외래어 필터링/중복 제거 일관성 검증 |
| `verify-api-consistency` | 백엔드 Router-Service-Schema-Model 계층 간 참조 일관성 검증 |
| `verify-frontend-routes` | 프론트엔드 Route-Page-Nav-Store-Service 간 참조 일관성 검증 |

## Dummy Data Management

모든 더미 데이터에는 `[DUMMY]` 태그가 붙어 있어 실제 데이터와 구분됩니다.
- User.username: `dummy_*` 접두어
- User.name / TestConfig.name / GrammarConfig.name: `[DUMMY]` 접두어

```bash
cd backend

# 더미 데이터 일괄 삭제 (실제 데이터만 남김)
python -m scripts.seed_diverse_students --delete

# 삭제 후 새로 생성
python -m scripts.seed_diverse_students --clean

# 기존 데이터에 [DUMMY] 태그 적용
python -m scripts.seed_diverse_students --tag-existing
```

## Key Technical Notes

- **Supabase**: Transaction pooler (port 6543) + `statement_cache_size=0` for asyncpg
- **Alembic**: Direct connection (port 5432) for migrations
- **bcrypt**: `bcrypt==4.0.1` pinned for passlib compatibility
- **TailwindCSS v4**: `@theme` syntax in CSS, no tailwind.config.js
- **Login**: email (teacher) + username (student) 모두 지원 → `input type="text"`
- **RLS**: Row-Level Security enabled on all tables
- **Grammar auto-seed**: 빈 DB일 때 첫 요청 시 자동 시딩
- **Auto-advance**: 문법 카드에서 정답 선택 후 1초 뒤 자동 다음 문제
- **TTS**: Volume2 아이콘으로 단어/예문 발음 — WordDatabasePage 수정 시 반드시 보존
- **Word.compatible_engines**: 사전 계산된 CSV, 문제 출제 시 필터링 기준

## Environment Variables

**Backend (.env)**:
- `DATABASE_URL` — Supabase transaction pooler (asyncpg, port 6543)
- `DIRECT_DATABASE_URL` — Direct connection (port 5432, Alembic용)
- `SECRET_KEY` — JWT secret
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30)
- `REFRESH_TOKEN_EXPIRE_DAYS` (default: 7)
- `FRONTEND_URL` — CORS origin
- `GEMINI_API_KEY` — Gemini TTS/example generation

**Frontend (.env)**:
- `VITE_API_URL` — Backend API URL
