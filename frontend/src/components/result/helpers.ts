import type { TestSessionData } from '../../types/test';

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}분 ${s}초`;
}

export function computeDuration(session: TestSessionData): number | null {
  if (!session.completed_at || !session.started_at) return null;
  const diff =
    new Date(session.completed_at).getTime() -
    new Date(session.started_at).getTime();
  return Math.round(diff / 1000);
}
