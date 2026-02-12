/**
 * E2E: Level test flow.
 */
import { test, expect } from '@playwright/test';
import { registerTeacher, loginViaAPI, createStudentViaAPI, loginViaUI } from './helpers';

test.describe('Level Test', () => {
  let studentUsername: string;
  let studentPassword: string;

  test.beforeEach(async ({ page }) => {
    // Setup: teacher + student
    const teacher = await registerTeacher(page);
    const token = await loginViaAPI(page, teacher.username, teacher.password);
    const student = await createStudentViaAPI(page, token);
    studentUsername = student.username;
    studentPassword = student.password;
  });

  test('student can start test, answer questions, and see results', async ({ page }) => {
    test.setTimeout(120_000); // Allow time for answering all questions

    // Login as student via helper
    await loginViaUI(page, studentUsername, studentPassword);
    await expect(page).toHaveURL(/\/(student|test)/, { timeout: 10_000 });

    // Student may see '코드 입력하러 가기' or '레벨 테스트 시작'
    // Try clicking '레벨 테스트 시작' if visible, otherwise '코드 입력하러 가기'
    const levelTestBtn = page.locator('text=레벨 테스트 시작');
    const codeEntryBtn = page.getByRole('button', { name: '코드 입력하러 가기' });

    if (await levelTestBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await levelTestBtn.click();
    } else if (await codeEntryBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await codeEntryBtn.click();
      // After navigating, look for test start button
      await page.waitForTimeout(1_000);
      const startBtn = page.locator('text=테스트 시작하기');
      if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await startBtn.click();
      }
    }

    await expect(page).toHaveURL(/\/test/, { timeout: 10_000 });

    // Wait for question to appear
    await page.waitForTimeout(2_000);
    await expect(page.locator('[class*="question"], [class*="quiz"], [class*="test"]').first()).toBeVisible({ timeout: 10_000 });

    // Answer all questions
    let finished = false;
    while (!finished) {
      // Select first answer card (A)
      const firstChoice = page.locator('button').filter({ has: page.locator('span', { hasText: /^A$/ }) });
      await firstChoice.click();

      // Submit
      const submitBtn = page.getByRole('button', { name: '정답 확인' });
      await submitBtn.click();

      // Wait for action button to appear after answer feedback
      const nextBtn = page.getByRole('button', { name: '다음 문제' });
      const resultBtn = page.getByRole('button', { name: '결과 보기' });

      // Wait for either button to appear
      await expect(nextBtn.or(resultBtn)).toBeVisible({ timeout: 5_000 });

      if (await resultBtn.isVisible()) {
        await resultBtn.click();
        finished = true;
      } else {
        await nextBtn.click();
        // Wait for next question to load
        await page.waitForTimeout(300);
      }
    }

    // Should be on result page
    await expect(page).toHaveURL(/\/result\//, { timeout: 10_000 });
    await expect(page.locator('text=테스트 결과')).toBeVisible();
    await expect(page.locator('text=문제별 결과')).toBeVisible();
  });
});
