/**
 * Authentication type definitions.
 * Synced with contracts/types.ts and contracts/auth.contract.ts
 */

export interface User {
  id: string;
  email: string | null;
  username: string | null;
  name: string;
  role: 'teacher' | 'student';
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
