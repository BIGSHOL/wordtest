# 전체 테스트 기능 목록

**프로젝트**: Word Level Test System
**최종 업데이트**: 2026-02-12

---

## 🎯 테스트 시스템 구조

우리 시스템은 **3가지 독립적인 테스트 방식**을 제공합니다:

1. **일반 테스트** (Test) - 전통적인 시험
2. **스테이지 테스트** (Stage Test) - 4단계 난이도 학습
3. **마스터리 레벨업** (Mastery) - XP 기반 적응형 레벨 판정

---

## 1️⃣ 일반 테스트 (Regular Test)

### 개요
- **목적**: 전통적인 어휘 시험
- **특징**: 고정된 문항, 일괄 채점, 리포트 생성
- **assignment_type**: `test`

### 기능

#### 1.1 테스트 출제 (Teacher)
**위치**: `frontend/src/pages/teacher/TestSettingsPage.tsx`

**기능**:
- 시험 생성 (이름, 유형, 문항 수, 시간 제한)
- 레벨 범위 선택 (Lv.1~15)
- 교재/레슨 범위 선택 가능
- 학생 배정 (개별/그룹)

**API**:
- `POST /api/v1/test-configs` - 테스트 설정 생성
- `POST /api/v1/test-assignments` - 학생에게 배정
- `GET /api/v1/test-configs` - 테스트 목록 조회

**백엔드 모듈**:
- `backend/app/services/test_config.py` - 설정 관리
- `backend/app/services/test_assignment.py` - 배정 관리
- `backend/app/models/test_config.py` - 설정 모델
- `backend/app/models/test_assignment.py` - 배정 모델

#### 1.2 테스트 응시 (Student)
**위치**: `frontend/src/pages/student/TestStartPage.tsx`, `TestPage.tsx`

**기능**:
- 배정된 시험 목록 확인
- 시험 코드 입력으로 시작
- 문제 풀이 (선택형/타이핑)
- 타이머 표시
- 진행률 표시

**API**:
- `POST /api/v1/tests/start` - 세션 시작
- `POST /api/v1/tests/{session_id}/answer` - 답안 제출
- `POST /api/v1/tests/{session_id}/complete` - 시험 완료

**백엔드 모듈**:
- `backend/app/services/test.py` - 세션/답안 처리
- `backend/app/models/test_session.py` - 세션 모델
- `backend/app/models/test_answer.py` - 답안 모델

**프론트엔드 상태**:
- `frontend/src/stores/testStore.ts` - 시험 상태 관리

#### 1.3 결과 확인
**위치**: `frontend/src/pages/student/ResultPage.tsx`

**기능**:
- 점수/정답률 표시
- 문항별 정오답 확인
- 소요 시간 통계

---

## 2️⃣ 스테이지 테스트 (Stage Test)

### 개요
- **목적**: 4단계 난이도로 단어 학습
- **특징**: 레벨별 자동 난이도 조절, 4가지 문제 유형
- **assignment_type**: `stage_test`

### 4단계 난이도 시스템

| Stage | 문제 유형 | 타이머 | 난이도 |
|-------|----------|--------|--------|
| 1 | word_to_meaning | 레벨별 조정 | 쉬움 |
| 2 | meaning_to_word | 레벨별 조정 | 보통 |
| 3 | listen_and_type | 15s | 어려움 |
| 4 | listen_to_meaning + sentence | 레벨별 조정 | 매우 어려움 |

### 레벨별 차등 시스템

**적용 대상**:
- Stage 1, 2, 4 (선택형 문제)

**차등 요소**:
1. **최소 스테이지** (Lv.3부터 강제 상승)
   - Lv.1-2: Stage 1부터 가능
   - Lv.3-4: 최소 Stage 2
   - Lv.5-6: 최소 Stage 3
   - Lv.7-9: 최소 Stage 4
   - Lv.10-15: Stage 4 or 5만 출제

2. **선택지 개수**
   - Lv.1-2: 3지선다
   - Lv.3-4: 4지선다
   - Lv.5-7: 5지선다
   - Lv.8-15: 6지선다

3. **타이머 제한**
   - Lv.1-2: 8초 (선택형)
   - Lv.3-4: 7초
   - Lv.5-6: 6초
   - Lv.7-9: 5초
   - Lv.10-15: 4초
   - Typing: 10-15초 (레벨별)

4. **타이핑 확률** (Stage 1-2에서 강제 업그레이드)
   - Lv.1-3: 0%
   - Lv.4-5: 15%
   - Lv.6-7: 30%
   - Lv.8-9: 45%
   - Lv.10-15: 60%

