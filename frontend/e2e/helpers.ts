/**
 * E2E test helpers.
 */
import { type Page } from '@playwright/test';

const API_BASE = 'http://localhost:8000';

/** Unique suffix to avoid collisions between test runs. */
export function unique() {
  return Math.random().toString(36).slice(2, 8);
}

/** Register a teacher via API and return credentials. */
export async function registerTeacher(page: Page) {
  const suffix = unique();
  const email = `teacher_${suffix}@test.com`;
  const password = 'Test1234!';
  const name = `Teacher ${suffix}`;

  const res = await page.request.post(`${API_BASE}/api/v1/auth/register`, {
    data: { email, password, name },
  });
  if (!res.ok()) throw new Error(`Register failed: ${res.status()}`);

  return { email, password, name };
}

/** Login and get access token via API (JSON endpoint). */
export async function loginViaAPI(page: Page, email: string, password: string) {
  const res = await page.request.post(`${API_BASE}/api/v1/auth/login/json`, {
    data: { email, password },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  const data = await res.json();
  return data.access_token as string;
}

/** Create a student via API (requires teacher token). */
export async function createStudentViaAPI(page: Page, token: string) {
  const suffix = unique();
  const username = `student_${suffix}`;
  const password = 'Test1234!';
  const name = `Student ${suffix}`;

  const res = await page.request.post(`${API_BASE}/api/v1/students`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { username, password, name },
  });
  if (!res.ok()) throw new Error(`Create student failed: ${res.status()}`);
  const student = await res.json();

  return { id: student.id, username, password, name };
}

/** Login via the UI (input is type="text", accepts email or username). */
export async function loginViaUI(page: Page, identifier: string, password: string) {
  await page.goto('/login');
  await page.fill('#email', identifier);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}
