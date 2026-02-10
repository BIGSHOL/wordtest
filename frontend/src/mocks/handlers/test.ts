import { http, HttpResponse } from 'msw';
import {
  mockTestSession,
  mockQuestions,
  mockCompletedSession,
} from '../data/tests';

const BASE_URL = 'http://localhost:8000';

export const testHandlers = [
  // POST /api/v1/tests/start
  http.post(`${BASE_URL}/api/v1/tests/start`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    return HttpResponse.json(
      {
        test_session: mockTestSession,
        questions: mockQuestions,
      },
      { status: 201 },
    );
  }),

  // POST /api/v1/tests/:id/answer
  http.post(`${BASE_URL}/api/v1/tests/:id/answer`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    const body = await request.json() as Record<string, string>;
    return HttpResponse.json({
      is_correct: body.selected_answer === '사과',
      correct_answer: '사과',
    });
  }),

  // GET /api/v1/tests/:id/result
  http.get(`${BASE_URL}/api/v1/tests/:id/result`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    if (params.id === 'nonexistent') {
      return HttpResponse.json(
        { detail: 'Test not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      test_session: mockCompletedSession,
      answers: [
        {
          question_order: 1,
          word_english: 'apple',
          correct_answer: '사과',
          selected_answer: '사과',
          is_correct: true,
        },
      ],
    });
  }),

  // GET /api/v1/tests
  http.get(`${BASE_URL}/api/v1/tests`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      tests: [mockCompletedSession],
    });
  }),
];