5. **문장 확률** (예문 문제)
   - Lv.1-4: 5%
   - Lv.5-7: 15%
   - Lv.8-10: 30%
   - Lv.11-15: 50%

### 기능

#### 2.1 스테이지 테스트 출제
**위치**: `frontend/src/pages/teacher/TestSettingsPage.tsx`

**기능**:
- Stage Test 선택 (assignment_type: `stage_test`)
- 문항 수 설정
- 레벨 범위 선택

**API**:
- `POST /api/v1/test-configs` (type: `stage_test`)

#### 2.2 스테이지 테스트 응시
**위치**: `frontend/src/pages/student/StageTestPage.tsx`

**기능**:
- 4단계 난이도 자동 조절
- 레벨별 차등 타이머
- 레벨별 차등 선택지 개수
- 고레벨 단어의 강제 타이핑/예문 문제

**API**:
- `POST /api/v1/stage-test/start-by-code` - 세션 시작
- `POST /api/v1/stage-test/{session_id}/answer` - 답안 제출

**백엔드 모듈**:
- `backend/app/services/stage_test.py` - Stage Test 전용 로직
- `backend/app/services/mastery_engine.py` - 난이도 조절 엔진

**프론트엔드 상태**:
- `frontend/src/stores/stageTestStore.ts` - Stage Test 전용 상태

#### 2.3 결과 확인
**위치**: `frontend/src/pages/teacher/StudentResultPage.tsx`

**기능**:
- Stage별 정답률
- 레벨별 성과
- 난이도별 분석

---

## 3️⃣ 마스터리 레벨업 (Mastery Level-up)

### 개요
- **목적**: XP 기반 적응형 레벨 판정 (배치테스트)
- **특징**: 실시간 레벨 변동, RPG식 성장, 콤보 시스템
- **assignment_type**: `mastery`

### XP 시스템

#### 레벨 구조
```
15개 Book (교재)
├── 각 Book = 25 Lesson
├── 서브레벨: "Book-Lesson" (예: "1-1", "7-16")
└── 랭크: Iron(1) → Bronze(2) → ... → Challenger(10)
```

#### XP 획득/차감
| 상황 | XP 변동 |
|------|---------|
| 현재 레벨 정답 | +8 + Book×2 |
| 낮은 레벨 정답 | +max(4, Book) |
| 속도 보너스 (≤1s) | +5 |
| 속도 보너스 (≤2s) | +4 |
| 속도 보너스 (≤3s) | +3 |
| 속도 보너스 (≤5s) | +2 |
| 속도 보너스 (≤8s) | +1 |
| 콤보 10+ | +5 |
| 콤보 7-9 | +3 |
| 콤보 5-6 | +2 |
| 콤보 3-4 | +1 |
| 오답 | -(4 + Book) |
| 연속 2회 오답 | ×1.5 |
| 연속 3회 오답 | ×2.0 |

#### 레벨 진화
- **레벨업**: XP ≥ Lesson XP (`2 + Book`) → 다음 Lesson
- **Book 진급**: Lesson 25 초과 → 다음 Book
- **레벨다운**: XP < 0 → 이전 Lesson (80% XP부터 시작)

### 기능

#### 3.1 마스터리 테스트 출제
**위치**: `frontend/src/pages/teacher/TestSettingsPage.tsx`

**기능**:
- 배치테스트/레벨테스트 선택
- 문항 수 (50~100)
- 전체 레벨 범위 (Lv.1-15)

**API**:
- `POST /api/v1/test-configs` (type: `placement`/`periodic`)

#### 3.2 마스터리 테스트 응시
**위치**: `frontend/src/pages/student/MasteryPage.tsx`

**기능**:
- 실시간 XP 바 표시
- Book-Lesson 레벨 표시
- 랭크 배지 (Iron~Challenger)
- 3색 XP 팝업 (기본/속도/콤보)
- 콤보 카운터
- 레이더 차트 (심장 박동 애니메이션)
- 자동 난이도 조절

**특별 기능**:
- **XP 계산**: 프론트엔드에서 실시간 (masteryStore)
- **멀티레벨 풀**: 현재~+4레벨, 각 10문항 프리로드
- **Lazy Loading**: 풀 소진 시 자동 fetch
- **레벨 변동**: 정답/오답에 따라 즉시 Book-Lesson 변경

**API**:
- `POST /api/v1/mastery/start-by-code` - 세션 시작 + 멀티레벨 풀
- `POST /api/v1/mastery/{id}/answer` - 답안 제출
- `POST /api/v1/mastery/batch` - 추가 문항 lazy fetch
- `POST /api/v1/mastery/complete-batch` - 최종 레벨 저장

