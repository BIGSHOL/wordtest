## Skills

커스텀 검증 및 유지보수 스킬은 `.claude/skills/`에 정의되어 있습니다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서를 생성합니다 |
| `manage-skills` | 세션 변경사항을 분석하고, 검증 스킬을 생성/업데이트하며, CLAUDE.md를 관리합니다 |
| `verify-question-pipeline` | 문제 생성 파이프라인 외래어 필터링/중복 제거 일관성 검증 |
| `verify-api-consistency` | 백엔드 Router-Service-Schema-Model 계층 간 참조 일관성 검증 |
| `verify-frontend-routes` | 프론트엔드 Route-Page-Nav-Store-Service 간 참조 일관성 검증 |

## 더미 데이터 관리

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
