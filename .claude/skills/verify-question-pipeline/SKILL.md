---
name: verify-question-pipeline
description: 문제 생성 파이프라인의 외래어 필터링, 중복 제거, 생성 함수 호출 일관성을 검증합니다. 문제 생성 관련 코드 수정 후 사용.
---

# 문제 생성 파이프라인 검증

## Purpose

1. **외래어 필터링 일관성** — 모든 문제 생성 경로에서 `is_likely_loanword` 필터가 적용되는지 검증
2. **중복 제거 일관성** — 모든 배치 선택 지점에서 한국어 의미 기준 중복 제거가 적용되는지 검증
3. **생성 함수 호출 정합성** — `generate_*_questions()` 호출 전 필터링이 완료되었는지 검증
4. **Import 일관성** — 필터/유틸 함수가 필요한 모든 서비스에서 올바르게 import 되는지 검증

## When to Run

- `mastery_engine.py`, `mastery.py`, `stage_test.py`, `level_engine.py`, `test.py` 수정 후
- 새로운 문제 생성 경로 또는 엔진 타입 추가 후
- 외래어 감지 로직이나 중복 제거 로직 변경 후
- 단어 필터링 관련 버그 수정 후

## Related Files

| File | Purpose |
|------|---------|
| `backend/app/services/mastery_engine.py` | 문제 생성 핵심 엔진 + `is_likely_loanword()` 정의 |
| `backend/app/services/mastery.py` | XP 마스터리 세션 관리 + `_dedup_by_meaning()` 정의 |
| `backend/app/services/stage_test.py` | 스테이지 테스트 서비스 |
| `backend/app/services/level_engine.py` | 레벨(배치) 테스트 문제 생성 |
| `backend/app/services/test.py` | 테스트 세션 서비스 (level_engine 호출) |

## Workflow

### Step 1: is_likely_loanword Import 검증

**도구:** Grep

모든 문제 생성 서비스 파일에서 `is_likely_loanword` import를 확인합니다.

```bash
Grep pattern="is_likely_loanword" path="backend/app/services/" output_mode="content"
```

**PASS 기준:** 다음 파일에 `is_likely_loanword` import가 존재:
- `mastery_engine.py` — 함수 정의 (def is_likely_loanword)
- `mastery.py` — import from mastery_engine
- `stage_test.py` — import from mastery_engine
- `level_engine.py` — import from mastery_engine

**FAIL:** 위 파일 중 하나라도 import가 없으면 해당 경로에서 외래어가 출제됨.

**수정:** 누락된 파일에 `from app.services.mastery_engine import is_likely_loanword` 추가.

### Step 2: 외래어 필터 적용 검증

**도구:** Grep, Read

각 문제 생성 경로에서 `is_likely_loanword` 호출이 있는지 확인합니다.

```bash
Grep pattern="is_likely_loanword" path="backend/app/services/mastery.py" output_mode="content"
Grep pattern="is_likely_loanword" path="backend/app/services/stage_test.py" output_mode="content"
Grep pattern="is_likely_loanword" path="backend/app/services/level_engine.py" output_mode="content"
```

**PASS 기준:** 각 파일에서 단어를 선택하는 모든 루프/컴프리헨션에 `is_likely_loanword` 필터가 포함됨:
- `mastery.py`: `get_question_pool()` 내 level_masteries 필터링, `get_level_questions()` 내 mastery 필터링
- `stage_test.py`: `start_by_code()` 내 word_infos 구축 시 필터링
- `level_engine.py`: `generate_questions()` 내 단어 선택 시 필터링

**FAIL:** 필터 호출 없이 `generate_*_questions()`를 호출하는 경로가 있으면 외래어가 출제됨.

### Step 3: 중복 제거 적용 검증

**도구:** Grep, Read

한국어 의미 기준 중복 제거가 모든 배치 선택 지점에서 적용되는지 확인합니다.

```bash
Grep pattern="_dedup_by_meaning|seen_korean" path="backend/app/services/" output_mode="content"
```

**PASS 기준:**
- `mastery.py`: `get_question_pool()`, `get_level_questions()` 모두에서 `_dedup_by_meaning()` 호출
- `stage_test.py`: `start_by_code()`에서 `seen_korean`/`seen_english` 세트 기반 중복 제거
- `level_engine.py`: 한국어 의미 기준 중복 제거 존재

**FAIL:** 중복 제거 없이 배치를 구성하면 동일 의미 문제가 반복 출제됨.

### Step 4: generate_*_questions 호출 사이트 검증

**도구:** Grep

모든 `generate_*_questions` 호출 위치를 확인하고, 각 호출 전에 필터링이 선행되는지 검증합니다.

```bash
Grep pattern="generate_(stage|mixed|word|listen)_questions\(" path="backend/app/services/" output_mode="content" -B=5
```

**PASS 기준:** 모든 호출 사이트에서:
1. 전달되는 masteries/words가 이미 외래어 필터링됨
2. 전달되는 masteries/words가 이미 중복 제거됨

**FAIL:** 필터링되지 않은 데이터로 생성 함수를 호출하는 경우.

### Step 5: mastery_engine.py 내부 일관성

**도구:** Read

`is_likely_loanword()` 함수의 핵심 요소가 존재하는지 확인합니다.

```bash
Grep pattern="_KO_CONSONANT_MAP|_EN_DIGRAPHS|_KO_NATIVE_SUFFIXES|SequenceMatcher" path="backend/app/services/mastery_engine.py" output_mode="content"
```

**PASS 기준:**
- `_KO_CONSONANT_MAP` 딕셔너리 존재 (한국어 자음 매핑)
- `_EN_DIGRAPHS` 리스트 존재 (영어 이중자음)
- `_KO_NATIVE_SUFFIXES` 튜플 존재 (한국어 문법 접미사)
- `SequenceMatcher` import 존재

**FAIL:** 핵심 구성 요소 누락 시 외래어 감지가 작동하지 않음.

## Output Format

```markdown
## 문제 생성 파이프라인 검증 결과

| 검사 항목 | 파일 | 상태 | 상세 |
|-----------|------|------|------|
| 외래어 필터 import | mastery.py | PASS/FAIL | ... |
| 외래어 필터 적용 | mastery.py:get_question_pool | PASS/FAIL | ... |
| 중복 제거 적용 | stage_test.py:start_by_code | PASS/FAIL | ... |
| 생성 함수 호출 사전 필터 | level_engine.py | PASS/FAIL | ... |
```

## Exceptions

1. **mastery_engine.py 자체에는 필터링 불필요** — 이 파일은 문제 생성만 담당하며, 필터링은 호출자(caller)의 책임. generate_*_questions() 내부에 is_likely_loanword 호출이 없는 것은 정상.
2. **distractor pool에는 외래어 포함 가능** — `unique_korean`, `unique_english` 등 선택지 풀에 외래어가 포함되는 것은 정상. 정답 단어만 필터링하면 됨.
3. **report_engine.py, auth.py 등 비문제 서비스** — 문제 생성과 무관한 서비스 파일에 외래어 필터가 없는 것은 정상.