**백엔드 모듈**:
- `backend/app/services/mastery.py` - 세션/답안 관리
- `backend/app/services/mastery_engine.py` - 문제 생성 엔진
- `backend/app/models/learning_session.py` - 세션 모델
- `backend/app/models/learning_answer.py` - 답안 모델
- `backend/app/models/word_mastery.py` - 단어별 마스터리

**프론트엔드 상태**:
- `frontend/src/stores/masteryStore.ts` - XP/레벨 계산 + 상태 관리
- `frontend/src/types/rank.ts` - 랭크 정의

#### 3.3 마스터리 리포트
**위치**:
- Teacher: `frontend/src/pages/teacher/MasteryReportPage.tsx`
- Student: `frontend/src/pages/student/StudentReportPage.tsx`

**기능**:
- 최종 레벨/랭크 배지 (그라데이션)
- 레이더 차트 (5개 지표)
- 메트릭 상세 (정확도, 속도, 콤보, 어휘력)
- 레벨별 정답률 테이블
- 시간 분석 (총 시간, 평균 속도)
- 회원 평균 비교

**리포트 지표**:
1. **정확도** (Accuracy): 정답률
2. **속도** (Speed): 평균 답변 시간 (초)
3. **콤보** (Combo): 최고 연속 정답
4. **어휘 사이즈** (Vocabulary Size): 누적 단어 수
5. **학습 성장도** (Growth): 레벨 상승폭

**API**:
- `GET /api/v1/mastery/report/{session_id}` - 리포트 데이터

**백엔드 모듈**:
- `backend/app/services/report_engine.py` - 리포트 계산 엔진

---

## 📊 공통 기능

### 학생 관리
**위치**: `frontend/src/pages/teacher/StudentsPage.tsx`

**기능**:
- 학생 목록 조회
- 학생 추가/수정/삭제
- 학원/학년 정보 관리

**API**:
- `GET /api/v1/students` - 학생 목록
- `POST /api/v1/students` - 학생 추가
- `PUT /api/v1/students/{id}` - 학생 수정
- `DELETE /api/v1/students/{id}` - 학생 삭제

### 테스트 배정
**위치**: `frontend/src/pages/teacher/TestSettingsPage.tsx`

**기능**:
- 테스트를 학생에게 배정
- 배정 상태 확인 (assigned/in_progress/completed)
- 테스트 코드 생성

**API**:
- `GET /api/v1/test-assignments` - 배정 목록
- `GET /api/v1/test-assignments/{code}` - 코드로 조회
- `DELETE /api/v1/test-assignments/{id}` - 배정 취소

### 통계 및 리포트
**위치**:
- `frontend/src/pages/teacher/StudentResultPage.tsx`
- `frontend/src/pages/student/StudentReportPage.tsx`

**기능**:
- 테스트별 결과 조회
- 학생별 성과 분석
- 레벨별/메트릭별 분석
- 회원 평균 비교

**API**:
- `GET /api/v1/stats/test-report/{session_id}` - 일반 테스트 리포트
- `GET /api/v1/mastery/report/{session_id}` - 마스터리 리포트

**백엔드 모듈**:
- `backend/app/services/report_engine.py` - 통계 계산

### TTS (Text-to-Speech)
**위치**: `frontend/src/utils/tts.ts`

**기능**:
- 단어 발음 재생 (3단계 폴백)
  1. Dictionary API (원어민 녹음)
  2. Gemini TTS (AI 음성)
  3. Web Speech API (브라우저 TTS)
- 문장 발음 재생
- 음원 프리로딩 & 캐싱
- 재생 완료 대기 (Promise)

**특별 기능**:
- 시험마다 랜덤 음성 배정
- 5가지 AI 음성 (Aoede, Puck, Charon, Fenrir, Leda)
- 발음 완료까지 자동 대기 (정답 후)

**API**:
- `GET /api/v1/tts?text={text}&voice={voice}` - Gemini TTS

**백엔드 모듈**:
- `backend/app/api/v1/tts.py` - TTS 프록시

### 사운드 효과
**위치**: `frontend/src/hooks/useSound.ts`

**사운드 종류**:
- `correct` - 정답 효과음
- `wrong` - 오답 효과음
- `timer` - 타이머 경고음 (2초 남았을 때)
- `two` - 2초 카운트다운

---

## 🗄️ 데이터베이스 모델

### 테스트 설정
- `test_config` - 테스트 기본 설정
  - `name`, `test_type`, `question_count`, `time_limit_seconds`
  - `level_range_min/max`, `book_name`, `lesson_range`
  - `per_question_time_seconds` (개별 문제 타이머 오버라이드)

