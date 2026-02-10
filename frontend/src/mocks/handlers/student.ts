import { http, HttpResponse } from 'msw';
import { mockStudents, mockStudent } from '../data/users';

const BASE_URL = 'http://localhost:8000';

export const studentHandlers = [
  // GET /api/v1/students
  http.get(`${BASE_URL}/api/v1/students`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    return HttpResponse.json(mockStudents);
  }),

  // POST /api/v1/students
  http.post(`${BASE_URL}/api/v1/students`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    const body = await request.json() as Record<string, string>;
    return HttpResponse.json(
      {
        ...mockStudent,
        id: crypto.randomUUID(),
        username: body.username,
        name: body.name,
      },
      { status: 201 },
    );
  }),

  // PATCH /api/v1/students/:id
  http.patch(`${BASE_URL}/api/v1/students/:id`, async ({ request, params }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    const body = await request.json() as Record<string, string>;
    const student = mockStudents.find((s) => s.id === params.id);
    if (!student) {
      return HttpResponse.json(
        { detail: 'Student not found' },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      ...student,
      ...body,
    });
  }),

  // DELETE /api/v1/students/:id
  http.delete(`${BASE_URL}/api/v1/students/:id`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Not authenticated' },
        { status: 401 },
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
