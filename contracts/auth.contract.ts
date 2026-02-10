import type { User } from './types';

// POST /api/v1/auth/register
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}
export type RegisterResponse = User;

// POST /api/v1/auth/login/json
export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
}

// POST /api/v1/auth/refresh
export interface RefreshRequest {
  refresh_token: string;
}
export type RefreshResponse = LoginResponse;

// GET /api/v1/users/me
export type GetMeResponse = User;

// POST /api/v1/auth/password/change
export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}
