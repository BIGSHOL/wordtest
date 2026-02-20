---
name: verify-question-pipeline
description: 문제 생성 파이프라인의 외래어 필터링, 중복 제거, 생성 함수 호출 일관성을 검증합니다. 문제 생성 관련 코드 수정 후 사용.
---

# 문제 생성 파이프라인 검증

## Purpose

1. **외래어 필터링 일관성** — 모든 문제 생성 경로에서 `is_likely_loanword` / `filter_loanwords` 필터가 적용되는지 검증
2. **중복 제거 일관성** — 모든 배치 선택 지점에서 한국어 의미 기준 중복 제거(`dedup_words`)가 적용되는지 검증
3. **생성 함수 호출 정합성** — `generate_questions_for_words()` 호출 전 필터링이 완료되었는지 검증
4. **Import 일관성** — 필터/유틸 함수가 필요한 모든 서비스에서 올바르게 import 되는지 검증

## When to Run

- `test_common.py`, `levelup_service.py`, `legacy_service.py` 수정 후
- `question_engines/` 디렉토리의 엔진 추가/수정 후
- 새로운 문제 생성 경로 또는 엔진 타입 추가 후
- 외래어 감지 로직이나 중복 제거 로직 변경 후
- 단어 필터링 관련 버그 수정 후

## Related Files

| File | Purpose |
|------|---------|
| `backend/app/services/test_common.py` | 공통 유틸: `is_likely_loanword()`, `filter_loanwords()`, `generate_questions_for_words()`, `check_typing_answer()` 정의 |
| `backend/app/services/levelup_service.py` | 레벨업(적응형) 엔진 세션 관리 |
| `backend/app/services/legacy_service.py` | 레거시(고정형) 엔진 세션 관리 |
| `backend/app/services/question_engines/__init__.py` | 문제 엔진 레지스트리 (`get_engine()`) |
| `backend/app/services/question_engines/base.py` | 문제 엔진 베이스 클래스 |
| `backend/app/services/question_engines/en_to_ko.py` | 영한 문제 엔진 |
| `backend/app/services/question_engines/ko_to_en.py` | 한영 문제 엔진 |
| `backend/app/services/question_engines/listen_en.py` | 듣기→영어 문제 엔진 |
| `backend/app/services/question_engines/listen_ko.py` | 듣기→한국어 문제 엔진 |
| `backend/app/services/question_engines/listen_type.py` | 듣기→타이핑 문제 엔진 |
| `backend/app/services/question_engines/ko_type.py` | 한영 타이핑 문제 엔진 |
| `backend/app/services/question_engines/emoji.py` | 이모지 문제 엔진 |
| `backend/app/services/question_engines/sentence.py` | 예문 빈칸 문제 엔진 |
| `backend/app/services/emoji_engine.py` | 이모지 매핑 엔진 |

## Workflow

### Step 1: is_likely_loanword / filter_loanwords Import 검증

**도구:** Grep

모든 문제 생성 서비스 파일에서 `is_likely_loanword` 또는 `filter_loanwords` import를 확인합니다.

```bash
Grep pattern="is_likely_loanword|filter_loanwords" path="backend/app/services/" output_mode="content"
```

**PASS 기준:** 다음 파일에 관련 import/정의가 존재:
- `test_common.py` — 함수 정의 (`def is_likely_loanword`, `def filter_loanwords`)
- `levelup_service.py` — `from app.services.test_common import filter_loanwords`
- `legacy_service.py` — `from app.services.test_common import filter_loanwords`

**FAIL:** 위 파일 중 하나라도 import가 없으면 해당 경로에서 외래어가 출제됨.

**수정:** 누락된 파일에 `from app.services.test_common import filter_loanwords` 추가.

### Step 2: 외래어 필터 적용 검증

**도구:** Grep, Read

각 문제 생성 경로에서 `filter_loanwords` 호출이 있는지 확인합니다.

```bash
Grep pattern="filter_loanwords" path="backend/app/services/levelup_service.py" output_mode="content"
Grep pattern="filter_loanwords" path="backend/app/services/legacy_service.py" output_mode="content"
```

**PASS 기준:** 각 파일에서 단어를 선택하는 지점에 `filter_loanwords` 호출이 포함됨:
- `levelup_service.py`: `start_session()` 및 `fetch_level_questions()` 내 단어 필터링
- `legacy_service.py`: `start_session()` 내 단어 필터링

**FAIL:** 필터 호출 없이 `generate_questions_for_words()`를 호출하는 경로가 있으면 외래어가 출제됨.

### Step 3: 중복 제거 적용 검증

**도구:** Grep, Read

