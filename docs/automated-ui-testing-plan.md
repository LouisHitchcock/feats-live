# Automated UI Testing for Feats. Editor

## Overview

This system lets an AI model validate editor UI changes **without any human interaction**, using **Playwright** — a headless browser automation framework. It runs against a local static file server with mock API responses, bypassing Google OAuth entirely.

### What it covers
- **DOM assertions** — Check buttons exist, have `.active` class, editor contains expected HTML
- **Keyboard shortcuts** — Ctrl+B, Ctrl+I, Ctrl+Z/Y, etc.
- **contenteditable interactions** — Type text, select ranges, apply formats
- **Editor state** — Undo/redo, markdown round‑trip, paste sanitisation
- **Visual regression** — Screenshot comparison (golden vs actual)
- **Full CRUD** — Load article, edit, save, verify properties panel

### How it works
1. **Playwright spins up a static file server** (Node.js `http` server serving project root)
2. **Auth bypass**: `page.addInitScript()` sets `localStorage` token before page loads; `page.route('**/admin/me')` returns a fake user
3. **API mocking**: `page.route()` intercepts every REST call and returns fixture data
4. **Tests run in headless Chromium + Firefox** — fully automated

---

## File Structure

```
test/
├── package.json
├── playwright.config.js
├── server.js
├── setup/
│   ├── auth.js
│   ├── mocks.js
│   └── fixtures.js
├── utils/
│   ├── editor-helpers.js
│   └── assertions.js
└── tests/
    ├── smoke.spec.js
    ├── toolbar.spec.js
    ├── formatting.spec.js
    ├── undo.spec.js
    ├── paste.spec.js
    ├── media.spec.js
    ├── markdown.spec.js
    ├── properties.spec.js
    ├── keyboard.spec.js
    ├── ux.spec.js
    └── tables.spec.js
```

---

## Core Files (Copy‑Paste Ready)

### test/package.json
```json
{
  "name": "feats-editor-tests",
  "private": true,
  "scripts": {
    "test": "npx playwright test",
    "test:smoke": "npx playwright test smoke.spec.js",
    "test:toolbar": "npx playwright test toolbar.spec.js",
    "test:undo": "npx playwright test undo.spec.js",
    "test:markdown": "npx playwright test markdown.spec.js",
    "test:all": "npx playwright test",
    "update-snapshots": "npx playwright test --update-snapshots"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
```

### test/playwright.config.js
```js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
    ['html', { outputFolder: 'playwright-report' }]
  ],
  use: {
    baseURL: 'http://localhost:3456',
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    headless: true,
  },
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3456/admin/',
    timeout: 10000,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
```

### test/server.js
```js
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3456;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const filePath = path.join(ROOT, url);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Test server on :${PORT}`));
```

### test/setup/auth.js
```js
async function setupAuth(page) {
  await page.addInitScript(() => {
    localStorage.setItem('feats_admin_token', 'test-token-12345');
  });
  await page.route('**/admin/me', route => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Test User', email: 'test@feats.live', role: 'admin' }),
    });
  });
}

module.exports = { setupAuth };
```

### test/setup/fixtures.js
```js
const defaultDashboard = {
  totalArticles: 5, publishedArticles: 4, totalWriters: 2,
  totalViews: 12450, uniqueVisitors: 8720, storageMB: 42.3,
};

const defaultWriters = [
  { name: 'Louis Hitchcock' }, { name: 'Jane Doe' },
];

const defaultArticles = [
  {
    id: 1, title: 'Kids in Glass Houses Live Review',
    url_id: 'kids-in-glass-houses-review', author: 'Louis Hitchcock',
    excerpt: 'A night to remember at Shepherds Bush.',
    body: '<h2>Review</h2><p>When <strong>Kids in Glass Houses</strong> hit the stage...</p><p>The band delivered an outstanding night.</p>',
    categories: 'Live Music, Gig Review', tags: 'review',
    publish_date: '2026-01-03T00:00', status: 'publish',
  },
  {
    id: 2, title: 'Turnstile at Depot Mayfield',
    url_id: 'turnstile-manchester-review', author: 'Louis Hitchcock',
    excerpt: 'Hardcore takeover of Depot Mayfield.',
    body: '<p>The hardcore takeover of Depot Mayfield was exciting.</p>',
    categories: 'Live Music', tags: 'turnstile, manchester',
    publish_date: '2025-11-24T00:00', status: 'publish',
  },
  {
    id: 3, title: 'Draft Article', url_id: 'draft-article',
    author: 'Louis Hitchcock', excerpt: '',
    body: '<p>Work in progress...</p>',
    categories: '', tags: '',
    publish_date: '2026-02-01T12:00', status: 'draft',
  },
];

