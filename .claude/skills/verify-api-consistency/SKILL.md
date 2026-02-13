---
name: verify-api-consistency
description: 백엔드 Router-Service-Schema-Model 계층 간 참조 일관성을 검증합니다. API 엔드포인트 추가/수정 후 사용.
---

# 백엔드 API 일관성 검증

## Purpose

1. **Router → Service 참조** — 모든 라우터 핸들러가 존재하는 서비스 함수를 호출하는지 검증
2. **Import 정합성** — 서비스 간 import가 올바르고, 순환 의존이 없는지 검증
3. **Schema 참조** — 라우터에서 사용하는 Pydantic 스키마가 존재하는지 검증
4. **Model 참조** — 서비스에서 사용하는 SQLAlchemy 모델이 존재하는지 검증

## When to Run

- 새 API 엔드포인트 추가 후
- 서비스 함수 이름 변경 또는 이동 후
- 스키마(Pydantic) 모델 추가/수정 후
- DB 모델 변경 후

## Related Files

| File | Purpose |
|------|---------|
| `backend/app/api/v1/auth.py` | 인증 API 라우터 |
| `backend/app/api/v1/mastery.py` | 마스터리 테스트 API 라우터 |
| `backend/app/api/v1/stage_test.py` | 스테이지 테스트 API 라우터 |
| `backend/app/api/v1/stats.py` | 통계 API 라우터 |
| `backend/app/api/v1/students.py` | 학생 관리 API 라우터 |
| `backend/app/api/v1/tests.py` | 레벨 테스트 API 라우터 |
| `backend/app/api/v1/test_assignments.py` | 테스트 배정 API 라우터 |
| `backend/app/api/v1/test_configs.py` | 테스트 설정 API 라우터 |
| `backend/app/api/v1/tts.py` | TTS API 라우터 |
| `backend/app/api/v1/users.py` | 사용자 프로필 API 라우터 |
| `backend/app/api/v1/words.py` | 단어 DB API 라우터 |
| `backend/app/services/mastery.py` | 마스터리 서비스 |
| `backend/app/services/mastery_engine.py` | 문제 생성 엔진 |
| `backend/app/services/stage_test.py` | 스테이지 테스트 서비스 |
| `backend/app/services/level_engine.py` | 레벨 테스트 엔진 |
| `backend/app/services/test.py` | 테스트 세션 서비스 |
| `backend/app/services/report_engine.py` | 리포트 엔진 |
| `backend/app/services/auth.py` | 인증 서비스 |
| `backend/app/services/student.py` | 학생 서비스 |
| `backend/app/services/test_assignment.py` | 테스트 배정 서비스 |
| `backend/app/services/test_config.py` | 테스트 설정 서비스 |
| `backend/app/schemas/mastery.py` | 마스터리 스키마 |
| `backend/app/schemas/stage_test.py` | 스테이지 테스트 스키마 |
| `backend/app/schemas/test.py` | 테스트 스키마 |
| `backend/app/schemas/auth.py` | 인증 스키마 |
| `backend/app/schemas/stats.py` | 통계 스키마 |
| `backend/app/schemas/student.py` | 학생 스키마 |
| `backend/app/schemas/user.py` | 사용자 스키마 |
| `backend/app/schemas/word.py` | 단어 스키마 |
| `backend/app/schemas/test_assignment.py` | 테스트 배정 스키마 |
| `backend/app/schemas/test_config.py` | 테스트 설정 스키마 |
| `backend/app/models/user.py` | User 모델 |
| `backend/app/models/word.py` | Word 모델 |
| `backend/app/models/word_mastery.py` | WordMastery 모델 |
| `backend/app/models/learning_session.py` | LearningSession 모델 |
| `backend/app/models/learning_answer.py` | LearningAnswer 모델 |
| `backend/app/models/test_session.py` | TestSession 모델 |
| `backend/app/models/test_answer.py` | TestAnswer 모델 |
| `backend/app/models/test_assignment.py` | TestAssignment 모델 |
| `backend/app/models/test_config.py` | TestConfig 모델 |
| `backend/app/models/auth_token.py` | AuthToken 모델 |
| `backend/app/models/tts_cache.py` | TtsCache 모델 |

## Workflow

### Step 1: Router import 검증

