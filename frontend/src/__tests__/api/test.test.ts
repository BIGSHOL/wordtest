/**
 * Level test API service tests (RED).
 * These tests will fail until the test service is implemented.
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('Test API Service', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('access_token', 'mock-access-token');
  });

  describe('startTest', () => {
    it('should start a placement test and return questions', async () => {
      // RED: testService not yet implemented
      const { testService } = await import('../../services/test');
      const result = await testService.startTest({ test_type: 'placement' });
      expect(result.test_session).toBeDefined();
      expect(result.test_session.test_type).toBe('placement');
      expect(result.questions).toBeDefined();
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.questions[0].choices.length).toBe(4);
    });
  });

  describe('submitAnswer', () => {
    it('should submit an answer and get correctness', async () => {
      const { testService } = await import('../../services/test');
      const result = await testService.submitAnswer('test-001', {
        word_id: 'word-001',
        selected_answer: '사과',
        question_order: 1,
      });
      expect(result.is_correct).toBeDefined();
      expect(result.correct_answer).toBeDefined();
      expect(typeof result.is_correct).toBe('boolean');
    });
  });

  describe('getTestResult', () => {
    it('should return test result with answers', async () => {
      const { testService } = await import('../../services/test');
      const result = await testService.getTestResult('test-001');
      expect(result.test_session).toBeDefined();
      expect(result.test_session.completed_at).not.toBeNull();
      expect(result.test_session.determined_level).not.toBeNull();
      expect(result.answers).toBeDefined();
      expect(Array.isArray(result.answers)).toBe(true);
    });
  });

  describe('listTests', () => {
    it('should list test history', async () => {
      const { testService } = await import('../../services/test');
      const result = await testService.listTests('4473f20e-b8d1-4196-9f5d-731cb7cd722a');
      expect(result.tests).toBeDefined();
      expect(Array.isArray(result.tests)).toBe(true);
    });
  });
});