module.exports = { defaultDashboard, defaultWriters, defaultArticles };
```

### test/setup/mocks.js
```js
const fixtures = require('./fixtures');

async function setupApiMocks(page, options = {}) {
  const {
    articles = fixtures.defaultArticles,
    writers = fixtures.defaultWriters,
    dashboard = fixtures.defaultDashboard,
  } = options;

  await page.route('**/admin/dashboard', route => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(dashboard) });
  });

  await page.route('**/admin/articles', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ article: { id: 999, status: 'draft' } }) });
    } else {
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ articles }) });
    }
  });

  await page.route(/\/admin\/articles\/\d+$/, (route, request) => {
    const id = parseInt(new URL(request.url()).pathname.split('/').pop(), 10);
    const article = articles.find(a => a.id === id);
    if (article) {
      if (request.method() === 'PUT' || request.method() === 'DELETE') {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ article }) });
      }
    } else {
      route.fulfill({ status: 404, body: 'Not found' });
    }
  });

  await page.route('**/admin/writers', route => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ writers }) });
  });
}

module.exports = { setupApiMocks };
```

### test/utils/editor-helpers.js
```js
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
```

### test/utils/assertions.js
```js
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
```

---

## Test Examples

### test/tests/smoke.spec.js — Full Article CRUD
```js
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
```

### test/tests/toolbar.spec.js — Buttons & Active States
```js
const { test, expect } = require('@playwright/test');
const { setupAuth } = require('../setup/auth');
const { setupApiMocks } = require('../setup/mocks');
const {
  openArticleEditor, typeInEditor, selectAllInEditor,
  clickToolbarButton, expectToolbarButtonActive, getEditorHTML,
} = require('../utils/editor-helpers');
const { expectToolbarHasAllButtons } = require('../utils/assertions');

