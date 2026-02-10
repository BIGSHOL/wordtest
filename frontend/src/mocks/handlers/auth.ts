import { http, HttpResponse } from 'msw';
import { mockTeacher } from '../data/users';

const BASE_URL = 'http://localhost:8000';

export const authHandlers = [
  // POST /api/v1/auth/register
  http.post(`${BASE_URL}/api/v1/auth/register`, async ({ request }) => {
    const body = await request.json() as Record<string, string>;
    if (!body.email || !body.password || !body.name) {
      return HttpResponse.json(
        { detail: 'Validation error' },
        { status: 422 },
      );
    }
    return HttpResponse.json(
      {
        ...mockTeacher,
        id: 'new-teacher-001',
        email: body.email,
        name: body.name,
      },
      { status: 201 },
    );
  }),

  // POST /api/v1/auth/login/json
  http.post(`${BASE_URL}/api/v1/auth/login/json`, async ({ request }) => {
    const body = await request.json() as Record<string, string>;
    if (body.email === 'teacher@test.com' && body.password === 'password123') {
      return HttpResponse.json({
        access_token: 'mock-access-token',
        token_type: 'bearer',
      });
    }
    return HttpResponse.json(
      { detail: 'Incorrect email or password' },
      { status: 401 },
    );
  }),

  // POST /api/v1/auth/logout
  http.post(`${BASE_URL}/api/v1/auth/logout`, () => {
    return HttpResponse.json({ message: 'Successfully logged out' });
  }),

  // GET /api/v1/users/me
  http.get(`${BASE_URL}/api/v1/users/me`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    return HttpResponse.json(mockTeacher);
  }),

  // POST /api/v1/auth/password/change
  http.post(`${BASE_URL}/api/v1/auth/password/change`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    const body = await request.json() as Record<string, string>;
    if (body.current_password !== 'password123') {
      return HttpResponse.json(
        { detail: 'Incorrect current password' },
        { status: 400 },
      );
    }
    return HttpResponse.json({ message: 'Password changed successfully' });
  }),
];
