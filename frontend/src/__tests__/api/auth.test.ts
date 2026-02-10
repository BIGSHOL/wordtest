/**
 * Auth API service tests.
 * Tests auth service calls against MSW mock handlers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../../services/auth';

describe('Auth API Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('login', () => {
    it('should return access token on successful login', async () => {
      const result = await authService.login({
        username: 'teacher01',
        password: 'password123',
      });
      expect(result.access_token).toBe('mock-access-token');
      expect(result.token_type).toBe('bearer');
    });

    it('should store token in localStorage', async () => {
      await authService.login({
        username: 'teacher01',
        password: 'password123',
      });
      expect(localStorage.getItem('access_token')).toBe('mock-access-token');
    });

    it('should throw on invalid credentials', async () => {
      await expect(
        authService.login({
          username: 'teacher01',
          password: 'wrong',
        }),
      ).rejects.toThrow();
    });
  });

  describe('register', () => {
    it('should return new user on successful registration', async () => {
      const result = await authService.register({
        username: 'newteacher01',
        password: 'password123',
        name: 'New Teacher',
      });
      expect(result.username).toBe('newteacher01');
      expect(result.name).toBe('New Teacher');
      expect(result.role).toBe('teacher');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user when authenticated', async () => {
      authService.setToken('mock-access-token');
      const user = await authService.getCurrentUser();
      expect(user.username).toBe('teacher01');
      expect(user.role).toBe('teacher');
    });
  });

  describe('logout', () => {
    it('should remove token from localStorage', async () => {
      authService.setToken('mock-access-token');
      await authService.logout();
      expect(localStorage.getItem('access_token')).toBeNull();
    });
  });

  describe('changePassword', () => {
    it('should succeed with correct current password', async () => {
      authService.setToken('mock-access-token');
      await expect(
        authService.changePassword({
          current_password: 'password123',
          new_password: 'newpass456',
        }),
      ).resolves.not.toThrow();
    });
  });
});