### 테스트 배정
- `test_assignment` - 학생에게 배정된 테스트
  - `test_code` (6자리 고유 코드)
  - `assignment_type` (test/stage_test/mastery)
  - `status` (assigned/in_progress/completed)

### 일반 테스트 세션
- `test_session` - 시험 세션
- `test_answer` - 답안 기록

### 마스터리/스테이지 세션
- `learning_session` - 학습 세션
  - `current_level` - 적응형 레벨 (마스터리용)
  - `current_stage` - 현재 스테이지
  - `best_combo` - 최고 콤보
- `learning_answer` - 학습 답안 기록
- `word_mastery` - 단어별 숙달도
  - `stage` (1-5)
  - `stage_streak` (연속 정답)
  - `mastered_at` (완전 숙달 시점)
  - `review_due_at` (SRS 복습 일정)

---

## 🎨 UI 컴포넌트

### 테스트 공통
- `TestConfigPanel` - 테스트 설정 패널
- `AssignmentStatusTable` - 배정 상태 테이블

### 마스터리 전용
- `MasteryHeader` - XP 바, Book-Lesson, 랭크 배지
- `ComboCounter` - 콤보 카운터
- `GrowthProgressBar` - 성장 진행 바

### 리포트
- `ReportHeader` - 리포트 헤더 (학생 정보)
- `OverallResult` - 종합 결과 (레벨, 랭크 배지)
- `RadarChart` - 레이더 차트 (5개 지표, 심장 박동 애니메이션)
- `MetricDetailSection` - 메트릭 상세 (4가지)
- `LevelChartTable` - 레벨별 정답률 테이블
- `TimeBreakdown` - 시간 분석

### 문제 유형별 컴포넌트
- `ListenCard` - 듣기 문제 (Stage 3-4)
- `SentenceBlankCard` - 빈칸 채우기 (예문)
- `SentenceReview` - 예문 학습 카드
- `TypingInput` - 타이핑 입력

---

## 🧪 테스트 스크립트 (Backend)

### 시드 스크립트
- `backend/scripts/seed_demo.py` - 데모 데이터 생성
- `backend/scripts/seed_test0213_teacher.py` - TEST0213 선생님 계정
- `backend/scripts/seed_report_test0213.py` - 더미 리포트 생성

### 시뮬레이션
- `backend/scripts/simulate_test0213_completion.py` - 100문제 DB 시뮬레이션
- `backend/scripts/simulate_frontend_test0213.py` - 프론트엔드 XP 로직 시뮬레이션

### 분석
- `backend/scripts/analyze_test0213.py` - TEST0213 분석
- `backend/scripts/analyze_question_progression.py` - 난이도 진행 분석

### 유틸리티
- `backend/scripts/reset_test0213.py` - TEST0213 세션 리셋
- `backend/scripts/reset_tests.py` - 모든 테스트 리셋
- `backend/scripts/normalize_words.py` - 단어 데이터 정규화
- `backend/scripts/reset_mastery_session.py` - 마스터리 세션 리셋

---

## 📝 요약

### 테스트 유형별 비교

| 항목 | 일반 테스트 | 스테이지 테스트 | 마스터리 레벨업 |
|------|-----------|----------------|----------------|
| **목적** | 성적 평가 | 단어 학습 | 레벨 판정 |
| **문항 수** | 고정 | 고정 | 50~100 |
| **난이도** | 고정 범위 | 4단계 자동 | XP 기반 적응 |
| **레벨 변동** | 없음 | 없음 | 실시간 변동 |
| **문제 유형** | 고정 | Stage별 자동 | Stage별 자동 |
| **채점** | 일괄 채점 | 즉시 피드백 | 즉시 피드백 |
| **리포트** | 기본 통계 | Stage별 분석 | 5지표 + 레벨 |
| **사용 시나리오** | 정기 시험 | 단어 암기 | 배치테스트 |

### 핵심 차별점

**일반 테스트**:
- ✅ 전통적 시험 방식
- ✅ 선생님이 난이도 선택
- ✅ 간단한 리포트

**스테이지 테스트**:
- ✅ 레벨별 4단계 난이도 차등
- ✅ 고레벨은 자동으로 어려운 문제
- ✅ Stage별 학습 진도

**마스터리 레벨업**:
- ✅ XP 기반 실시간 레벨 변동
- ✅ RPG식 성장 (콤보, 속도 보너스)
- ✅ 5지표 종합 분석
- ✅ 랭크 시스템 (Iron~Challenger)

---

**작성자**: Claude (Anthropic)
**기준 버전**: 최신 커밋 (d72ccca)
**총 페이지**: Backend 16개 API 엔드포인트, Frontend 18개 주요 페이지
