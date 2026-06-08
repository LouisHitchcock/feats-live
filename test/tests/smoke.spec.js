const { test, expect } = require('@playwright/test');
const { setupAuth } = require('../setup/auth');
const { setupApiMocks } = require('../setup/mocks');
const { openArticleEditor, typeInEditor, getEditorText, clickSave } = require('../utils/editor-helpers');
const { expectSaveStatus } = require('../utils/assertions');

test.describe('Smoke — Full Article CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await setupApiMocks(page);
  });

  test('admin dashboard loads', async ({ page }) => {
    await page.goto('/admin/');
    await expect(page.locator('#adminLayout.active')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#statsGrid')).toBeVisible();
  });

  test('article list has items', async ({ page }) => {
    await openArticleEditor(page);
    const count = await page.locator('.article-item').count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('selecting article loads its body', async ({ page }) => {
    await openArticleEditor(page, 1);
    const text = await getEditorText(page);
    expect(text).toContain('Kids in Glass Houses');
  });

  test('edit and save succeeds', async ({ page }) => {
    await openArticleEditor(page, 1);
    await typeInEditor(page, ' [APPENDED]');
    await clickSave(page);
    await expectSaveStatus(page, 'saved');
  });

  test('new article button creates draft', async ({ page }) => {
    await openArticleEditor(page);
    await page.click('button:has-text("+ New Article")');
    await page.waitForTimeout(500);
    const val = await page.locator('#articleTitleInput').inputValue();
    expect(val).toContain('Untitled Article');
  });

  test('dark mode toggles', async ({ page }) => {
    await openArticleEditor(page);
    await page.locator('#darkModeToggle').check();
    await page.waitForTimeout(100);
    await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();
  });
});
