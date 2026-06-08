# Feats. Article Editor — Comprehensive Audit

## 1. Overview

The Feats. admin portal (`/admin`) includes a **contenteditable‑based rich text editor** for writing and formatting music articles/reviews. It is a single‑page web application, implemented entirely in vanilla JavaScript (`js/admin.js` ~1800 lines), with no framework, no plugins, no external rich‑text library. It lives alongside the admin dashboard, writer management, analytics, and technical pages.

---

## 2. Architecture & How It Works

### 2.1 Stack
- **Renderer**: `contenteditable` on a `<div>` (`id="articleBodyEditor"`)
- **Formatting**: `document.execCommand()` calls (bold, italic, underline, headings, lists, links, removeFormat)
- **Persistence**: HTML body is stored as a string in a JSON field via REST API (POST/PUT to `/admin/articles/{id}`)
- **Markdown mode**: Custom bidirectional converter (HTML ↔ Markdown) written entirely by hand (~500 lines)
- **Storage**: Articles saved via Cloudflare Workers backend → D1 database, body stored as HTML string
- **Frontend rendering**: Articles are rendered client‑side via `innerHTML` in `music.js`, with carousel JS hydration on page load

### 2.2 Data Flow
1. **Load**: GET `/admin/articles` → list → select → GET `/admin/articles/{id}` → `articleState.current.body` set to raw HTML → injected into `editor-canvas` via `innerHTML`
2. **Edit**: User types / clicks toolbar → `execCommand` modifies DOM → `captureCurrentArticleDraft()` reads `editor.innerHTML` back into state
3. **Save**: `buildArticlePayload()` → JSON PUT/POST → server stores HTML as-is
4. **Render (frontend)**: SPA fetches article by slug → inserts `body` HTML into `<article class="article-body">` → calls `initArticleCarousels()` to wire up carousel nav

### 2.3 Editor Mode Toggle
- **Rich Text mode** (default): `contenteditable="true"`, floating toolbar visible
- **Markdown mode**: `<textarea>` shown, toolbar hidden, editor canvas hidden. User writes Markdown → `markdownToArticleHtml()` converts to HTML on the fly → rich text preview updates silently
- Switching modes converts the current content bidirectionally via `articleHtmlToMarkdown()` and `markdownToArticleHtml()`

---

## 3. Included Features (Detailed)

### 3.1 Text Formatting (Toolbar)
| Feature | Implementation |
|---|---|
| **Bold** | `execCommand('bold')` — produces `<strong>` |
| **Italic** | `execCommand('italic')` — produces `<em>` |
| **Underline** | `execCommand('underline')` — produces `<u>` |
| **Remove formatting** | `execCommand('removeFormat')` — strips inline styles |
| **H2 heading** | `execCommand('formatBlock', 'H2')` |
| **Unordered list** | `execCommand('insertUnorderedList')` — `<ul>/<li>` |
| **Ordered list** | `execCommand('insertOrderedList')` — `<ol>/<li>` |
| **Link insertion** | `prompt()` for URL → `execCommand('createLink')` |
| **Code block** | `execCommand('formatBlock', 'pre')` — `<pre>` block |

### 3.2 Image / Media Insertion
- **Upload**: Drag‑and‑drop zone or file picker → `FileReader.readAsArrayBuffer()` → PUT to `/images/{key}` on R2 → returns public URL
- **Layout options**: Full width, float left, float right, carousel
- **Caption**: Optional `<figcaption>`
- **Recent uploads**: `articleState.recentImages` array (max 20) shown as thumbnails for quick re‑insertion
- **Queue**: Multiple images can be queued before inserting
- **Generated HTML**: `<figure class="article-media article-media--full|--float-left|--float-right"><img ...><figcaption>...</figcaption></figure>`

### 3.3 Carousels
- **Creation**: Built from multiple uploaded images → `buildArticleCarouselHtml()` generates a `<div class="article-carousel">` with nav buttons and thumbnail strip
- **Carousel markup**: Slides as `<div class="carousel-slide">`, thumbnails as `<button class="carousel-thumb">`, prev/next buttons
- **Client‑side hydration**: `initArticleCarousels()` in `music.js` finds all `[data-article-carousel]` elements, binds click handlers for nav buttons and thumbnails
- **Unique IDs**: Carousel IDs generated from `Date.now() + seed` to avoid collisions