test.describe('Toolbar — Buttons & Active States', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await setupApiMocks(page);
    await openArticleEditor(page);
  });

  test('all buttons present', async ({ page }) => {
    await expectToolbarHasAllButtons(page);
  });

  test('bold applies <strong>', async ({ page }) => {
    await clickToolbarButton(page, 'bold');
    await typeInEditor(page, 'bold text');
    expect(await getEditorHTML(page)).toMatch(/<strong>bold text<\/strong>/);
  });

  test('italic applies <em>', async ({ page }) => {
    await clickToolbarButton(page, 'italic');
    await typeInEditor(page, 'italics');
    expect(await getEditorHTML(page)).toMatch(/<em>italics<\/em>/);
  });

  test('underline applies <u>', async ({ page }) => {
    await clickToolbarButton(page, 'underline');
    await typeInEditor(page, 'under');
    expect(await getEditorHTML(page)).toContain('<u>under</u>');
  });

  test('strikethrough applies <del>', async ({ page }) => {
    await clickToolbarButton(page, 'strikeThrough');
    await typeInEditor(page, 'gone');
    expect(await getEditorHTML(page)).toMatch(/<del>gone<\/del>/);
  });

  test('heading dropdown changes block', async ({ page }) => {
    await typeInEditor(page, 'My Heading');
    await page.selectOption('#editorStyleDropdown', 'h2');
    expect(await getEditorHTML(page)).toContain('<h2>My Heading</h2>');
  });

  test('alignment center works', async ({ page }) => {
    await typeInEditor(page, 'Centered');
    await clickToolbarButton(page, 'justifyCenter');
    expect(await getEditorHTML(page)).toMatch(/text-align:\s*center/);
  });

  test('unordered list creates <ul>', async ({ page }) => {
    await clickToolbarButton(page, 'insertUnorderedList');
    await typeInEditor(page, 'Item 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Item 2');
    const html = await getEditorHTML(page);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 2</li>');
  });

  test('ordered list creates <ol>', async ({ page }) => {
    await clickToolbarButton(page, 'insertOrderedList');
    await typeInEditor(page, 'First');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second');
    const html = await getEditorHTML(page);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
  });

  test('superscript toggles', async ({ page }) => {
    await clickToolbarButton(page, 'superscript');
    await typeInEditor(page, '2');
    expect(await getEditorHTML(page)).toMatch(/<sup>2<\/sup>/);
  });

  test('clear formatting strips inline styles', async ({ page }) => {
    await clickToolbarButton(page, 'bold');
    await typeInEditor(page, 'text');
    await selectAllInEditor(page);
    await clickToolbarButton(page, 'removeFormat');
    expect(await getEditorHTML(page)).not.toMatch(/<strong>/);
  });

  test('link prompts for URL when text selected', async ({ page }) => {
    await typeInEditor(page, 'Click me');
    await selectAllInEditor(page);
    page.once('dialog', async d => { await d.accept('https://example.com'); });
    await clickToolbarButton(page, 'createLink');
    expect(await getEditorHTML(page)).toContain('href="https://example.com"');
  });

  test('unlink removes href', async ({ page }) => {
    await typeInEditor(page, 'Linked');
    await selectAllInEditor(page);
    page.once('dialog', async d => d.accept('https://t.com'));
    await clickToolbarButton(page, 'createLink');
    await selectAllInEditor(page);
    await clickToolbarButton(page, 'unlink');
    const html = await getEditorHTML(page);
    expect(html).not.toContain('href');
    expect(html).toContain('Linked');
  });
});
```

---

## Running Tests

### One‑time setup
```bash
cd test
npm install
npx playwright install chromium firefox
```

### Run all tests
```bash
cd test
npx playwright test
```

### Run specific test file
```bash
npx playwright test toolbar.spec.js
```

### Run with visible browser (debug)
```bash
npx playwright test --headed
```

### Run single test by name
```bash
npx playwright test -g "bold applies"
```

---

## Key Design Decisions

| Problem | Solution |
|---|---|
| **Google OAuth blocks automated login** | `addInitScript` sets localStorage token; `page.route('**/admin/me')` returns fake user |
| **Need real Workers backend** | `page.route()` intercepts all REST calls — zero backend dependency |
| **contenteditable selection is DOM‑based** | `page.keyboard.press('Control+a')` for select‑all; `evaluate` with `createRange` |
| **Undo snapshots are timer‑based (300ms)** | `page.waitForTimeout(400)` after input to let debounce fire |
| **Browser dialog (prompt for URL)** | `page.once('dialog', ...)` intercepts `prompt()` synchronously |
| **Dark mode toggle** | Toggle `#darkModeToggle` checkbox → verify `[data-theme="dark"]` appears |
| **Testing in CI / overnight** | `headless: true` — no display needed; `npm test` exit code 0/1 |

---

## Continuation Prompt for AI Model

```
CONTINUATION CONTEXT:
The Feats. editor testing system is set up. The test/ directory exists with package.json,
server.js, auth.js, mocks.js, fixtures.js, editor-helpers.js, and assertions.js.
We have placeholder test files for toolbar, undo, markdown, and smoke.

We need to create ALL remaining test files and run them:
1. tests/formatting.spec.js — Test bold/italic combos, H1-H4 headings,
   inline code toggle, blockquote toggle
2. tests/paste.spec.js — Test pasting from Word/Google Docs
3. tests/media.spec.js — Test image insert, carousel, image resize/alignment
4. tests/properties.spec.js — Test slug, status, date, writer, categories, tags, delete
5. tests/keyboard.spec.js — Test Ctrl+B/I/U/K/Z/Y/Shift+X/Shift+7/Shift+8/Alt+0-4
6. tests/ux.spec.js — Test word count, auto‑save, full‑screen, find & replace
7. tests/tables.spec.js — Test table insert, cell editing, column resize, Tab navigation

For each file:
- Use helpers from ../utils/editor-helpers.js and ../utils/assertions.js
- beforeEach must call setupAuth(page) + setupApiMocks(page) + openArticleEditor(page)
- After creating all files, run `npx playwright test` and fix any failing tests

Start by reading the existing test files to understand the pattern.
```
