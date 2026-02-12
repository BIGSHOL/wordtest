export interface RankInfo {
  rank: number;
  name: string;
  nameKo: string;
  icon: string;
  colors: [string, string]; // gradient from/to
  iconColor: string;
  bgColor: string;
}

export const RANKS: RankInfo[] = [
  { rank: 1, name: 'Iron', nameKo: '아이언', icon: 'shield', colors: ['#71717A', '#3F3F46'], iconColor: '#A1A1AA', bgColor: '#1A1A1F' },
  { rank: 2, name: 'Bronze', nameKo: '브론즈', icon: 'sword', colors: ['#CD7F32', '#8B5E3C'], iconColor: '#FDDCB5', bgColor: '#1F1A15' },
  { rank: 3, name: 'Silver', nameKo: '실버', icon: 'award', colors: ['#C0C0C0', '#909090'], iconColor: '#E8E8E8', bgColor: '#1A1C20' },
  { rank: 4, name: 'Gold', nameKo: '골드', icon: 'crown', colors: ['#FFD700', '#B8860B'], iconColor: '#FFF8DC', bgColor: '#1F1B0F' },
  { rank: 5, name: 'Platinum', nameKo: '플래티넘', icon: 'gem', colors: ['#5EEAD4', '#0D9488'], iconColor: '#CCFBF1', bgColor: '#0F1A1A' },
  { rank: 6, name: 'Emerald', nameKo: '에메랄드', icon: 'gem', colors: ['#34D399', '#059669'], iconColor: '#D1FAE5', bgColor: '#0F1F15' },
  { rank: 7, name: 'Diamond', nameKo: '다이아몬드', icon: 'diamond', colors: ['#93C5FD', '#3B82F6'], iconColor: '#EFF6FF', bgColor: '#0D1525' },
  { rank: 8, name: 'Master', nameKo: '마스터', icon: 'star', colors: ['#C084FC', '#7C3AED'], iconColor: '#F3E8FF', bgColor: '#150D20' },
  { rank: 9, name: 'Grandmaster', nameKo: '그랜드마스터', icon: 'flame', colors: ['#FCA5A5', '#DC2626'], iconColor: '#FEF2F2', bgColor: '#1F0D0D' },
  { rank: 10, name: 'Challenger', nameKo: '챌린저', icon: 'trophy', colors: ['#FFD700', '#DC2626'], iconColor: '#FEF3C7', bgColor: '#1A0A00' },
  { rank: 11, name: 'LEGEND', nameKo: '레전드', icon: 'trophy', colors: ['#FFD700', '#B8860B'], iconColor: '#FFF8DC', bgColor: '#1A1500' },
  { rank: 12, name: 'LEGEND', nameKo: '레전드', icon: 'trophy', colors: ['#FFD700', '#B8860B'], iconColor: '#FFF8DC', bgColor: '#1A1500' },
  { rank: 13, name: 'LEGEND', nameKo: '레전드', icon: 'trophy', colors: ['#FFD700', '#B8860B'], iconColor: '#FFF8DC', bgColor: '#1A1500' },
  { rank: 14, name: 'LEGEND', nameKo: '레전드', icon: 'trophy', colors: ['#FFD700', '#B8860B'], iconColor: '#FFF8DC', bgColor: '#1A1500' },
  { rank: 15, name: 'LEGEND', nameKo: '레전드', icon: 'trophy', colors: ['#FFD700', '#B8860B'], iconColor: '#FFF8DC', bgColor: '#1A1500' },
];

/**
 * Map a rank (1-10) to its RankInfo.
 * The determined_level from the API is already a rank value (1-10),
 * converted by the backend via word_level_to_rank().
 */
export function getLevelRank(rank: number): RankInfo {
  const index = Math.max(0, Math.min(rank - 1, RANKS.length - 1));
  return RANKS[index];
}

/** Map word DB level (1-15) to rank (1-15). Mirrors backend word_level_to_rank(). */
export function wordLevelToRank(wordLevel: number): number {
  return Math.min(wordLevel, 15);
}

export interface AnswerDetail {
  wordLevel: number;
  lesson: string;
  isCorrect: boolean;
}

/**
 * Real-time level determination — mirrors backend determine_level().
 * Groups answers by rank, rank "passed" if ≥50% correct,
 * determined_rank = highest passed rank before 2 consecutive fails.
 * Sublevel = highest correct lesson index within the determined rank.
 */
export function determineLevel(
  answers: AnswerDetail[],
): { rank: number; sublevel: number } {
  if (answers.length === 0) return { rank: 1, sublevel: 1 };

  // Group by rank — track both accuracy and per-lesson results
  const rankResults = new Map<number, { correct: number; total: number; lessons: Map<string, boolean> }>();
  for (const { wordLevel, lesson, isCorrect } of answers) {
    const rank = wordLevelToRank(wordLevel);
    const entry = rankResults.get(rank) ?? { correct: 0, total: 0, lessons: new Map() };
    entry.total++;
    if (isCorrect) {
      entry.correct++;
      entry.lessons.set(lesson, true);
    } else if (!entry.lessons.has(lesson)) {
      entry.lessons.set(lesson, false);
    }
    rankResults.set(rank, entry);
  }

  // Walk ranks ascending, find highest passed before 2 consecutive fails
  const sortedRanks = [...rankResults.keys()].sort((a, b) => a - b);
  let determinedRank = 1;
  let consecutiveFails = 0;

  for (const rank of sortedRanks) {
    const { correct, total } = rankResults.get(rank)!;
    const passed = correct > 0 && correct >= total / 2;

    if (passed) {
      determinedRank = rank;
      consecutiveFails = 0;
    } else {
      consecutiveFails++;
      if (consecutiveFails >= 2) break;
    }
  }

  // Determine sublevel within the determined rank (mirrors backend)
  let sublevel = 1;
  const rankEntry = rankResults.get(determinedRank);
  if (rankEntry) {
    const allLessons = [...rankEntry.lessons.keys()].sort();
    const correctLessons = allLessons.filter((l) => rankEntry.lessons.get(l));

    if (correctLessons.length > 0) {
      const highestCorrect = correctLessons[correctLessons.length - 1];
      sublevel = allLessons.indexOf(highestCorrect) + 1;

      // All correct in this rank with ≥2 answers → mastered
      if (rankEntry.correct === rankEntry.total && rankEntry.total >= 2) {
        sublevel = 25; // MAX marker, same as backend
      }
    }
  }

  return { rank: determinedRank, sublevel };
}
