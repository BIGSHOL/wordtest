/**
 * LoginPage component tests.
 * Tests the login form with test code functionality.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../../pages/auth/LoginPage';
import { useAuthStore } from '../../stores/auth';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Reset store and mocks before each test
beforeEach(() => {
  mockNavigate.mockReset();
  localStorage.clear();
  useAuthStore.setState({ user: null, token: null, isLoading: false, error: null });
});

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  describe('Test Code Input', () => {
    it('renders test code input field', () => {
      renderLoginPage();
      expect(screen.getByLabelText(/테스트 코드/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/코드 입력 시 바로 테스트 시작/i)).toBeInTheDocument();
    });

    it('auto-converts input to uppercase and limits to 6 chars', async () => {
      const user = userEvent.setup();
      renderLoginPage();
      const input = screen.getByLabelText(/테스트 코드/i) as HTMLInputElement;

      await user.type(input, 'abc123xy');

      expect(input).toHaveValue('ABC123');  // 6 chars max, uppercase
    });

    it('filters out non-alphanumeric characters', async () => {
      const user = userEvent.setup();
      renderLoginPage();
      const input = screen.getByLabelText(/테스트 코드/i) as HTMLInputElement;

      await user.type(input, 'a1@b2#c3');

      expect(input).toHaveValue('A1B2C3');  // Only alphanumeric, uppercase
    });

    it('changes button text when 6-char code is entered', async () => {
      const user = userEvent.setup();
      renderLoginPage();
      const codeInput = screen.getByLabelText(/테스트 코드/i);

      // Before code entry - default button text
      expect(screen.getByRole('button', { name: /^로그인$/i })).toBeInTheDocument();

      // Enter 6-char code
      await user.type(codeInput, 'A3X7K2');

      // Button text should change
      expect(screen.getByRole('button', { name: /로그인 & 테스트 시작/i })).toBeInTheDocument();
    });

    it('navigates to test start with code after successful login', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      // Fill in credentials
      const usernameInput = screen.getByLabelText(/^아이디$/i);
      const passwordInput = screen.getByLabelText(/^비밀번호$/i);
      const codeInput = screen.getByLabelText(/테스트 코드/i);

      await user.type(usernameInput, 'teacher01');
      await user.type(passwordInput, 'password123');
      await user.type(codeInput, 'A3X7K2');

      const submitButton = screen.getByRole('button', { name: /로그인 & 테스트 시작/i });
      await user.click(submitButton);

      // Should navigate with code param after successful login
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/test/start?code=A3X7K2',
          expect.objectContaining({ replace: true })
        );
      }, { timeout: 5000 });
    });

    it('navigates to dashboard without code after successful login', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      // Fill in credentials without test code
      const usernameInput = screen.getByLabelText(/^아이디$/i);
      const passwordInput = screen.getByLabelText(/^비밀번호$/i);

      await user.type(usernameInput, 'teacher01');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /^로그인$/i });
      await user.click(submitButton);

      // Should navigate to dashboard for teacher role
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/dashboard',
          expect.objectContaining({ replace: true })
        );
      }, { timeout: 5000 });
    });
  });
});