**도구:** Grep

각 라우터 파일의 import 섹션에서 참조하는 서비스/스키마 모듈이 존재하는지 확인합니다.

```bash
Grep pattern="^from app\.(services|schemas|models)\." path="backend/app/api/v1/" output_mode="content"
```

**PASS 기준:** 모든 import 경로가 실제 존재하는 모듈을 참조.

**FAIL:** 존재하지 않는 모듈을 import하면 런타임 ImportError 발생.

### Step 2: Service 함수 존재 검증

**도구:** Grep

라우터에서 호출하는 서비스 함수가 해당 서비스 파일에 실제로 정의되어 있는지 확인합니다.

```bash
# 라우터에서 서비스 함수 호출 패턴 추출
Grep pattern="\b(mastery|stage_test|test|auth|student|test_assignment|test_config|level_engine|report_engine)\.\w+\(" path="backend/app/api/v1/" output_mode="content"
```

각 호출된 함수에 대해 해당 서비스 파일에 `def <function_name>` 또는 `async def <function_name>`이 존재하는지 확인합니다.

**PASS 기준:** 모든 호출된 함수가 해당 서비스에 정의됨.

**FAIL:** 존재하지 않는 함수를 호출하면 런타임 AttributeError 발생.

### Step 3: Schema 모델 참조 검증

**도구:** Grep

라우터에서 사용하는 Pydantic 스키마 클래스가 해당 스키마 파일에 정의되어 있는지 확인합니다.

```bash
Grep pattern="^from app\.schemas\.\w+ import" path="backend/app/api/v1/" output_mode="content"
```

각 import된 클래스에 대해 해당 스키마 파일에 `class <ClassName>` 이 존재하는지 확인합니다.

**PASS 기준:** 모든 import된 스키마 클래스가 정의됨.

**FAIL:** 존재하지 않는 스키마를 사용하면 ImportError 발생.

### Step 4: Cross-service import 순환 의존 검사

**도구:** Grep

서비스 파일 간의 import를 추적하여 순환 의존이 없는지 확인합니다.

```bash
Grep pattern="^from app\.services\." path="backend/app/services/" output_mode="content"
```

**PASS 기준:** import 그래프에 순환이 없음. 허용되는 방향:
- `mastery.py` → `mastery_engine.py` (OK)
- `stage_test.py` → `mastery_engine.py`, `mastery.py` (OK)
- `test.py` → `level_engine.py` (OK)

**FAIL:** A → B → A 형태의 순환 import가 존재하면 런타임 에러 발생.

### Step 5: DB Model 참조 검증

**도구:** Grep

서비스에서 사용하는 DB 모델 클래스가 models/ 디렉토리에 존재하는지 확인합니다.

```bash
Grep pattern="^from app\.models\.\w+ import" path="backend/app/services/" output_mode="content"
```

**PASS 기준:** 모든 import된 모델 클래스가 해당 파일에 정의됨.

**FAIL:** 존재하지 않는 모델을 사용하면 ImportError 발생.

## Output Format

```markdown
## API 일관성 검증 결과

| 검사 항목 | 상태 | 이슈 수 | 상세 |
|-----------|------|---------|------|
| Router import 유효성 | PASS/FAIL | N | ... |
| Service 함수 존재 | PASS/FAIL | N | ... |
| Schema 모델 참조 | PASS/FAIL | N | ... |
| 순환 의존 | PASS/FAIL | N | ... |
| DB Model 참조 | PASS/FAIL | N | ... |
```

## Exceptions

1. **라우터 내 직접 DB 쿼리** — `test_configs.py`, `users.py`, `words.py`, `tts.py`는 서비스 레이어 없이 직접 DB 쿼리를 수행함. 이는 아키텍처 선택이며 검증 위반이 아님.
2. **private 함수 import** — `mastery.py`의 `_get_assignment_and_config`, `_ensure_mastery_records` 등이 다른 서비스에서 import되는 것은 허용. 언더스코어 접두사는 외부 API가 아닌 모듈 내부 사용을 의미하지만, 같은 패키지 내 사용은 허용.
3. **level_engine, report_engine** — 이 파일들은 유틸리티/계산 모듈로, 전통적인 서비스 레이어가 아님. 라우터에서 직접 import하는 것은 정상.