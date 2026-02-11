# WordLvTest 전체 시스템 문서

> 영단어 레벨테스트 + 적응형 마스터리 학습 플랫폼의 통합 기술 문서
> Last updated: 2026-02-11

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [랭크 시스템](#2-랭크-시스템)
3. [레벨 테스트 (Placement Test)](#3-레벨-테스트-placement-test)
4. [마스터리 학습 (Mastery Learning)](#4-마스터리-학습-mastery-learning)
5. [문제 출제 엔진](#5-문제-출제-엔진)
6. [리포트 엔진](#6-리포트-엔진)
7. [TTS 시스템](#7-tts-시스템)
8. [데이터 모델](#8-데이터-모델)
9. [API 엔드포인트](#9-api-엔드포인트)
10. [프론트엔드 아키텍처](#10-프론트엔드-아키텍처)
11. [인프라](#11-인프라)

---

## 1. 시스템 개요

### 1.1 두 가지 학습 모드

| 모드 | 목적 | 문항 수 | 난이도 조절 |
|------|------|---------|-------------|
| **레벨 테스트** | 학생의 현재 어휘력 레벨 진단 | 20문항 | 커서 기반 적응형 |
| **마스터리 학습** | 단어별 5단계 숙달 + 레벨업 | 50문항 | XP 기반 실시간 |

### 1.2 시작 방식

```
[학생]
  ├── 로그인 → 메인페이지 → "배치고사" 클릭 → 레벨 테스트 (20문항)
  └── 테스트 코드 입력 (8자리) → 자동 분기
        ├── assignment_type = "mastery" → 마스터리 학습 (50문항)
        └── assignment_type = "test"    → 레벨 테스트 (설정된 문항수)
```

### 1.3 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 18 + TypeScript + Vite + Tailwind CSS |
| 상태 관리 | Zustand (testStore, masteryStore, authStore) |
| 백엔드 | FastAPI + SQLAlchemy (async) + Alembic |
| 데이터베이스 | Supabase PostgreSQL (싱가포르 리전) |
| 배포 | Railway (싱가포르 리전) |
| TTS | Gemini 2.5 Flash Preview TTS + Dictionary API |

---

## 2. 랭크 시스템

### 2.1 10단계 랭크 (LoL 스타일)

| 랭크 | 이름 | 한국어 | 교재 | 학년 수준 | 색상 |
|------|------|--------|------|-----------|------|
| 1 | Iron | 아이언 | POWER VOCA 5000-01 | 초등 1-2 | `#71717A → #3F3F46` |
| 2 | Bronze | 브론즈 | POWER VOCA 5000-02 | 초등 3-4 | `#CD7F32 → #8B5E3C` |
| 3 | Silver | 실버 | POWER VOCA 5000-03 | 초등 5-6 | `#C0C0C0 → #909090` |
| 4 | Gold | 골드 | POWER VOCA 5000-04 | 중등 1 | `#FFD700 → #B8860B` |
| 5 | Platinum | 플래티넘 | POWER VOCA 5000-05 | 중등 2 | `#5EEAD4 → #0D9488` |
| 6 | Emerald | 에메랄드 | POWER VOCA 5000-06 | 중등 3 | `#34D399 → #059669` |
| 7 | Diamond | 다이아몬드 | POWER VOCA 5000-07 | 고등 1 | `#93C5FD → #3B82F6` |
| 8 | Master | 마스터 | POWER VOCA 5000-08 | 고등 2 | `#C084FC → #7C3AED` |
| 9 | Grandmaster | 그랜드마스터 | POWER VOCA 5000-09 | 고등 3 | `#FCA5A5 → #DC2626` |
| 10 | Challenger | 챌린저 | POWER VOCA 5000-10 | 대학/성인 | `#FFD700 → #DC2626` |

### 2.2 서브레벨

- 각 랭크 내에 **25개 서브레벨** (교재 내 Lesson 수)
- 표기: `Iron 1-5`, `Gold 4-12`, `Diamond 7-MAX`
- MAX = 해당 랭크의 모든 레슨 마스터
- **Challenger(Rank 10)**: Word Level 10~15가 모두 매핑됨. Book 10(기본) + Book 11~15(수능기출 고급) 통합. 서브레벨은 마스터리 세션의 레슨 진행 기준으로 결정

### 2.3 매핑 함수

```python
# 백엔드: Word DB level (1-15) → Rank (1-10)
def word_level_to_rank(word_level: int) -> int:
    return min(word_level, 10)
# Level 11-15 (수능기출) → Rank 10 (Challenger)에 통합
```

```typescript
// 프론트엔드: 동일 매핑
function wordLevelToRank(wordLevel: number): number {
  return Math.min(wordLevel, 10);
}
```

---

## 3. 레벨 테스트 (Placement Test)

### 3.1 개요

학생의 어휘력을 **20문항**으로 빠르게 진단하는 적응형 테스트.

### 3.2 적응형 난이도 커서

```
문제 풀(60문항)이 Level→Lesson 순서로 정렬됨
커서(float)가 풀 인덱스를 가리킴 → 가장 가까운 미사용 문항 선택

정답 + 빠른풀이(< 4초) → 커서 +3 (난이도 크게 상승)
정답 + 보통(4~8초)     → 커서 +2
정답 + 느림(> 8초)     → 커서 +1
오답                    → 커서 -1 (난이도 하락)
```

### 3.3 레벨 판정 알고리즘

```python
def determine_level(answers) -> (rank, sublevel):
    # 1) 답안을 랭크별로 그룹핑
    # 2) 각 랭크의 정답률 ≥ 50% → "통과"
    # 3) 최고 통과 랭크 = determined_rank (연속 2회 실패 시 중단)
    # 4) 서브레벨: 통과 랭크 내 가장 높은 정답 레슨 인덱스
    # 5) 전부 정답 + 2문항 이상 → sublevel = 25 (MAX)
```

### 3.4 프론트엔드 실시간 레벨 표시

`testStore`에서 매 답변마다 `determineLevel()` 호출 → 헤더의 랭크 뱃지가 실시간 변경

### 3.5 테스트 유형

| 유형 | 시작 방법 | 풀 크기 | 답변 수 |
|------|----------|---------|---------|
| 배치고사 (코드 없음) | 메인 → 배치고사 | 60문항 | 20문항 |
| 배치고사 (코드) | 테스트 코드 입력 | 설정값 × 3 | 설정값 |
| 정기시험 (코드) | 테스트 코드 입력 | 설정값 | 설정값 (전부) |

---

## 4. 마스터리 학습 (Mastery Learning)

### 4.1 핵심 원칙

- 사용자에게 **스테이지 구분 없음** (내부적으로만 1~5단계 관리)
- **50문항 단일 플로우** (중간 전환 없음)
- **실시간 XP 기반 레벨 진행** (RPG 방식)
- **문제 유형 자동 혼합** (선택/타이핑/듣기)

### 4.2 XP 메카닉스

#### 기본 XP

| 상황 | XP | 조건 |
|------|-----|------|
| 현재 레벨 정답 | +7 | 기본 |
| 현재 레벨 정답 (빠름) | +12 | 제한시간의 50% 이내 |
| 낮은 레벨 정답 | +3 | 쉬운 문제 |
| 오답 (1회) | -5 | 기본 패널티 |
| 오답 (2연속) | -8 | 강화 패널티 |
| 오답 (3연속+) | -12 | 최대 패널티 |

#### 콤보 보너스

| 콤보 | 추가 XP |
|------|---------|
| 3~4 | +1 |
| 5~9 | +2 |
| 10~14 | +3 |
| 15~19 | +4 |
| 20+ | +5 |

#### 레슨당 필요 XP

```typescript
function getLessonXp(book: number): number {
  return 5 + book * 5;  // Book 1: 10, Book 2: 15, ..., Book 10: 55
}
```

| 교재 | 레슨당 XP | 총 XP (25레슨) | 누적 XP |
|------|----------|----------------|---------|
| 1권 | 10 | 250 | 250 |
| 2권 | 15 | 375 | 625 |
| 3권 | 20 | 500 | 1,125 |
| ... | ... | ... | ... |
| 10권 | 55 | 1,375 | 8,125 |

### 4.3 레벨업/다운

- **레벨업**: 레슨 XP 달성 → 다음 레슨 (초과 XP 이월). 25레슨 클리어 → 다음 교재
- **레벨다운**: XP < 0 → 이전 레슨으로 강등 (이전 레슨 XP의 80% 지점에서 시작)

### 4.4 문제 풀 시스템

```
세션 시작 시:
  서버에서 멀티레벨 문제 풀 로드 (현재 레벨 ~ +4레벨, 각 10문항)
  → levelPools = { 1: [10문항], 2: [10문항], 3: [10문항], ... }

현재 레벨 풀에서 순서대로 출제
레벨 변경 시 → 해당 레벨 풀로 즉시 전환
풀 소진 시 → 서버에서 lazy fetch (POST /mastery/batch)
```

### 4.5 단어별 내부 마스터리 (비공개)

| 내부 스테이지 | 문제 유형 | 정답 | 오답 보기 출처 | 타이머 |
|--------------|----------|------|---------------|--------|
| 1 (새 단어) | 영어 → **한국어 뜻** 선택 (`word_to_meaning`) | `word.korean` | 다른 단어의 한국어 뜻 3개 | 5초 |
| 2 | 한국어 뜻 → **영단어** 선택 (`meaning_to_word`) | `word.english` | 다른 영단어 3개 | 5초 |
| 3 | 발음 듣고 **영단어 타이핑** (`listen_and_type`) | `word.english` | — | 15초 |
| 4 | 발음 듣고 **한국어 뜻** 선택 (`listen_to_meaning`) | `word.korean` | 다른 단어의 한국어 뜻 3개 | 10초 |
| 5 | 한국어 뜻 보고 **영단어 타이핑** (`meaning_and_type`) | `word.english` | — | 15초 |

승급 조건 (연속 정답 streak):
- Level 1-3 단어: 2회
- Level 4-6: 3회
- Level 7-9: 4회
- Level 10-12: 5회
- Level 13-15: 6회

오답 시: 이전 스테이지 강등 + streak 리셋

**"거의 맞음" (almost_correct) 처리:**
타이핑 문제에서 Levenshtein 거리 = 1 (3글자 이상 단어)이면 "거의 맞음" 판정.
이 경우 **스테이지 변동 없음** (승급도 강등도 아님), streak도 변하지 않음.
사용자에게 "거의 맞았어요!" 피드백 표시 후 정답 공개. XP 계산에서도 정답/오답 어느 쪽에도 해당하지 않는 **중립 처리**.

### 4.6 예문 출제 확률

| Word Level | 예문 확률 |
|-----------|----------|
| 1-3 | 0% |
| 4-5 | 20% |
| 6-7 | 40% |
| 8-9 | 60% |
| 10-12 | 80% |
| 13-15 | 100% |

### 4.7 50문항 시뮬레이션

XP 계산 가정:
- 최대 XP/문항 = 7(base) + 5(speed) + 5(combo20+) = **17**
- 콤보 빌드업 고려 평균 ≈ **14 XP/문항** (초반 콤보 보너스 없음)

```
천재 학생 (전부 정답 + 빠름, 평균 ~14 XP/문항):
  총 XP ≈ 700
  문항 1~18  → 1권 클리어 (250 XP, 잔여 ~2 XP)
  문항 19~43 → 2권 클리어 (375 XP)
  문항 44~50 → 3권 진행 (잔여 ~75 XP, 레슨당 20 XP)
  최종: Level 3-3 ~ 3-4

우수 학생 (정답률 85%, 보통 속도): Level 2 중반
보통 학생 (정답률 65%): Level 1-15 ~ 1-25
부진 학생 (정답률 40% 이하): Level 1-5 이하
```

---

## 5. 문제 출제 엔진

### 5.1 level_engine.py (레벨 테스트용)

```python
async def generate_questions(
    db, num_questions, level_min, level_max,
    book_name, lesson_start, lesson_end, question_types
) -> list[dict]:
```

- 레벨별 단어를 DB에서 조회 후 비례 배분
- 각 레벨 내 **레슨 균등 간격** 선택 (적응형 테스트 정밀도 향상)
- 오답 보기: 같은 의미 풀에서 랜덤 3개 선택

문제 유형: `word_meaning` (영→한), `meaning_word` (한→영), `sentence_blank` (빈칸)

### 5.2 mastery_engine.py (마스터리용)

```python
def generate_mixed_questions(masteries, words_map, all_words) -> list[MasteryQuestion]:
```

- 각 단어의 내부 마스터리 스테이지에 따라 문제 유형 자동 결정
- 예문 모드: 단어 레벨에 따른 확률적 적용
- 빈칸 생성: 정규식 기반 (원형 + 굴절형 매칭)
- 타이핑 답변 검증: Levenshtein 거리 1 (3글자 이상) = "거의 맞음" → 정답/오답 모두 아닌 **중립 처리** (스테이지 변동 없음, streak 유지)

---

## 6. 리포트 엔진

### 6.1 레이더 차트 (4축)

| 축 | 계산 방식 | 범위 |
|----|----------|------|
| 어휘수준 | `determined_level` (1-10) | 0-10 |
| 정답률 | `correct / total * 10` | 0-10 |
| 속도 | `10 - (avg_time / 3)` (3초=10점, 30초=0점) | 0-10 |
| 어휘사이즈 | `min(10, (mastered_words + correct_words) / total_words_in_db * 10)` | 0-10 |

### 6.2 동료 비교

- 같은 학년(grade) 학생들의 최고 점수와 백분위 비교
- `percentile`: 상위 N% 표시

### 6.3 메트릭 해석 (3단계)

| 점수 | 구간 | 메시지 |
|------|------|--------|
| 0-3 | low | "기초 학습 단계" 등 |
| 4-6 | mid | "안정적인 수준" 등 |
| 7-10 | high | "우수한 수준" 등 |

### 6.4 시간 분석

답변 시간을 **단어의 난이도 레벨**별로 그룹화하여 평균 응답 속도를 비교:

| Word Level | 카테고리명 | 의미 |
|-----------|----------|------|
| 1-4 | "단어" | 기초 단어 (직접적 의미 파악) |
| 5-7 | "빈칸" | 중급 단어 (문맥/빈칸 추론 수준) |
| 8-15 | "뜻" | 고급 단어 (의미 추론/다의어 수준) |

> 주의: 카테고리명은 문제 유형이 아닌 **난이도 구간 라벨**입니다. 실제 출제되는 문제 유형(word_meaning, meaning_word, sentence_blank)과는 독립적입니다.

---

## 7. TTS 시스템

### 7.1 아키텍처

```
프론트엔드 TTS 호출
  │
  ├── 단어(speakWord): 캐시 → Gemini TTS → Web Speech API
  │     └── 프리로드: Dictionary API → (실패 시) Gemini TTS
  │
  └── 문장(speakSentence): 캐시 → Gemini TTS → Google Translate → Web Speech API
        └── 프리로드: Gemini TTS (매 5번째 문항)
```

### 7.2 Gemini TTS 설정

- 모델: `gemini-2.5-flash-preview-tts`
- 5개 음성: Aoede, Puck, Charon, Fenrir, Leda
- 세션마다 랜덤 음성 배정 (테스트 내 동일 음성 유지)
- PCM → WAV 변환 (raw `audio/L16;rate=24000` → WAV 헤더 추가)

### 7.3 백엔드 TTS 캐시

- `tts_cache` 테이블: text + voice → audio_data (bytea)
- 동일 텍스트+음성 재요청 시 DB에서 즉시 반환 (Gemini API 호출 없음)

### 7.4 프론트엔드 캐시

- `audioCache` (단어): LRU 100개, Dictionary API + Gemini TTS blob
- `sentenceCache` (문장): LRU 100개, Gemini TTS blob
- 배치 프리로드: `batchPreloadPool()` - 5개씩 300ms 간격

### 7.5 비용

| 항목 | 무료 티어 | 유료 티어 |
|------|----------|----------|
| Input | $0 | $0.50/1M tokens |
| Output (audio) | $0 | $10.00/1M tokens |
| DB 캐시 적용 시 | $0 (영구) | 일회성 생성 비용만 |

---

## 8. 데이터 모델

### 8.1 핵심 테이블

```
users                    # 학생/교사 계정
  ├── test_sessions      # 레벨 테스트 세션
  │     └── test_answers # 테스트 답안 (word_id, is_correct, answered_at)
  ├── learning_sessions  # 마스터리 학습 세션
  │     └── learning_answers  # 마스터리 답안 (time_taken_sec, answered_at 포함)
  └── word_mastery       # 단어별 마스터리 진행 (stage, streak)

words                    # 영단어 DB (11,000+)
  ├── english, korean, example_en, example_ko
  ├── level (1-15), lesson, book_name
  └── part_of_speech

test_configs             # 교사가 만든 테스트 설정
  └── test_assignments   # 학생별 개별 테스트 코드 (8자리)

tts_cache                # TTS 오디오 캐시 (text + voice → audio_data)
auth_tokens              # JWT 토큰 관리
```

### 8.2 재시험/재학습 정책

| 모드 | 재응시 가능 여부 | 동작 |
|------|---------------|------|
| **레벨 테스트** | 불가 | `assignment.status != "pending"` 체크 → 시작 후 재응시 차단 |
| **마스터리** | 조건부 | 미완료 세션 존재 시 **재개(resume)**, 없으면 새 세션 생성 |

- `word_mastery` 데이터는 **세션 간 누적** (이전 stage/streak 유지)
- 테스트 재응시가 필요하면 교사가 새 assignment(코드)를 발급해야 함
- 중도 이탈 시: 세션 `completed_at = null`로 미완료 상태 유지 → 같은 코드로 재접속하면 이어서 진행

### 8.3 WordMastery 스테이지 흐름

```
Stage 1 → (streak 달성) → Stage 2 → ... → Stage 5 → Mastered
                ↑ 오답 시 강등 ↓
```

### 8.4 TestConfig 설정 항목

| 필드 | 설명 |
|------|------|
| test_type | `placement` / `periodic` |
| question_count | 문항 수 |
| time_limit_seconds | 전체 제한 시간 |
| level_range_min/max | 출제 레벨 범위 (1-15) |
| lesson_range_start/end | 출제 레슨 범위 |
| book_name | 교재 필터 |
| question_types | `word_meaning,meaning_word,sentence_blank` |

---

## 9. API 엔드포인트

### 9.1 레벨 테스트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/tests/start` | 테스트 시작 (인증 필요) |
| POST | `/api/v1/tests/start-by-code` | 코드로 시작 (인증 불필요, JWT 발급) |
| POST | `/api/v1/tests/{id}/answer` | 답안 제출 |
| GET | `/api/v1/tests/{id}/result` | 결과 조회 |
| GET | `/api/v1/tests` | 테스트 목록 |

### 9.2 마스터리

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/v1/mastery/start-by-code` | 마스터리 시작 (코드 → JWT + 문제 풀) |
| POST | `/api/v1/mastery/batch` | 추가 문항 요청 (lazy loading) |
| POST | `/api/v1/mastery/{session_id}/answer` | 답안 제출 + 마스터리 처리 |
| POST | `/api/v1/mastery/complete-batch` | 50문항 완료, final_level 저장 |
| GET | `/api/v1/mastery/progress/{assignment_id}` | 학생별 진행 현황 |

### 9.3 TTS

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/tts?text=...&voice=Aoede` | Gemini TTS 생성 (DB 캐시 활용) |

### 9.4 통계/리포트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/stats/report/{test_id}` | 상세 리포트 (레이더 차트, 시간 분석) |
| GET | `/api/v1/stats/dashboard` | 교사 대시보드 통계 |
| GET | `/api/v1/stats/students` | 학생 목록 + 최근 점수 |

---

## 10. 프론트엔드 아키텍처

### 10.1 라우팅

```
/                   → LoginPage (코드 입력 가능)
/test/start         → TestStartPage (8자리 코드 입력 → 자동 분기)
/test               → TestPage (레벨 테스트)
/mastery            → MasteryPage (마스터리 학습)
/result/:id         → ResultPage (테스트 결과)
/student            → MainPage (학생 메인)
/teacher            → DashboardPage (교사 대시보드)
/teacher/statistics → StatisticsPage
/teacher/students   → StudentManagePage
/teacher/tests      → TestSettingsPage
/teacher/words      → WordDatabasePage
```

### 10.2 상태 관리 (Zustand)

| Store | 용도 |
|-------|------|
| `authStore` | 로그인/JWT/사용자 정보 |
| `testStore` | 레벨 테스트 (적응형 커서, 랭크 판정) |
| `masteryStore` | 마스터리 학습 (XP, 레벨, 풀 관리) |

### 10.3 주요 컴포넌트

**테스트용:**
- `QuizHeader` - 랭크 뱃지 + 진행바 + 타이머
- `WordCard` - 영단어 표시 + 발음 듣기
- `MeaningCard` - 한국어 뜻 표시
- `SentenceCard` - 예문 표시 + 발음 듣기
- `ChoiceButton` - 4지선다 보기
- `FeedbackBanner` - 정답/오답 피드백

**마스터리용:**
- `MasteryHeader` - 랭크 뱃지 + XP 프로그레스 바 + 콤보
- `ListenCard` - 듣기 문제 카드
- `TypingInput` - 타이핑 입력
- `ComboCounter` - 콤보 카운터
- `GrowthProgressBar` - XP 진행 바
- `StageTransition` - 레벨 변경 애니메이션

**리포트용:**
- `RadarChart` - 4축 레이더 차트
- `LevelChartTable` - 레벨별 정답률
- `TimeBreakdown` - 시간 분석
- `OverallResult` - 종합 결과
- `OXGrid` - 문항별 O/X 그리드
- `WrongAnalysis` - 오답 분석

---

## 11. 인프라

### 11.1 배포 환경

| 서비스 | 리전 | 용도 |
|--------|------|------|
| Railway | 싱가포르 | FastAPI 백엔드 + Vite 프론트엔드 |
| Supabase | 싱가포르 | PostgreSQL DB |

### 11.2 환경 변수

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | Supabase Transaction Pooler (port 6543) |
| `DIRECT_DATABASE_URL` | Supabase Session Pooler (port 5432, Alembic용) |
| `GEMINI_API_KEY` | Google Gemini TTS API 키 |
| `SECRET_KEY` | JWT 서명 키 |
| `SUPABASE_URL` | Supabase 프로젝트 URL |

### 11.3 DB 마이그레이션

Alembic 체인 (12개 마이그레이션):
```
initial_schema
  → add_word_extended_columns
  → add_auth_tokens_table (IF EXISTS 체크)
  → add_test_configs_table
  → add_test_code_and_config_id
  → add_rank_sublevel_columns
  → add_school_grade_to_users
  → datetime_to_timestamptz
  → add_test_assignments
  → add_tts_cache_table
  → individual_test_codes
  → add_mastery_tables
```

주의: Alembic DDL은 반드시 **Session Pooler (5432)** 사용. Transaction Pooler (6543)는 DDL 미지원.

### 11.4 데이터 현황

| 테이블 | 레코드 수 |
|--------|----------|
| words | 11,129 |
| users | 55 |
| test_sessions | 19 |
| test_configs | 3 |

---

*이 문서는 시스템 전체 설계와 구현을 반영하며, 코드 변경 시 함께 업데이트되어야 합니다.*
