/**
 * TestStartPage component tests.
 * Tests auto-start from URL param and error handling.
 * Uses mastery-first flow with legacy fallback.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import TestStartPage from '../../pages/student/TestStartPage';
import { useTestStore } from '../../stores/testStore';
import { mockTestSession, mockQuestions } from '../../mocks/data/tests';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const BASE_URL = 'http://localhost:8000';

beforeEach(() => {
  mockNavigate.mockReset();
  localStorage.setItem('access_token', 'mock-access-token');
  useTestStore.getState().reset();

  // Default: mastery API returns 404 (fallback to legacy test flow)
  server.use(
    http.post(`${BASE_URL}/api/v1/mastery/start-by-code`, () => {
      return HttpResponse.json(
        { detail: 'Invalid or inactive test code' },
        { status: 404 },
      );
    }),
  );
});

function renderWithCode(code: string) {
  return render(
    <MemoryRouter initialEntries={[`/test/start?code=${code}`]}>
      <TestStartPage />
    </MemoryRouter>
  );
}

function renderWithoutCode() {
  return render(
    <MemoryRouter initialEntries={['/test/start']}>
      <TestStartPage />
    </MemoryRouter>
  );
}

describe('TestStartPage', () => {
  describe('Auto-start from URL param', () => {
    it('shows loading state with valid code param', async () => {
      // Mastery API delays to ensure we see loading
      server.use(
        http.post(`${BASE_URL}/api/v1/mastery/start-by-code`, async () => {
          await new Promise((r) => setTimeout(r, 500));
          return HttpResponse.json(
            { detail: 'Invalid or inactive test code' },
            { status: 404 },
          );
        }),
      );

      renderWithCode('A3X7K2PP');
      expect(screen.getByText(/테스트 준비 중/)).toBeInTheDocument();
    });

    it('navigates to /test on successful legacy auto-start', async () => {
      // Mastery fails → legacy start-by-code succeeds
      server.use(
        http.post(`${BASE_URL}/api/v1/tests/start-by-code`, () => {
          return HttpResponse.json({
            access_token: 'mock-jwt-token',
            test_session: mockTestSession,
            questions: mockQuestions,
            student_name: 'Test Student',
          });
        }),
      );

      renderWithCode('A3X7K2PP');
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('/test', { replace: true });
        },
        { timeout: 5000 },
      );
    });

    it('shows error message on invalid code', async () => {
      // Both mastery and legacy fail
      server.use(
        http.post(`${BASE_URL}/api/v1/tests/start-by-code`, () => {
          return HttpResponse.json(
            { detail: 'Invalid or inactive test code' },
            { status: 404 },
          );
        }),
      );

      renderWithCode('BADCODE1');
      await waitFor(
        () => {
          expect(screen.getByText(/유효하지 않은 테스트 코드/)).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
    });
  });

  describe('Manual flow', () => {
    it('renders test code input and start button without URL param', () => {
      renderWithoutCode();
      expect(screen.getByText(/영단어 학습/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('HKWN3V7P')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /테스트 시작/i })).toBeDisabled();
    });
  });
});