한국어 의미 기준 중복 제거가 모든 배치 선택 지점에서 적용되는지 확인합니다.

```bash
Grep pattern="dedup_words" path="backend/app/services/" output_mode="content"
```

**PASS 기준:**
- `test_common.py`: `dedup_words()` 함수 정의 존재
- `levelup_service.py`: `start_session()` 및 `fetch_level_questions()`에서 `dedup_words()` 호출
- `legacy_service.py`: `start_session()`에서 `dedup_words()` 호출

**FAIL:** 중복 제거 없이 배치를 구성하면 동일 의미 문제가 반복 출제됨.

### Step 4: generate_questions_for_words 호출 사이트 검증

**도구:** Grep

모든 `generate_questions_for_words` 호출 위치를 확인하고, 각 호출 전에 필터링이 선행되는지 검증합니다.

```bash
Grep pattern="generate_questions_for_words\(" path="backend/app/services/" output_mode="content" -B=5
```

**PASS 기준:** 모든 호출 사이트에서:
1. 전달되는 words가 이미 `filter_loanwords()` 처리됨
2. 전달되는 words가 이미 `dedup_words()` 처리됨

**FAIL:** 필터링되지 않은 데이터로 생성 함수를 호출하는 경우.

### Step 5: test_common.py 내부 일관성

**도구:** Read

`is_likely_loanword()` 함수의 핵심 요소가 존재하는지 확인합니다.

```bash
Grep pattern="_KO_CONSONANT_MAP|_EN_DIGRAPHS|_KO_NATIVE_SUFFIXES|SequenceMatcher" path="backend/app/services/test_common.py" output_mode="content"
```

**PASS 기준:**
- `_KO_CONSONANT_MAP` 딕셔너리 존재 (한국어 자음 매핑)
- `_EN_DIGRAPHS` 리스트 존재 (영어 이중자음)
- `_KO_NATIVE_SUFFIXES` 튜플 존재 (한국어 문법 접미사)
- `SequenceMatcher` import 존재

**FAIL:** 핵심 구성 요소 누락 시 외래어 감지가 작동하지 않음.

### Step 6: question_engines 레지스트리 일관성

**도구:** Grep

`question_engines/__init__.py`의 엔진 레지스트리가 모든 엔진 파일을 포함하는지 확인합니다.

```bash
Grep pattern="from.*question_engines" path="backend/app/services/question_engines/__init__.py" output_mode="content"
Grep pattern="get_engine|ENGINES" path="backend/app/services/question_engines/__init__.py" output_mode="content"
```

**PASS 기준:** 레지스트리에 등록된 엔진이 실제 파일과 일치:
- `en_to_ko`, `ko_to_en`, `listen_en`, `listen_ko`, `listen_type`, `ko_type`, `emoji`, `sentence`

**FAIL:** 레지스트리에 없는 엔진 타입이 config에서 사용되면 런타임 에러 발생.

## Output Format

```markdown
## 문제 생성 파이프라인 검증 결과

| 검사 항목 | 파일 | 상태 | 상세 |
|-----------|------|------|------|
| 외래어 필터 import | levelup_service.py | PASS/FAIL | ... |
| 외래어 필터 import | legacy_service.py | PASS/FAIL | ... |
| 외래어 필터 적용 | levelup_service.py:start_session | PASS/FAIL | ... |
| 외래어 필터 적용 | legacy_service.py:start_session | PASS/FAIL | ... |
| 중복 제거 적용 | levelup_service.py | PASS/FAIL | ... |
| 중복 제거 적용 | legacy_service.py | PASS/FAIL | ... |
| 생성 함수 사전 필터 | 전체 호출 사이트 | PASS/FAIL | ... |
| test_common 내부 일관성 | test_common.py | PASS/FAIL | ... |
| 엔진 레지스트리 | question_engines/__init__.py | PASS/FAIL | ... |
```

## Exceptions

1. **test_common.py의 generate_questions_for_words() 내부에는 필터링 불필요** — 이 함수는 이미 필터링된 단어를 받아 문제를 생성만 담당. 호출자(caller)가 filter_loanwords + dedup_words를 선행 호출하는 것이 정상 패턴.
2. **distractor pool에는 외래어 포함 가능** — `question_engines/distractors.py`의 선택지 풀에 외래어가 포함되는 것은 정상. 정답 단어만 필터링하면 됨.
3. **report_engine.py, auth.py 등 비문제 서비스** — 문제 생성과 무관한 서비스 파일에 외래어 필터가 없는 것은 정상.
4. **emoji_engine.py** — 이모지 매핑 전용 유틸로, 외래어 필터링과 무관.
