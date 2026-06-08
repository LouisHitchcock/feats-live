# Feats. Editor → Google Docs‑Style Overhaul: Technical Master Plan

## Table of Contents
1. [Project Goals](#goals)
2. [Architectural Decision](#architecture)
3. [Phases Overview](#phases)
4. [Phase 1: Toolbar Restructure & Core Formatting](#phase1)
5. [Phase 2: Editor Reliability — Undo, Selection, Sanitisation](#phase2)
6. [Phase 3: Media & Rich Content](#phase3)
7. [Phase 4: UX & Polish](#phase4)
8. [Phase 5: Tables, Embeds, and Polish](#phase5)
9. [Testing Strategy](#testing)
10. [Continuation Prompts](#prompts)

---

<a name="goals"></a>
## 1. Project Goals

### Primary Goal
Transform the Feats. admin article editor into an experience that feels as familiar and capable as Google Docs to its users, while retaining purpose‑built features for music journalism (carousels, pull quotes, callouts, CTAs, spacers, image floats, R2 upload).

### Non‑Goals
- **Real‑time collaboration** — Too complex; Feats is single‑writer per article
- **Page layout** (headers/footers, margins, page breaks) — Articles are web pages
- **Custom fonts/sizes/colours** — Consistent design system enforced by `article.css`
- **Export to DOCX/PDF** — Not needed
- **Server‑side revision history** — Client‑side undo history instead
- **Add‑ons / Extensions / Scripting** — Overkill

### What "Google Docs‑Like" Means for Feats
1. **Toolbar**: Compact, familiar icon‑based toolbar at the top, groups with separators, active‑state highlighting
2. **Selection‑aware toolbar**: Toolbar updates to show active formatting state
3. **Keyboard shortcuts**: Ctrl+B/I/U, Ctrl+K, Ctrl+Shift+X, Ctrl+Alt+0‑4 for headings, Ctrl+Shift+7/8 for lists, Ctrl+Z/Y
4. **Font‑style picker**: Dropdown for Normal / H1 / H2 / H3 / H4 + Quote
5. **Undo/Redo**: Reliable custom undo stack that survives `insertHTML` operations
6. **Contextual link editing**: Click a link → popover to edit/remove/visit
7. **Image click to edit**: Click image → resize handles, alignment controls, alt text editor
8. **Word count**: Live word/character count in status bar
9. **Find & Replace**: Ctrl+F overlay similar to Docs
10. **Distraction‑free mode**: Full‑screen editor with minimal chrome

---

<a name="architecture"></a>
## 2. Architectural Decision: Keep Vanilla JS, No Framework

### Why NOT migrate to ProseMirror / Quill / TipTap / TinyMCE?
1. **Custom blocks** (carousels, pull quotes, callouts, CTAs, spacers) — no off‑the‑shelf editor supports these natively
2. **Markdown round‑trip** — custom 500‑line converter already works; replacing risks data loss
3. **R2 upload pipeline** — tightly coupled to our image insert UI
4. **Zero dependency footprint** — ~25KB. Any library adds 50–300KB+
5. **Full control over HTML output** — exact classes (`article-media`, `article-pullquote`) critical for frontend

### What we WILL improve
- **Module separation**: Split `js/admin.js` into 6 files
  - `js/admin-auth.js` — Auth, login, token management
  - `js/admin-core.js` — API helpers, modal, utilities, esc
  - `js/admin-editor.js` — All editor logic
  - `js/admin-properties.js` — Properties panel
  - `js/admin-dashboard.js` — Dashboard, writers, users, analytics, tech
  - `js/admin-init.js` — DOMContentLoaded bootstrap, tab routing
- **Shared state** on `window.Feats` namespace

---

<a name="phases"></a>
## 3. Phases Overview

| Phase | Focus | Files Changed |
|---|---|---|
| **Phase 1** | Toolbar restructure + core formatting | `js/admin-editor.js`, `css/admin.css` |
| **Phase 2** | Undo/redo, selection, paste sanitisation | `js/admin-editor.js` |
| **Phase 3** | Media: image editing, link popover, embeds | `js/admin-editor.js`, `css/admin.css` |
| **Phase 4** | UX: auto‑save, word count, full‑screen, find/replace | `js/admin-editor.js`, `css/admin.css` |
| **Phase 5** | Tables, embed support, polish | `js/admin-editor.js`, `css/admin.css`, `css/article.css` |

---

<a name="phase1"></a>
## 4. Phase 1: Toolbar Restructure & Core Formatting

### Goal
Replace floating bottom toolbar with a sticky top toolbar like Google Docs. Add missing formatting commands. Toolbar must be selection‑aware.

### Target Layout
```
┌────────────────────────────────────────────────────────────────────┐
│ [Format ▼] [B] [I] [U] [~~S~~] | [   ] [   ] [   ] | [🔗] [⌧] | [•] [1.] [""] [X²] | [🖼] [📁] │
└────────────────────────────────────────────────────────────────────┘
```

### Button Groups
| Group | Buttons | Commands |
|---|---|---|
| **Style** | Normal / H1 / H2 / H3 / H4 / Quote dropdown | `formatBlock` + custom blockquote |
| **Inline** | B, I, U, S (strikethrough), `<code>` | `execCommand` + custom inline code |
| **Align** | Left, Center, Right | `justifyLeft`, `justifyCenter`, `justifyRight` |
| **Insert** | Link, Clear Format | `createLink` / `unlink`, `removeFormat` |
| **Lists** | UL, OL, Blockquote | `insertUnorderedList`, `insertOrderedList`, custom blockquote |
| **Special** | Superscript | `superscript` toggle |
| **Media** | Image, Table | Opens image panel, opens table dialog |

### Implementation Steps

**Step 1.1** — Create `js/admin-editor.js`, extract all editor code from `js/admin.js`

**Step 1.2** — Rewrite `getArticleEditorHtml()` with new toolbar HTML:
```html
<div class="editor-toolbar">
  <div class="toolbar-group">
    <select class="toolbar-style-dropdown" id="editorStyleDropdown">
      <option value="p">Normal text</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="blockquote">Quote</option>
    </select>
  </div>
  <span class="toolbar-sep"></span>
  <div class="toolbar-group">
    <button data-command="bold" title="Bold (Ctrl+B)"><b>B</b></button>
    <button data-command="italic" title="Italic (Ctrl+I)"><i>I</i></button>
    <button data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>
    <button data-command="strikeThrough" title="Strikethrough"><s>S</s></button>
    <button data-command="code" title="Inline code">&lt;/&gt;</button>
  </div>
  <span class="toolbar-sep"></span>
  <div class="toolbar-group">
    <button data-command="justifyLeft" title="Align left">≡</button>
    <button data-command="justifyCenter" title="Align center">≡</button>
    <button data-command="justifyRight" title="Align right">≡</button>
  </div>
  <span class="toolbar-sep"></span>
  <div class="toolbar-group">
    <button data-command="createLink" title="Insert link">🔗</button>
    <button data-command="unlink" title="Remove link">🔓</button>
    <button data-command="removeFormat" title="Clear formatting">⌧</button>
  </div>
  <span class="toolbar-sep"></span>
  <div class="toolbar-group">
    <button data-command="insertUnorderedList" title="Bullet list">•</button>
    <button data-command="insertOrderedList" title="Numbered list">1.</button>
    <button data-command="blockquote" title="Quote">❝</button>
  </div>
  <span class="toolbar-sep"></span>
  <div class="toolbar-group">
    <button data-command="superscript" title="Superscript">x²</button>
  </div>
  <span class="toolbar-sep"></span>
  <div class="toolbar-group">
    <button data-command="insertImage" title="Insert image">🖼</button>
    <button data-command="insertTable" title="Insert table">⊞</button>
  </div>
</div>
```

**Step 1.3** — Add toolbar event delegation (click handler on parent, `e.target.closest('[data-command]')`)

**Step 1.4** — Implement selection‑aware active states via `selectionchange` + `updateToolbarState()`

**Step 1.5** — Implement format commands:
```js
var FORMAT_COMMANDS = {
  bold: function() { executeArticleEditorCommand('bold'); },
  italic: function() { executeArticleEditorCommand('italic'); },
  underline: function() { executeArticleEditorCommand('underline'); },
  strikeThrough: function() { executeArticleEditorCommand('strikeThrough'); },
  superscript: function() { executeArticleEditorCommand('superscript'); },
  justifyLeft: function() { executeArticleEditorCommand('justifyLeft'); },
  justifyCenter: function() { executeArticleEditorCommand('justifyCenter'); },
  justifyRight: function() { executeArticleEditorCommand('justifyRight'); },
  insertUnorderedList: function() { executeArticleEditorCommand('insertUnorderedList'); },
  insertOrderedList: function() { executeArticleEditorCommand('insertOrderedList'); },
  removeFormat: function() { executeArticleEditorCommand('removeFormat'); },
  createLink: function() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      var url = prompt('Enter URL', 'https://');
      if (url) executeArticleEditorCommand('createLink', url.trim());
    } else {
      alert('Select text first to create a link.');
    }
  },
  unlink: function() { executeArticleEditorCommand('unlink'); },
  code: function() { toggleInlineCode(); },
  insertImage: function() { toggleArticleImagePanel(true); },
  insertTable: function() { alert('Table insertion coming soon.'); }
};
```

**Step 1.6** — Implement `toggleInlineCode()`: wraps selection in `<code>` or unwraps if already inside inline `<code>` (not `<pre>`)

**Step 1.7** — Implement `toggleBlockquote()`: wraps/unwraps current paragraph in `<blockquote>`, skips `.article-pullquote`

**Step 1.8** — Implement `updateToolbarState()`: walks DOM from cursor to detect bold/italic/underline/strikethrough/superscript/code/alignment/list/blockquote/heading; toggles `.active` classes and style dropdown value

**Step 1.9** — Keyboard shortcuts: Ctrl+B/I/U/K/Z/Y/Shift+X/Shift+7/Shift+8/Alt+0‑4

**Step 1.10** — New toolbar CSS (sticky top, flex groups, separators, dark mode)

**Step 1.11** — Remove old `.editor-floating-toolbar` CSS

---

<a name="phase2"></a>
## 5. Phase 2: Undo/Redo, Selection, Paste Sanitisation

### Undo/Redo System Design
- **Snapshot‑based**: Store `{ html, cursor }` pairs in two stacks (max 100)
- **Snapshots taken**: input debounce (300ms), format commands, paste, image/block insert
- **Cursor serialization**: child‑index path relative to editor root
- **Ctrl+Z**: pop from undoStack, push current to redoStack, restore snapshot
- **Ctrl+Y / Ctrl+Shift+Z**: pop from redoStack, push current to undoStack, restore snapshot

### Key Functions
- `serializeSelection(editor)` → `{ startContainer: [indexes], startOffset, endContainer, endOffset }`
- `deserializeSelection(data, editor)` → restores Range
- `pushUndoSnapshot()` → takes immediate snapshot (deduplicates by HTML)
- `scheduleUndoSnapshot()` → debounced 300ms timer
- `takeImmediateUndoSnapshot()` → clears timer, takes snapshot now
- `undo()` / `redo()` → restore + update state + toolbar

### Paste Sanitisation
`sanitizePastedContent(editor)` walks TreeWalker, strips:
- `style` attributes
- `<font>` tags
- Non‑article CSS classes (keeps `article-*`, `carousel-*`)
- Empty `<span>` tags

### State
Add `undoStack: []` and `redoStack: []` to `articleState`. Reset on article navigation.

---

<a name="phase3"></a>
## 6. Phase 3: Media & Rich Content

### Link Editing Popover
On click inside editor `<a>` (not `.article-cta`):
- Show popover with pre‑filled URL input, [Open] [Change] [Remove] buttons
- Change → update `href`
- Remove → unwrap `<a>`, keep text
- Open → `window.open`
- Click outside → close

### Image Click‑to‑Edit
On click on `<figure class="article-media">`:
1. Show 8 resize handles (corners proportional, edges free)
2. Show alignment switcher [Full] [Left] [Right] — updates class
3. Show alt text input below image
4. Allow inline caption editing (click `<figcaption>` to edit)

### Embed Support
- Context menu + toolbar button: "Insert Embed"
- Parse YouTube/Spotify URLs, generate `<div class="article-embed"><iframe ...></div>`

---

<a name="phase4"></a>
## 7. Phase 4: UX & Polish

### Word Count
Status bar below editor: "1,247 words | 7,842 characters". Updates on `input` debounced 500ms.

### Auto‑Save
- 3‑second debounce after any change
- Dirty flag prevents duplicate saves
- Manual save overrides auto‑save
- LocalStorage draft backup per article ID
- Recovery prompt on article load

### Full‑Screen Mode
- Button in editor header → expands to fill viewport
- Hides sidebar, list, admin chrome
- Esc or exit button to return
- CSS: `.admin-layout.editor-fullscreen` toggles

### Find & Replace
- Ctrl+F opens bar with find + replace inputs
- [Find next] [Find previous] [Replace] [Replace All] [Done]
- Highlights matches with `<mark>` (temporary)
- TreeWalker for text node search

---

<a name="phase5"></a>
## 8. Phase 5: Tables, Embeds, and Polish

### Table Insertion
- Grid picker in toolbar (hover to select, max 8×8)
- Inserts `<table class="article-table">` with `<thead>/<tbody>`

### Table Editing
- Click cell → subtle outline
- Drag column border to resize
- Right‑click context menu: insert/delete row/column, delete table
- Tab/Shift+Tab navigation between cells

### Table CSS (admin.css + article.css)
```css
.article-table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
.article-table th, .article-table td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; min-width: 60px; font-size: 0.85rem; position: relative; }
.article-table th { background: #f5f5f5; font-weight: 700; }
.article-table .col-resize-handle { position: absolute; right: -3px; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 1; }
```

### Final Polish
- "Copy as Markdown" button in properties
- Keyboard shortcut help overlay (Ctrl+/)
- Enhanced context menu (Edit Link, Edit Image)

---

<a name="testing"></a>
## 9. Testing Strategy

### Smoke Test (After Every Phase)
1. Login → Articles → editor loads
2. Type → content changes
3. Save → reload → content persists
4. Frontend renders correctly
5. Markdown round‑trip
6. Dark mode toggle

### Regression Test
1. CRUD: create, edit, delete articles
2. Custom blocks: carousel, pull quote, callout, spacer, divider, CTA
3. Properties panel: all fields persist
4. Image upload pipeline

---

<a name="prompts"></a>
## 10. Continuation Prompts (for AI overnight development)

### After Phase 1
```
CONTINUATION CONTEXT:
Phase 1 (toolbar restructure + core formatting + keyboard shortcuts) is COMPLETE.
New toolbar at top with style dropdown, format buttons, alignment, lists, link/unlink.
Keyboard shortcuts bound. Toolbar active-state tracking works via selectionchange.
Files changed: js/admin-editor.js, css/admin.css, admin/index.html.

NEXT TASK — Phase 2: Undo/Redo System, Paste Sanitisation
Implement:
1. Custom undo/redo stack (HTML snapshots + cursor serialization, max 100)
2. Snapshots on input debounce (300ms), format commands, paste, image insert
3. Ctrl+Z/Y for undo/redo
4. Paste sanitisation: strip inline styles, font tags, empty spans
5. Reset undo stack on article navigation

Start by reading js/admin-editor.js and css/admin.css.
```

### After Phase 2
```
CONTINUATION CONTEXT:
Phases 1–2 COMPLETE: toolbar, undo/redo, paste sanitisation.

NEXT TASK — Phase 3: Media — Link Popover, Image Click-to-Edit, Embeds
Implement link editing popover, image resize handles + alignment switcher + alt text,
and YouTube/Spotify embed dialog.

Start by reading js/admin-editor.js and css/admin.css.
```

### After Phase 3
```
CONTINUATION CONTEXT:
Phases 1–3 COMPLETE: toolbar, undo/redo, paste, media editing, embeds.

NEXT TASK — Phase 4: UX — Word Count, Auto-Save, Full-Screen, Find & Replace
Implement live word count, 3s auto‑save + localStorage backup, full‑screen mode,
and Ctrl+F find‑and‑replace with highlighting.

Start by reading js/admin-editor.js and css/admin.css.
```

### After Phase 4
```
CONTINUATION CONTEXT:
Phases 1–4 COMPLETE: toolbar, undo/redo, paste, media, word count, auto‑save, full‑screen, find/replace.

NEXT TASK — Phase 5: Tables, Final Polish
Implement table grid picker (max 8×8), cell editing, column resize, row/column add/delete,
Tab navigation, Copy as Markdown button, keyboard shortcut overlay.

Start by reading js/admin-editor.js, css/admin.css, css/article.css.
```

### Final Verification
```
All 5 phases COMPLETE. Run full test verification:
- Every toolbar button + active state
- All keyboard shortcuts
- Link popover, image editing
- Undo/redo (20+ actions)
- Paste sanitisation
- Word count accuracy
- Auto‑save verification
- Full‑screen toggle
- Find & replace
- Table creation, editing, frontend rendering
- Markdown round‑trip
- Dark mode
- Article CRUD
- All custom blocks (carousel, pull quote, callout, spacer, divider, CTA)

Fix any issues found.
```

---

## Appendix A: File Structure After Overhaul

```
feats-live/
├── admin/
│   ├── index.html          (updated: loads js/admin-core.js, js/admin-editor.js, etc.)
│   └── public/
│       └── index.html      (same)
├── js/
│   ├── admin-auth.js       (NEW)
│   ├── admin-core.js       (NEW)
│   ├── admin-editor.js     (NEW: all editor logic)
│   ├── admin-properties.js (NEW)
│   ├── admin-dashboard.js  (NEW)
│   ├── admin-init.js       (NEW: bootstrap, tab routing)
│   ├── music.js            (unchanged)
│   ├── carousel.js         (unchanged)
│   └── home.js             (unchanged)
├── css/
│   ├── admin.css           (updated)
│   ├── article.css         (updated: .article-table styles)
│   └── style.css           (unchanged)
└── music/
    └── *.html              (unchanged)
```

## Appendix B: Known Risks

| Risk | Mitigation |
|---|---|
| `execCommand` browser inconsistency | Test Chrome/FF/Edge; Chrome is primary target |
| Undo stack memory (~2MB) | Limit to 100 snapshots |
| Image resize handles + carousels | Only apply to `.article-media`, not inside carousels |
| Markdown converter breaks with new HTML | Add table/superscript to both converters |
| Auto‑save conflicts with manual save | Dirty flag + cancel timer on manual save |
| Cursor deserialization path breaks | Fallback: place cursor at start of editor |
