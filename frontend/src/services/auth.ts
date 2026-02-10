/**
 * Authentication API service.
 */
import api from './api';
import type { AuthResponse, LoginRequest, RegisterRequest, User, PasswordChangeRequest } from '../types/auth';

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const authService = {
  /**
   * Register a new user.
   */
  async register(data: RegisterRequest): Promise<User> {
    const response = await api.post<User>('/api/v1/auth/register', data);
    return response.data;
  },

  /**
   * Login and get access + refresh tokens.
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/v1/auth/login/json', data);
    if (response.data.access_token) {
      this.setToken(response.data.access_token);
    }
    if (response.data.refresh_token) {
      this.setRefreshToken(response.data.refresh_token);
    }
    return response.data;  // now includes user field
  },

  /**
   * Logout current user and revoke refresh token.
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      await api.post('/api/v1/auth/logout', refreshToken ? { refresh_token: refreshToken } : undefined);
    } finally {
      this.removeToken();
      this.removeRefreshToken();
    }
  },

  /**
   * Refresh access token using refresh token.
   */
  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await api.post<AuthResponse>('/api/v1/auth/refresh', {
        refresh_token: refreshToken,
      });
      this.setToken(response.data.access_token);
      this.setRefreshToken(response.data.refresh_token);
      return response.data.access_token;
    } catch {
      this.removeToken();
      this.removeRefreshToken();
      return null;
    }
  },

  /**
   * Get current user profile.
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/api/v1/users/me');
    return response.data;
  },

  /**
   * Update current user profile.
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.patch<User>('/api/v1/users/me', data);
    return response.data;
  },

  /**
   * Change password.
   */
  async changePassword(data: PasswordChangeRequest): Promise<void> {
    await api.post('/api/v1/auth/password/change', data);
  },

  /**
   * Delete current user account.
   */
  async deleteAccount(): Promise<void> {
    await api.delete('/api/v1/users/me');
    this.removeToken();
    this.removeRefreshToken();
  },

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },

  removeRefreshToken(): void {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

export default authService;
