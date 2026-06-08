# Master Prompt: Autonomous Implementation of Feats Editor Overhaul

Copy-paste this entire message into a new conversation with the AI agent.

---

## TASK SUMMARY

You will autonomously implement a Google Docs‑style overhaul of the Feats. admin article editor. You will:
1. Create a branch `feature/feats-editor`
2. Configure GitHub Pages to deploy from that branch
3. Implement all features across 5 phases — reading the detailed planning docs as you go
4. Set up and run automated Playwright tests after every phase
5. Commit regularly with descriptive messages
6. Push frequently

This is a **vanilla JS static site** with no build tools, no package.json, no framework. All JS is loaded via `<script>` tags. All CSS is plain `.css` files. HTML is pure static pages.

---

## INITIAL SETUP (Do First)

```bash
# Create and switch to the feature branch
git checkout -b feature/feats-editor

# Push the branch and set upstream
git push -u origin feature/feats-editor

# Set GitHub Pages to deploy from gh-pages branch (or feature/feats-editor root)
# Navigate to: https://github.com/LouisHitchcock/feats-live/settings/pages
# Under "Build and deployment" → Source: "Deploy from a branch"
# Branch: "gh-pages" /(root)
# If using feature/feats-editor directly: select feature/feats-editor and /(root)
# Click Save
```

Note: If GitHub Pages doesn't support deploying from `feature/feats-editor` directly, create a `gh-pages` branch from it after completing all work:
```bash
git checkout feature/feats-editor
git checkout -b gh-pages
git push -u origin gh-pages
```

---

## RULES FOR THE AI

1. **Read the planning docs before starting each phase**: The files `docs/editor-overhaul-plan.md` and `docs/automated-ui-testing-plan.md` contain exact implementation details, code snippets, CSS, and test checklists. Read the relevant section before coding.

2. **One phase at a time**: Do NOT skip ahead. Complete Phase 1 fully (code + tests) before starting Phase 2.

3. **Test after every phase**: Set up the Playwright test infrastructure first, then write and run tests for each phase before proceeding.

4. **Commit after every meaningful change**: Use descriptive commit messages like `feat(editor): add sticky top toolbar with style dropdown and active states`.

5. **Push regularly**: Push to `feature/feats-editor` after each commit or at minimum after each phase completes.

6. **Never break existing functionality**: After every change, the editor must still load articles, save articles, render on frontend, support markdown mode, dark mode, and all existing custom blocks (carousels, pull quotes, callouts, CTAs, spacers).

7. **Keep vanilla JS**: Do NOT introduce React, Vue, Svelte, TypeScript, or any framework. Do NOT introduce ProseMirror, Quill, TipTap, TinyMCE, or any rich text library. All new code goes into plain `.js` files loaded via `<script>` tags.

8. **Module split is OK**: Creating new `.js` files (e.g., `js/admin-editor.js`, `js/admin-core.js`) and loading them in `admin/index.html` is encouraged for code organisation.

9. **Reference the planning docs constantly**: When unsure about implementation details, re‑read the relevant section of `docs/editor-overhaul-plan.md`.

---

## PHASE 0: Set Up Test Infrastructure

**Before touching any editor code**, set up the Playwright testing system.

### Step 0.1: Read the test plan
Read `docs/automated-ui-testing-plan.md` fully to understand the testing architecture.

### Step 0.2: Create the test directory and files

Create these directories and files following the exact code in the planning doc:

```
test/
├── package.json          (copy from plan)
├── playwright.config.js  (copy from plan)
├── server.js             (copy from plan)
├── setup/
│   ├── auth.js           (copy from plan)
│   ├── mocks.js          (copy from plan)
│   └── fixtures.js       (copy from plan)
├── utils/
│   ├── editor-helpers.js (copy from plan)
│   └── assertions.js     (copy from plan)
└── tests/
    └── (empty for now — created per phase)
```

### Step 0.3: Install dependencies
```bash
cd test
npm install
npx playwright install chromium firefox
```