### 3.4 Context Menu (Right‑Click)
- **Trigger**: Right‑click on editor canvas → `contextmenu` event → `openArticleContextMenu(clientX, clientY)`
- **Options**:
  - Insert Divider Line (`<hr class="article-divider">`)
  - Insert Image (opens image panel)
  - Insert Carousel (opens image panel with carousel layout pre‑selected)
  - Insert Pull Quote (`<blockquote class="article-pullquote">`)
  - Insert Callout Box (`<aside class="article-callout">`)
  - Insert Small/Medium/Large Spacer (`<div class="article-spacer article-spacer--sm|md|lg">`)
  - Insert CTA Button (`<a class="article-cta" href="...">` — prompts for text + URL)
- **Positioning**: Menu intelligently repositions to stay within viewport
- **Dismissal**: Click outside, Escape key, scroll, window resize

### 3.5 Article Properties Panel
- **Slug (URL ID)**: Text input
- **Status**: Published / Draft dropdown
- **Publish Date**: `<input type="datetime-local">`
- **Writer(s)**: Multi‑select from registered writers, syncs to comma‑separated author field
- **Author (stored)**: Comma‑separated text field
- **Tags**: Comma‑separated free text
- **Categories**: Comma‑separated free text
- **Excerpt**: `<textarea>` for short summary / meta description
- **Delete**: Red delete button (shown for existing articles)

