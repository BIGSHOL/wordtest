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
];

/**
 * Map a level (1-15) to a rank (1-10).
 * Levels 1-6 map 1:1, levels 7-8 → rank 7, 9-10 → rank 8, 11-13 → rank 9, 14-15 → rank 10.
 */
export function getLevelRank(level: number): RankInfo {
  let rankIndex: number;
  if (level <= 6) rankIndex = level - 1;
  else if (level <= 8) rankIndex = 6;
  else if (level <= 10) rankIndex = 7;
  else if (level <= 13) rankIndex = 8;
  else rankIndex = 9;
  return RANKS[Math.max(0, Math.min(rankIndex, RANKS.length - 1))];
}
