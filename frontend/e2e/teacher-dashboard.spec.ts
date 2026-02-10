/**
 * E2E: Teacher dashboard and student management.
 */
import { test, expect } from '@playwright/test';
import { unique, registerTeacher, loginViaAPI, createStudentViaAPI, loginViaUI } from './helpers';

test.describe('Teacher Dashboard', () => {
  test('teacher can create and see students', async ({ page }) => {
    // Register and login as teacher
    const teacher = await registerTeacher(page);
    await loginViaUI(page, teacher.email, teacher.password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Navigate to student management
    await page.click('text=학생 관리');
    await expect(page).toHaveURL(/\/students/);

    // Click "+ 학생 추가" to show the add form
    await page.click('text=학생 추가');

    const suffix = unique();

    // Fill student creation form using placeholders
    await page.fill('input[placeholder="아이디"]', `stu_${suffix}`);
    await page.fill('input[placeholder="비밀번호"]', 'Pass1234!');
    await page.fill('input[placeholder="이름"]', `학생 ${suffix}`);

    // Click 등록 button
    await page.click('button:has-text("등록")');

    // Student should appear in list
    await expect(page.locator(`text=학생 ${suffix}`)).toBeVisible({ timeout: 5_000 });
  });

  test('teacher can view student test results', async ({ page }) => {
    test.setTimeout(60_000); // More time for API operations

    // Setup: teacher + student + complete a test via API
    const teacher = await registerTeacher(page);
    const token = await loginViaAPI(page, teacher.email, teacher.password);
    const student = await createStudentViaAPI(page, token);

    // Login student via API to get student token
    const studentLoginRes = await page.request.post('http://localhost:8000/api/v1/auth/login/json', {
      data: { email: student.username, password: student.password },
    });
    const { access_token: studentToken } = await studentLoginRes.json();

    // Start a test as student via API
    const startRes = await page.request.post('http://localhost:8000/api/v1/tests/start', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { test_type: 'placement' },
    });
    const testData = await startRes.json();
    const testId = testData.test_session.id;
    const questions = testData.questions;

    // Answer all questions via API
    for (const q of questions) {
      await page.request.post(`http://localhost:8000/api/v1/tests/${testId}/answer`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        data: {
          word_id: q.word.id,
          selected_answer: q.choices[0],
          question_order: q.question_order,
        },
      });
    }

    // Now login as teacher via UI
    await loginViaUI(page, teacher.email, teacher.password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Click on student results
    await page.click('text=결과 보기');
    await expect(page).toHaveURL(/\/students\/.*\/results/);

    // Should see test history
    await expect(page.locator('text=테스트 이력')).toBeVisible();
    await expect(page.locator('text=정답')).toBeVisible();
  });
});
