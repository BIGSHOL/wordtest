# Difficulty-Based Level Remapping Plan

> Status: **PLANNED** (not implemented)
> Current system: Book N = Level N (1:1 mapping, unchanged)
> Created: 2026-02-13

## Background

`data/difficulty_analysis.html` 기반 분석 결과, 교재 번호 순서와 실제 난이도 순서에 괴리가 있음.

## Current System

```
Book 1 (5000-01) = Level 1 (Iron)
Book 2 (5000-02) = Level 2 (Bronze)
...
Book 15 (수능 기출 5000-05) = Level 15 (LEGEND)
```

## Difficulty Analysis Data

| Book | Name | Avg Difficulty | Basic Ratio | Morph Complex | Word Count |
|---|---|---|---|---|---|
| 1 | Power Voca 5000-01 | 26.6 | 57.1% | 8.6% | 499 |
| 2 | Power Voca 5000-02 | 31.5 | 47.2% | 12.6% | 500 |
| 3 | Power Voca 5000-03 | 37.4 | 42.8% | 23.0% | 500 |
| 4 | Power Voca 5000-04 | 44.6 | 28.0% | 30.2% | 500 |
| 5 | Power Voca 5000-05 | 47.1 | 23.0% | 28.0% | 500 |
| 6 | Power Voca 5000-06 | 47.8 | 23.0% | 27.4% | 500 |
| 7 | Power Voca 5000-07 | 44.6 | 27.2% | 23.4% | 500 |
| 8 | Power Voca 5000-08 | 53.7 | 11.4% | 36.4% | 500 |
| 9 | Power Voca 5000-09 | 49.7 | 16.4% | 31.8% | 500 |
| 10 | Power Voca 5000-10 | 53.2 | 10.2% | 34.2% | 500 |
| 11 | 수능 기출 5000-01 | 46.7 | 29.8% | 43.2% | 1,293 |
| 12 | 수능 기출 5000-02 | 51.9 | 9.9% | 40.0% | 1,210 |
| 13 | 수능 기출 5000-03 | 55.2 | 1.6% | 40.2% | 1,217 |
| 14 | 수능 기출 5000-04 | 53.8 | 0.2% | 31.6% | 1,218 |
| 15 | 수능 기출 5000-05 | 54.6 | 0.5% | 31.7% | 1,195 |

## Discrepancy Analysis

Sorted by actual difficulty (ascending):

| Difficulty Rank | Book | Avg Difficulty | Current Level | Gap |
|---|---|---|---|---|
| 1 | 5000-01 | 26.6 | Lv1 | 0 |
| 2 | 5000-02 | 31.5 | Lv2 | 0 |
| 3 | 5000-03 | 37.4 | Lv3 | 0 |
| **4** | **5000-07** | **44.6** | **Lv7** | **+3** |
| **5** | **5000-04** | **44.6** | **Lv4** | **-1** |
| 6 | 수능기출-01 | 46.7 | Lv11 | **+5** |
| 7 | 5000-05 | 47.1 | Lv5 | -2 |
| 8 | 5000-06 | 47.8 | Lv6 | -2 |
| 9 | 5000-09 | 49.7 | Lv9 | 0 |
| 10 | 수능기출-02 | 51.9 | Lv12 | +2 |
| 11 | 5000-10 | 53.2 | Lv10 | -1 |
| **12** | **5000-08** | **53.7** | **Lv8** | **-4** |
| 13 | 수능기출-04 | 53.8 | Lv14 | +1 |
| 14 | 수능기출-05 | 54.6 | Lv15 | +1 |
| 15 | 수능기출-03 | 55.2 | Lv13 | -2 |

### Key Issues

1. **5000-07 (Lv7)**: Actual difficulty = Lv4 level. Overrated by +3 levels.
2. **5000-08 (Lv8)**: Actual difficulty = Lv12 level. Underrated by -4 levels. Hardest basic book.
3. **수능기출-01 (Lv11)**: Actual difficulty = Lv5~6 level. Despite "수능" label, easier than Books 5-8.
4. **수능기출-03 (Lv13)**: Actually the hardest book overall (55.2), not 수능기출-05.

## Proposed Remapping (If Implemented)

### Option A: Full Difficulty-Based Reorder

Remap `words.level` in the database to match actual difficulty order:

```
New Level 1  = 5000-01     (26.6)
New Level 2  = 5000-02     (31.5)
New Level 3  = 5000-03     (37.4)
New Level 4  = 5000-07     (44.6)  ← was Lv7
New Level 5  = 5000-04     (44.6)  ← was Lv4
New Level 6  = 수능기출-01  (46.7)  ← was Lv11
New Level 7  = 5000-05     (47.1)  ← was Lv5
New Level 8  = 5000-06     (47.8)  ← was Lv6
New Level 9  = 5000-09     (49.7)
New Level 10 = 수능기출-02  (51.9)  ← was Lv12
New Level 11 = 5000-10     (53.2)
New Level 12 = 5000-08     (53.7)  ← was Lv8
New Level 13 = 수능기출-04  (53.8)
New Level 14 = 수능기출-05  (54.6)
New Level 15 = 수능기출-03  (55.2)  ← was Lv13
```

### Option B: Partial Fix (Only Major Outliers)

Only fix the biggest discrepancies while keeping series order intact:

- Swap Book 7 ↔ Book 4 (both 44.6 but wrong order)
- Move Book 8 up (it's harder than 9, 10)
- Reorder 수능기출 series: 01 → 02 → 04 → 05 → 03

### Option C: Weighted Difficulty (No DB Change)

Keep `words.level` as-is but add a `difficulty_weight` column to books table:

```sql
ALTER TABLE books ADD COLUMN difficulty_weight FLOAT DEFAULT 1.0;
```

Use weight for XP calculations: harder books give more XP per question, easier books give less. This compensates for difficulty without changing the book→level mapping.

## Implementation Steps (If Approved)

### Phase 1: DB Migration

1. Create migration script to update `words.level` based on new mapping
2. Update `test_sessions.determined_level` for existing sessions
3. Update `learning_sessions.current_level` for existing sessions
4. Update `word_mastery` records

### Phase 2: Backend

1. Update `level_engine.py` RANK_NAMES to match new book order
2. Update `report_engine.py` RANK_TO_BOOK, RANK_TO_GRADE, _RANK_VOCAB_LABEL
3. Update all seed scripts

### Phase 3: Frontend

1. Update `LevelChartTable.tsx` BOOKS array order
2. Update `rank.ts` if rank names change
3. Update all LEVEL_NAMES mappings

### Phase 4: Verification

1. Run all tests
2. Verify XP system progression with new ordering
3. Check existing reports render correctly
4. Validate dummy report seed scripts

## Risk Assessment

- **High**: Existing data migration complexity (all level references need updating)
- **Medium**: User confusion if levels change mid-use
- **Low**: Code changes are straightforward mapping updates

## Decision

**Current decision: DO NOT IMPLEMENT.** Keep Book N = Level N.

Reasons:
- Curriculum order from publisher has pedagogical intent beyond raw difficulty
- Difficulty analysis is algorithmic (word length, syllables, morphology) — doesn't capture pedagogical ordering
- Remapping would break existing user data and reports
- The XP system naturally handles this: easier books → faster progression, harder books → slower

This document serves as reference if the decision changes in the future.
