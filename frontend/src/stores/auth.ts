/**
 * Authentication store using Zustand.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginRequest, RegisterRequest } from '../types/auth';
import authService from '../services/auth';
import { getErrorMessage } from '../utils/error';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
  setTokenDirect: (token: string, user: User) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: authService.getToken(),
      isLoading: false,
      error: null,

      login: async (data: LoginRequest) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(data);
          // Login response includes user — no extra fetchUser() call needed
          set({ token: response.access_token, user: response.user ?? null });
          if (!response.user) {
            await get().fetchUser();
          }
        } catch (error: unknown) {
          set({ error: getErrorMessage(error, 'Login failed') });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true, error: null });
        try {
          await authService.register(data);
          // Auto-login after registration
          await get().login({ username: data.username, password: data.password });
        } catch (error: unknown) {
          set({ error: getErrorMessage(error, 'Registration failed') });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
        } finally {
          set({ user: null, token: null, isLoading: false });
          authService.removeRefreshToken();
        }
      },

      fetchUser: async () => {
        const token = get().token || authService.getToken();
        if (!token) {
          set({ user: null });
          return;
        }

        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          set({ user });
        } catch (error) {
          set({ user: null, token: null });
          authService.removeToken();
        } finally {
          set({ isLoading: false });
        }
      },

      clearError: () => set({ error: null }),

      setTokenDirect: (token: string, user: User) => {
        authService.setToken(token);
        set({ token, user, error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

export default useAuthStore;
