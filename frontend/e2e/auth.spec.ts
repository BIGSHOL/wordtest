/**
 * E2E: Authentication flows.
 */
import { test, expect } from '@playwright/test';
import { unique, loginViaUI } from './helpers';

test.describe('Authentication', () => {
  test('teacher can register and lands on dashboard', async ({ page }) => {
    const suffix = unique();
    await page.goto('/register');

    await page.fill('#name', `E2E ${suffix}`);
    await page.fill('#email', `e2e_${suffix}@test.com`);
    await page.fill('#password', 'Test1234!');
    await page.fill('#confirmPassword', 'Test1234!');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page.locator('text=대시보드')).toBeVisible();
  });

  test('teacher can login and logout', async ({ page }) => {
    // First register
    const suffix = unique();
    const email = `e2e_${suffix}@test.com`;
    const password = 'Test1234!';
    await page.goto('/register');
    await page.fill('#name', `E2E ${suffix}`);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.fill('#confirmPassword', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Logout
    await page.click('text=로그아웃');
    await expect(page).toHaveURL(/\/login/);

    // Login again
    await loginViaUI(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('student can login with username', async ({ page }) => {
    // Setup via API: register teacher, create student
    const suffix = unique();
    const teacherEmail = `e2e_t_${suffix}@test.com`;
    const teacherPw = 'Test1234!';

    // Register teacher via API
    await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: { email: teacherEmail, password: teacherPw, name: `T ${suffix}` },
    });

    // Login teacher to get token
    const loginRes = await page.request.post('http://localhost:8000/api/v1/auth/login/json', {
      data: { email: teacherEmail, password: teacherPw },
    });
    const { access_token } = await loginRes.json();

    // Create student
    const studentUsername = `e2e_s_${suffix}`;
    const studentPw = 'Student1!';
    await page.request.post('http://localhost:8000/api/v1/students', {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { username: studentUsername, password: studentPw, name: `S ${suffix}` },
    });

    // Login as student via UI (username-based login)
    await loginViaUI(page, studentUsername, studentPw);

    await expect(page).toHaveURL(/\/student/, { timeout: 10_000 });
    await expect(page.locator('text=테스트 시작')).toBeVisible();
  });
});
