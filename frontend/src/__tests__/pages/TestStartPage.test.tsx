/**
 * TestStartPage component tests.
 * Tests auto-start from URL param and error handling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import TestStartPage from '../../pages/student/TestStartPage';
import { useTestStore } from '../../stores/testStore';

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
      // Add handler for config lookup that delays to ensure we see loading
      server.use(
        http.get(`${BASE_URL}/api/v1/test-configs/code/:code`, async () => {
          await new Promise((r) => setTimeout(r, 500));
          return HttpResponse.json({
            id: 'config-001',
            teacher_id: 'teacher-001',
            name: 'Test Config',
            test_code: 'A3X7K2',
            test_type: 'placement',
            question_count: 20,
            time_limit_seconds: 600,
            is_active: true,
            book_name: null,
            level_range_min: 1,
            level_range_max: 15,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          });
        }),
      );

      renderWithCode('A3X7K2');
      expect(screen.getByText(/테스트 준비 중/)).toBeInTheDocument();
    });

    it('navigates to /test on successful auto-start', async () => {
      server.use(
        http.get(`${BASE_URL}/api/v1/test-configs/code/:code`, () => {
          return HttpResponse.json({
            id: 'config-001',
            teacher_id: 'teacher-001',
            name: 'Test Config',
            test_code: 'A3X7K2',
            test_type: 'placement',
            question_count: 20,
            time_limit_seconds: 600,
            is_active: true,
            book_name: null,
            level_range_min: 1,
            level_range_max: 15,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          });
        }),
      );

      renderWithCode('A3X7K2');
      await waitFor(
        () => {
          expect(mockNavigate).toHaveBeenCalledWith('/test', { replace: true });
        },
        { timeout: 5000 },
      );
    });

    it('shows error message on invalid code', async () => {
      server.use(
        http.get(`${BASE_URL}/api/v1/test-configs/code/:code`, () => {
          return HttpResponse.json(
            { detail: 'Test config not found' },
            { status: 404 },
          );
        }),
      );

      renderWithCode('BADCOD');
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
      expect(screen.getByText(/영단어 레벨테스트/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('A3X7K2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /테스트 시작/i })).toBeDisabled();
    });
  });
});
