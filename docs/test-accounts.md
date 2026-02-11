# 테스트 계정 및 코드 정보

## 계정

### 선생님
| 아이디 | 비밀번호 | 이름 |
|--------|----------|------|
| demo_teacher | test1234 | 김선생 |

### 학생
| 아이디 | 비밀번호 | 이름 |
|--------|----------|------|
| student01 | test1234 | 김민수 |
| student02 | test1234 | 이지은 |
| student03 | test1234 | 박서준 |
| student04 | test1234 | 최예린 |
| student05 | test1234 | 정하늘 |

## 테스트 코드 (학생별 개별)

코드는 8자리이며, 로그인 없이 `/test/start`에서 바로 입력 가능합니다.

### 기초 배치고사 (Lv1-5) — placement, 10문제, 300초
| 학생 | 코드 |
|------|------|
| 김민수 (student01) | TEST2AA1 |
| 이지은 (student02) | TEST2AA2 |
| 박서준 (student03) | TEST2AA3 |

### 중급 배치고사 (Lv1-10) — placement, 20문제, 600초
| 학생 | 코드 |
|------|------|
| 김민수 (student01) | TEST2BB1 |
| 이지은 (student02) | TEST2BB2 |
| 박서준 (student03) | TEST2BB3 |

### 주간 테스트 (Lv1-3) — periodic, 10문제, 180초
| 학생 | 코드 |
|------|------|
| 김민수 (student01) | TEST2CC1 |
| 이지은 (student02) | TEST2CC2 |
| 박서준 (student03) | TEST2CC3 |

## 사용 방법

### 코드 전용 (로그인 불요)
1. `/test/start` 접속
2. 8자리 코드 입력 (예: `TEST2AA1`)
3. 바로 시험 시작

### 로그인 후 시험
1. `/login` → student01 / test1234
2. `/test/start` → 코드 입력 → 시험 시작

### 선생님 출제
1. `/login` → demo_teacher / test1234
2. `/test-settings` → 학생 선택 → 출제
3. 학생별 개별 코드 자동 생성
