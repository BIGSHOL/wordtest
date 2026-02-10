/**
 * Student API service tests (RED).
 * These tests will fail until the student service is implemented.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// This import will fail until the service is created
// import { studentService } from '../../services/student';

describe('Student API Service', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'mock-access-token');
  });

  describe('listStudents', () => {
    it('should return list of students', async () => {
      // RED: studentService not yet implemented
      const { studentService } = await import('../../services/student');
      const students = await studentService.listStudents();
      expect(Array.isArray(students)).toBe(true);
      expect(students.length).toBeGreaterThan(0);
      expect(students[0].role).toBe('student');
    });
  });

  describe('createStudent', () => {
    it('should create a new student', async () => {
      const { studentService } = await import('../../services/student');
      const student = await studentService.createStudent({
        username: 'newstudent',
        password: 'studentpass',
        name: 'New Student',
      });
      expect(student.username).toBe('newstudent');
      expect(student.name).toBe('New Student');
      expect(student.role).toBe('student');
    });
  });

  describe('updateStudent', () => {
    it('should update student name', async () => {
      const { studentService } = await import('../../services/student');
      const updated = await studentService.updateStudent('4473f20e-b8d1-4196-9f5d-731cb7cd722a', {
        name: 'Updated Name',
      });
      expect(updated.name).toBe('Updated Name');
    });
  });

  describe('deleteStudent', () => {
    it('should delete a student', async () => {
      const { studentService } = await import('../../services/student');
      await expect(
        studentService.deleteStudent('4473f20e-b8d1-4196-9f5d-731cb7cd722a'),
      ).resolves.not.toThrow();
    });
  });
});
