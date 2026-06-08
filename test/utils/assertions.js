const { expect } = require('@playwright/test');
const { EDITOR_SEL, TOOLBAR_SEL } = require('./editor-helpers');

async function expectEditorContains(page, selector, timeout = 3000) {
  await expect(page.locator(`${EDITOR_SEL} ${selector}`).first()).toBeVisible({ timeout });
}

async function expectEditorTextContains(page, text, timeout = 3000) {
  await expect(page.locator(EDITOR_SEL)).toContainText(text, { timeout });
}

async function expectStyleDropdownValue(page, value) {
  await expect(page.locator('#editorStyleDropdown')).toHaveValue(value);
}

async function expectToolbarHasAllButtons(page) {
  const commands = [
    'bold','italic','underline','strikeThrough','code',
    'justifyLeft','justifyCenter','justifyRight',
    'createLink','unlink','removeFormat',
    'insertUnorderedList','insertOrderedList','blockquote',
    'superscript','insertImage','insertTable',
  ];
  for (const cmd of commands) {
    await expect(page.locator(`${TOOLBAR_SEL} [data-command="${cmd}"]`)).toBeVisible({ timeout: 1000 });
  }
}

async function expectSaveStatus(page, containsText, timeout = 5000) {
  await expect(page.locator('#articleSaveStatus')).toContainText(containsText, { timeout });
}

async function expectWordCount(page, expectedCount) {
  await expect(page.locator('.editor-statusbar')).toContainText(String(expectedCount), { timeout: 2000 });
}

module.exports = {
  expectEditorContains, expectEditorTextContains,
  expectStyleDropdownValue, expectToolbarHasAllButtons,
  expectSaveStatus, expectWordCount,
};
