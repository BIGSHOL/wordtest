/**
 * Level Test API service.
 */
import api from './api';
import type { TestAssignmentItem } from './testAssignment';

export interface LevelTestStudentResult {
  student_name: string;
  student_id: string;
  test_code: string;
  assignment_id: string;
  grade: string;
  level_range: string;
}

export interface LevelTestCreateResponse {
  question_count: number;
  students: LevelTestStudentResult[];
}

export async function createLevelTest(
  studentIds: string[],
): Promise<LevelTestCreateResponse> {
  const res = await api.post<LevelTestCreateResponse>('/api/v1/level-test', {
    student_ids: studentIds,
  });
  return res.data;
}

export async function listLevelTestAssignments(): Promise<TestAssignmentItem[]> {
  const res = await api.get<TestAssignmentItem[]>('/api/v1/level-test/assignments');
  return res.data;
}

export async function deleteLevelTestAssignment(id: string): Promise<void> {
  await api.delete(`/api/v1/level-test/assignments/${id}`);
}
