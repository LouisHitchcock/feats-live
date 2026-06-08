const { expect } = require('@playwright/test');

const EDITOR_SEL = '#articleBodyEditor';
const TOOLBAR_SEL = '.editor-toolbar';

async function openArticleEditor(page, articleId = 1) {
  await page.goto('/admin/');
  await page.waitForSelector('#adminLayout.active', { timeout: 5000 });
  await page.click('[data-tab="articles"]');
  await page.waitForSelector('.article-item', { timeout: 5000 });
  await page.click(`button.article-item:nth-child(${articleId})`);
  await page.waitForSelector(EDITOR_SEL, { timeout: 5000 });
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('contenteditable') === 'true',
    EDITOR_SEL, { timeout: 5000 }
  );
}

async function typeInEditor(page, text) {
  await page.click(EDITOR_SEL);
  await page.keyboard.type(text);
  await page.waitForTimeout(100);
}

async function selectAllInEditor(page) {
  await page.click(EDITOR_SEL);
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(50);
}

async function clickToolbarButton(page, command) {
  await page.click(`${TOOLBAR_SEL} [data-command="${command}"]`);
  await page.waitForTimeout(50);
}

async function expectToolbarButtonActive(page, command, expected = true) {
  const btn = page.locator(`${TOOLBAR_SEL} [data-command="${command}"]`);
  if (expected) await expect(btn).toHaveClass(/active/);
  else await expect(btn).not.toHaveClass(/active/);
}

async function getEditorHTML(page) {
  return page.evaluate((sel) => document.querySelector(sel).innerHTML, EDITOR_SEL);
}

async function getEditorText(page) {
  return page.evaluate((sel) => document.querySelector(sel).textContent, EDITOR_SEL);
}

async function clickSave(page) {
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(500);
}

async function toggleMarkdownMode(page, mode) {
  await page.click(`#articleEditorModeToggle button[data-mode="${mode}"]`);
  await page.waitForTimeout(100);
}

async function openContextMenu(page, x = 200, y = 200) {
  await page.click(EDITOR_SEL, { position: { x, y }, button: 'right' });
  await page.waitForSelector('#articleEditorContextMenu.active', { timeout: 2000 });
}

async function clickContextMenuItem(page, action) {
  await page.click(`#articleEditorContextMenu [data-action="${action}"]`);
  await page.waitForTimeout(100);
}

async function pressShortcut(page, key, ctrl = true) {
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  const combo = ctrl ? `${mod}+${key}` : key;
  await page.keyboard.press(combo);
  await page.waitForTimeout(100);
}

async function takeEditorScreenshot(page, name) {
  const box = await page.locator('.article-editor-panel').boundingBox();
  if (box) await page.screenshot({ path: `test/snapshots/${name}.png`, clip: box });
}

module.exports = {
  EDITOR_SEL, TOOLBAR_SEL,
  openArticleEditor, typeInEditor, selectAllInEditor,
  clickToolbarButton, expectToolbarButtonActive,
  getEditorHTML, getEditorText, clickSave,
  toggleMarkdownMode, openContextMenu, clickContextMenuItem,
  pressShortcut, takeEditorScreenshot,
};