### Step 0.4: Create a basic smoke test to verify it works
Create `test/tests/smoke.spec.js` using the exact code from the planning doc (the one that tests dashboard loads, article list, article selection, save, dark mode).

### Step 0.5: Run the smoke test to verify the infrastructure works
```bash
cd test
npx playwright test
```

The test will fail (because the editor doesn't have the new toolbar yet) but should fail with clear error messages, NOT infrastructure errors. If you get `net::ERR_CONNECTION_REFUSED`, the static server isn't starting — fix `server.js`.

**Do not proceed to Phase 1 until the test infrastructure starts and runs (even if tests fail on assertions).** The server must serve the admin page, auth must bypass successfully, and the article list must load.

**Commit**: `test: set up Playwright test infrastructure with auth bypass and API mocks`

---

## PHASE 1: Toolbar Restructure & Core Formatting

### Read before starting
Read `docs/editor-overhaul-plan.md` — the entire Phase 1 section (Section 4), including all substeps 1.1 through 1.12.

Also review `docs/feats-editor-audit.md` Sections 2 and 3 to understand the current editor architecture.

### What to build

1. **Create `js/admin-editor.js`**: Extract all editor‑related code from `js/admin.js` into a new file. The original `js/admin.js` should keep only auth, dashboard, writers, users, analytics, tech — everything NOT editor‑related.

2. **Update `admin/index.html` and `admin/public/index.html`**: Add `<script src="/js/admin-editor.js"></script>` (and any other new module files). Ensure load order is correct (core before editor).

3. **Replace the floating bottom toolbar** with a sticky top toolbar (`<div class="editor-toolbar">`) inside `getArticleEditorHtml()`. Use the exact HTML from the plan (Step 1.2).

4. **Add event delegation** on the toolbar (Step 1.3).

5. **Implement `updateToolbarState()`** with selection‑aware active states (Step 1.8). Listen on `document.addEventListener('selectionchange', ...)` throttled via `requestAnimationFrame`.

6. **Implement all format commands** from Step 1.5: `bold`, `italic`, `underline`, `strikeThrough`, `superscript`, `justifyLeft`, `justifyCenter`, `justifyRight`, `insertUnorderedList`, `insertOrderedList`, `removeFormat`, `createLink`, `unlink`, `code`, `insertImage`, `insertTable`.

7. **Implement `toggleInlineCode()`** (Step 1.6).

8. **Implement `toggleBlockquote()`** (Step 1.7).

9. **Add keyboard shortcuts**: Ctrl+B/I/U, Ctrl+Shift+X, Ctrl+Shift+7/8, Ctrl+Alt+0‑4, Ctrl+K (Step 1.9). Bind to editor's `keydown` event.

10. **Add new toolbar CSS** to `css/admin.css` (Step 1.10).

11. **Remove old floating toolbar CSS** — delete all `.editor-floating-toolbar` rules from `css/admin.css` (Step 1.11).

12. **Update initialization** in the editor setup (Step 1.12).

### Testing for Phase 1

Create `test/tests/toolbar.spec.js` using the exact code from the testing plan (the one that tests all 16 buttons + active states). Run it:

```bash
cd test
npx playwright test toolbar.spec.js
```

All toolbar tests must pass:
- All buttons present ✓
- Style dropdown has all 6 options ✓
- Bold/italic/underline/strikethrough apply correct HTML ✓
- Heading dropdown changes block format ✓
- Alignment center works ✓
- Unordered/ordered lists create correct HTML ✓
- Superscript toggles ✓
- Clear formatting strips inline styles ✓
- Link prompts for URL ✓
- Unlink removes href ✓

Also rerun the smoke test to verify nothing broke:
```bash
npx playwright test smoke.spec.js
```

Run both test suites. Fix any failures before proceeding.

**Commit**: `feat(editor): replace floating toolbar with Google Docs-style sticky top toolbar with active states, keyboard shortcuts, and 17 commands`

---

## PHASE 2: Undo/Redo, Selection, Paste Sanitisation

### Read before starting
Read `docs/editor-overhaul-plan.md` — Phase 2 section (Section 5).

### What to build

1. **Add `undoStack: []` and `redoStack: []` to `articleState`**.

2. **Implement cursor serialization**: `serializeSelection()`, `deserializeSelection()`, `getNodePath()`, `restoreNodePath()` — use the exact code from the plan.

3. **Implement snapshot management**: `pushUndoSnapshot()`, `undo()`, `redo()`, `scheduleUndoSnapshot()`, `takeImmediateUndoSnapshot()`.

4. **Wire up snapshot triggers**:
   - `input` event → `scheduleUndoSnapshot()` (debounced 300ms)
   - `paste` event → `sanitizePastedContent()` then `takeImmediateUndoSnapshot()`
   - After `executeArticleEditorCommand()` → `takeImmediateUndoSnapshot()`
   - After `insertArticleHtmlAtCursor()` → `takeImmediateUndoSnapshot()`
   - After article load → `takeImmediateUndoSnapshot()` (initial snapshot)

5. **Bind Ctrl+Z** → `undo()`, **Ctrl+Y / Ctrl+Shift+Z** → `redo()` in the keyboard shortcut handler (add to existing handler from Phase 1).

6. **Implement `sanitizePastedContent()`**: Walk TreeWalker, strip `style` attributes, `<font>` tags, non‑article CSS classes, empty `<span>` tags.

7. **Reset undo/redo stacks** in `startNewArticle()` and when selecting a different article in `selectArticleFromList()`.

### Testing for Phase 2

Create `test/tests/undo.spec.js` and `test/tests/paste.spec.js`.

For `undo.spec.js`:
- Ctrl+Z undoes text input
- Ctrl+Y redoes undone text
- Undo after format command
- Undo after image insert (use `page.evaluate` to insert)
- Undo stack resets when switching articles
- 10+ undos navigates through history correctly

For `paste.spec.js`:
- Paste stripped HTML via `page.evaluate` with clipboard simulation
- Inline styles removed
- Font tags unwrapped
- Empty spans removed
- Undo after paste works

Run all test suites:
```bash
npx playwright test
```

Fix any failures before proceeding.

**Commit**: `feat(editor): add undo/redo system with snapshot-based HTML+selection storage and paste sanitisation`

---

## PHASE 3: Media — Link Popover, Image Editing, Embeds

### Read before starting
Read `docs/editor-overhaul-plan.md` — Phase 3 section (Section 6).

### What to build

1. **Link editing popover**: When user clicks inside an `<a>` in the editor (not `.article-cta`), show a small popover positioned near the link with: URL input (pre‑filled), [Open], [Change], [Remove] buttons. Click outside to close.

2. **Image click‑to‑edit**: When user clicks on `<figure class="article-media">`:
   - Show 8 resize handles (corners proportionally resize, edges free resize)
   - Show alignment switcher: [Full Width] [Float Left] [Float Right] — updates class
   - Show alt text input below image
   - Make `<figcaption>` editable inline

3. **Embed dialog**: Add a context menu item and a toolbar button "Insert Embed". Show a dialog with URL input. Parse YouTube URLs (`youtube.com/watch?v=`, `youtu.be/`) and Spotify URLs (`open.spotify.com/track/`, `open.spotify.com/album/`). Generate iframe embed wrapped in `<div class="article-embed">`.

### Testing for Phase 3

Create `test/tests/media.spec.js`:
- Click link → popover visible → edit URL → click Change → href updated
- Click Remove in link popover → link removed, text preserved
- Click image → resize handles visible → drag corner handle → dimensions change
- Click alignment button on image → class changes
- Edit alt text → attribute updated
- Insert embed → YouTube URL → iframe appears in editor with correct src

Run all tests and fix failures.

**Commit**: `feat(editor): add link editing popover, image resize handles with alignment switcher, and YouTube/Spotify embed support`

---

## PHASE 4: UX — Word Count, Auto‑Save, Full‑Screen, Find & Replace

### Read before starting
Read `docs/editor-overhaul-plan.md` — Phase 4 section (Section 7).

### What to build

1. **Word count status bar**: Add a `.editor-statusbar` div below the editor canvas showing live word count + character count. Update on `input` debounced 500ms.

2. **Auto‑save**: Add a 3‑second debounced save. Track dirty flag to avoid duplicate saves. Silent save on success (no status message), error message on failure. LocalStorage draft backup per article ID (key: `feats_draft_{id}`). Recovery prompt on article load if a local draft exists.

3. **Full‑screen mode**: Add a button in the editor header. On click: add `.editor-fullscreen` class to admin layout. Hides sidebar, article list toggle, and admin header. Show "Exit fullscreen" button. Esc key exits. Toggle off via button or Esc.

4. **Find & Replace**: Ctrl+F opens a find‑and‑replace bar at the top of the editor. Find input, replace input. [Find next], [Find previous], [Replace], [Replace All], [Done] buttons. Highlight matches with `<mark>` elements (temporary, removed on close). Use TreeWalker for text node search.

### Testing for Phase 4

Create `test/tests/ux.spec.js`:
- Type text → word count updates to expected value
- Delete text → word count decreases
- Type → wait 3s → verify save occurred (intercept PUT request)
- Close without saving → reopen → local draft recovery prompt
- Click full‑screen → editor fills viewport → Esc → returns
- Ctrl+F → find bar visible → type query → matches highlighted → Find Next navigates → Replace works → Replace All works

Create `test/tests/properties.spec.js`:
- Edit slug → fills correctly
- Change status dropdown → updates
- Edit publish date → updates
- Edit categories, tags → updates
- Edit excerpt → updates
- Delete article → confirmation → article removed from list

Run all tests and fix failures.

**Commit**: `feat(editor): add word count, 3s auto-save with localStorage backup, full-screen mode, and Ctrl+F find & replace`

---

## PHASE 5: Tables, Final Polish

### Read before starting
Read `docs/editor-overhaul-plan.md` — Phase 5 section (Section 8).

### What to build

1. **Table insertion**: Click the "Insert Table" button or context menu → show a grid picker (hover to select dimensions, max 8×8, Google Docs style). On click, insert `<table class="article-table">` with `<thead>` and `<tbody>` at cursor position.

2. **Table editing**:
   - Click cell → subtle outline highlight
   - Drag right border of `<th>` or `<td>` → resize column (add `.col-resize-handle` divs)
   - Right‑click on table → context menu: "Insert row above", "Insert row below", "Insert column left", "Insert column right", "Delete row", "Delete column", "Delete table"
   - Tab → move to next cell; Shift+Tab → previous cell
   - Standard text editing within cells (formatting works inside cells)

3. **Add table CSS to `css/admin.css`** (from the plan, Step 8.2).

4. **Add table CSS to `css/article.css`** for frontend rendering.

5. **"Copy as Markdown" button**: Add a button in the properties panel that copies the article body as Markdown (using the existing `articleHtmlToMarkdown()` converter).

6. **Keyboard shortcut help overlay**: Add a "?" button in the editor header or bind Ctrl+/ to show a modal listing all keyboard shortcuts.

### Testing for Phase 5

Create `test/tests/tables.spec.js`:
- Click Insert Table → grid picker visible → hover 3×3 → table inserted
- Click cell → type text → text appears in cell
- Drag column border → column width changes
- Right‑click table → context menu → insert row → row count increases
- Tab in last cell → new row? (test Tab navigation)
- Save → reload → table persists
- Frontend: table renders correctly (verify CSS selects `.article-table`)

Run ALL test suites:
```bash
npx playwright test
```

Fix any failures.

**Commit**: `feat(editor): add table insertion with grid picker, column resize, row/column management, and Tab navigation`

---

## FINAL VERIFICATION

After all 5 phases are complete and all 11 test suites pass:

### Manual verification checks (automated where possible):
1. Smoke test: Admin loads, articles CRUD, dark mode
2. Toolbar: Every button works, active states correct
3. Keyboard shortcuts: Ctrl+B/I/U/K/Z/Y/Shift+X/Shift+7/Shift+8/Alt+0‑4
4. Link popover: Edit, remove, open links
5. Image editing: Resize, alignment, alt text, caption
6. Undo/redo: 20+ actions, cursor position restoration
7. Paste: Copy from Google Docs, Word, plain text — styles stripped
8. Word count accuracy
9. Auto‑save: Change, wait 3s, reload, content persisted
10. Full‑screen: Enter, type, exit, content preserved
11. Find & Replace: Find, navigate, replace one, replace all
12. Markdown mode: Switch, edit, switch back, content preserved
13. All custom blocks: Carousel, pull quote, callout, spacer, divider, CTA
14. Tables: Create, edit, resize, save, reload, frontend rendering
15. Article CRUD: Create, edit, delete

### If ALL tests pass:
```bash
git status  # Ensure nothing uncommitted
git push origin feature/feats-editor
```

### If GitHub Pages needs gh-pages:
```bash
git checkout feature/feats-editor
git checkout -b gh-pages
git push -u origin gh-pages
```

Then go to https://github.com/LouisHitchcock/feats-live/settings/pages and set the source branch to `gh-pages` / `/ (root)`.

**Final commit**: `chore: finalise Google Docs-style editor overhaul — all 5 phases complete`

---

## CONTINUATION PROMPTS

If the conversation gets cut off or you need to continue in a new session, use these:

### After Phase 1:
```
CONTINUATION CONTEXT:
Phase 1 (toolbar restructure + core formatting + keyboard shortcuts) is COMPLETE.
Toolbar tests pass. All smoke tests pass.
NEXT: Phase 2 — Undo/Redo System, Paste Sanitisation.
Read docs/editor-overhaul-plan.md Section 5 before starting.
Current branch: feature/feats-editor
```

### After Phase 2:
```
CONTINUATION CONTEXT:
Phases 1-2 COMPLETE. Toolbar, undo/redo, paste sanitisation all working.
All tests pass.
NEXT: Phase 3 — Link Popover, Image Click-to-Edit, Embed Support.
Read docs/editor-overhaul-plan.md Section 6 before starting.
Current branch: feature/feats-editor
```

### After Phase 3:
```
CONTINUATION CONTEXT:
Phases 1-3 COMPLETE. Toolbar, undo/redo, paste, link popover, image editing, embeds.
All tests pass.
NEXT: Phase 4 — Word Count, Auto-Save, Full-Screen, Find & Replace.
Read docs/editor-overhaul-plan.md Section 7 before starting.
Current branch: feature/feats-editor
```

### After Phase 4:
```
CONTINUATION CONTEXT:
Phases 1-4 COMPLETE. Toolbar, undo/redo, paste, media, word count, auto-save, full-screen, find/replace.
All tests pass.
NEXT: Phase 5 — Tables, Copy as Markdown, Keyboard Shortcut Help, Final Polish.
Read docs/editor-overhaul-plan.md Section 8 before starting.
Current branch: feature/feats-editor
```

---

## APPENDIX: Key Files Reference

| File | Purpose |
|---|---|
| `docs/editor-overhaul-plan.md` | **Primary reference** — 5-phase plan with exact code, CSS, test checklists |
| `docs/automated-ui-testing-plan.md` | Test infrastructure — all source files for Playwright test suite |
| `docs/feats-editor-audit.md` | Reference — current editor architecture, features, gaps |
| `docs/google-docs-feature-analysis.md` | Reference — Google Docs feature list, comparison |
| `js/admin.js` | ~1800 lines — all admin logic (will be split into modules) |
| `css/admin.css` | ~700 lines — all admin styles (will be updated) |
| `css/article.css` | ~120 lines — article body rendering (will have `.article-table` added) |
| `admin/index.html` | Admin portal HTML (will load new script files) |
| `admin/public/index.html` | Duplicate of above |