### 3.6 Markdown ↔ HTML Conversion
- **HTML→Markdown**: `articleHtmlToMarkdown()` — recursive node walker that handles:
  - Bold/italic (`**` / `*`)
  - Strikethrough (`~~`)
  - Inline code (backticks)
  - Links `[text](url)`
  - Images `![alt](src)`
  - Headings (`# ` through `###### `)
  - Lists (ordered and unordered, nested)
  - Blockquotes (`>`)
  - Code fences (\`\`\`)
  - Horizontal rules (`---`)
  - Custom block elements preserved as raw HTML
- **Markdown→HTML**: `markdownToArticleHtml()` — line‑by‑line parser covering the same features plus raw HTML passthrough

### 3.7 Selection Management
- `saveEditorSelection()` / `restoreEditorSelection()` — saves and restores the cursor/range in the editor
- Used to ensure formatting commands and insertions happen at the correct cursor position
- Falls back to `caretRangeFromPoint` / `caretPositionFromPoint` for context menu positioning

### 3.8 Article List Management
- **List panel**: Left sidebar showing all articles
- **Search**: Filter by title, slug, or writer (case‑insensitive)
- **Selection**: Click to load → selects in list → fetches full article
- **New article button**: Creates blank draft, auto‑generates current datetime
- **Hide/Show selector**: Toggle to collapse the list panel for more editor space
- **Auto‑refresh**: After save, list refreshes from API and selects the saved/new article

### 3.9 Save State
- Status bar below header showing: "Saving..." / "Article saved" (green) / error message (red)
- Validates title and slug before saving

### 3.10 Image Upload Pipeline
- `uploadImage(file)` → reads as ArrayBuffer → PUT to Cloudflare R2 via signed endpoint → returns full public URL
- Uploaded images added to `articleState.recentImages` for quick reuse
- Queued images show thumbnails with remove button

---

## 4. Output HTML Classes / Rendering Convention

The editor produces HTML that the frontend (`css/article.css` + `music.js`) renders as article content:

```html
<figure class="article-media article-media--full|--float-left|--float-right">
  <img src="...">
  <figcaption>...</figcaption>
</figure>

<hr class="article-divider">

<blockquote class="article-pullquote">
  <p>Quote text...</p>
</blockquote>

<aside class="article-callout">
  <p>Note content...</p>
</aside>

<a class="article-cta" href="..." target="_blank" rel="noopener">Button</a>

<div class="article-spacer article-spacer--sm|md|lg"></div>
```

---

## 5. Code Organisation

| File | Lines | Responsibility |
|---|---|---|
| `js/admin.js` | ~1800 | Entire editor, auth, dashboard, writers, users, analytics, tech pages — all in one file |
| `css/admin.css` | ~700 | All admin UI styling incl. editor, toolbar, image panel, context menu, dark mode |
| `css/article.css` | ~120 | Frontend article body rendering styles (figures, carousels, pullquotes, etc.) |
| `js/music.js` | ~350 | Frontend SPA — article listing, article rendering, carousel hydration |

---

## 6. Notable Strengths

- **Zero dependencies**: No jQuery, no TinyMCE/Quill/ProseMirror, no React. Entirely vanilla.
- **Markdown round‑trip**: Bidirectional conversion means users can switch between rich text and Markdown at any time without data loss.
- **Custom blocks**: Pull quotes, callouts, spacers, CTAs, dividers — all custom semantic blocks that go beyond basic formatting.
- **Carousels**: Full gallery with prev/next navigation and thumbnail strip, unique per‑instance IDs.
- **Drag‑and‑drop image upload**: Modern UX with previews and queuing.
- **Recent images**: Frequently used images accessible without re‑uploading.
- **Context menu**: Right‑click access to all block insertions — power‑user workflow.
- **Dark mode**: Full dark theme for the admin panel.
- **Responsive editor layout**: Article list hides on smaller screens, still functional.

---

## 7. Identified Gaps & Weaknesses

### 7.1 Formatting Limitations
| Missing | Impact |
|---|---|
| **Font size / color picker** | No way to change font size or text colour beyond defaults |
| **Text alignment** | No left/center/right/justify alignment controls |
| **H1 / H3–H6 headings** | Only H2 available in toolbar (H1–H6 supported in Markdown mode) |
| **Superscript / subscript** | Not available |
| **Blockquote (standard)** | No toolbar button for standard `<blockquote>` (only pull quote via context menu) |
| **Tables** | No table insertion whatsoever |
| **Horizontal rule** | Only via context menu, no toolbar button |
| **Inline code** | Only via Markdown mode backticks, no toolbar button |
| **Strikethrough** | Only via Markdown mode `~~`, no toolbar button |
| **Undo/Redo** | Relies entirely on browser native undo stack — broken after `insertHTML` commands |
| **Keyboard shortcuts** | No custom shortcuts |

### 7.2 Structural / UX Gaps
| Missing | Impact |
|---|---|
| **Image resize / alignment after insertion** | No way to change layout or size of an already‑inserted image; must delete and re‑insert |
| **Image alt text editing** | Alt text only set at insertion time; no way to edit later |
| **Image caption editing** | Caption set at insertion; no in‑place editing |
| **Link editing** | No way to edit or remove a link after creation (no toolbar button to unlink) |
| **Full‑screen mode** | Editor is constrained to its panel; no distraction‑free writing mode |
| **Word / character count** | Not shown anywhere |
| **Auto‑save** | No periodic or on‑blur auto‑save; user must click Save |
| **Version history** | No undo history beyond browser native (which breaks); no server‑side revision tracking |
| **Collaboration** | Single‑user; no real‑time or async multi‑user editing |
| **Comments / annotations** | No inline commenting or review workflow |
| **Spell check** | Relies on browser built‑in spellcheck; no custom dictionary |
| **Paste handling** | No paste sanitisation — pasting from Word/Google Docs brings inline styles |
| **Mobile editor** | Toolbar is fixed at bottom of screen but not optimised for touch |
| **Keyboard navigation** | No Tab support for indentation in lists; no arrow key custom handling |

### 7.3 Technical / Code Quality Issues
| Issue | Details |
|---|---|
| **Single monolithic file** | `js/admin.js` contains ~1800 lines with auth, dashboard, articles, writers, users, analytics, tech, and editor all in one global scope |
| **Global state** | `articleState` and all functions are global (no closures, no module pattern) |
| **`document.execCommand()` deprecation** | `execCommand` is officially deprecated by all major browsers. It still works but is on the path to removal |
| **No error boundaries** | Any JS error in the editor can break the entire tab; no try/catch around critical operations |
| **No input sanitisation** | User HTML is stored as‑is and rendered via `innerHTML` → XSS risk |
| **No content security policy** | No CSP headers; inline event handlers are used throughout |
| **No image optimisation** | Uploaded images are stored in original resolution; no resizing, no WebP conversion |
| **Markdown converter is custom and limited** | No GFM (tables, task lists, footnotes), no syntax highlighting for code blocks |

---

## 8. Summary

**What it has**: A functional, dependency‑free rich text editor with Markdown support, custom semantic blocks, image upload to R2, carousel creation, drag‑and‑drop, recent image history, right‑click context menu, and dark mode — built in vanilla JS.

**What it lacks**: Tables, text alignment, font sizing/colour, inline code/strikethrough toolbar buttons, undo/redo, auto‑save, version history, collaboration, paste sanitisation, image editing (resize/alt/caption), link management, spell check, full‑screen mode, keyboard shortcuts, and code quality structure.
