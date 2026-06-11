// ===== ARTICLE STATE =====
var articleState = {
  list: [],
  filtered: [],
  writers: [],
  current: null,
  selectedId: null,
  panel: 'editor',
  listCollapsed: false,
  savedRange: null,
  recentImages: [],
  carouselSeed: 0,
  editorMode: 'rich',
  markdownDraft: '',
  undoStack: [],
  redoStack: []
};

function escAttr(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function normalizeArticle(a) {
  return {
    id: a.id || null,
    title: a.title || '',
    url_id: a.url_id || '',
    author: a.author || '',
    excerpt: a.excerpt || '',
    body: a.body || '',
    categories: a.categories || '',
    tags: a.tags || '',
    publish_date: (a.publish_date || '').slice(0,16),
    status: a.status || 'draft'
  };
}

function splitWriters(author) {
  return String(author || '').split(',').map(function(w) { return w.trim(); }).filter(Boolean);
}

function nowAsLocalDateTime() {
  var now = new Date();
  var tz = now.getTimezoneOffset() * 60000;
  return new Date(now - tz).toISOString().slice(0,16);
}

function loadArticles() {
  var main = document.getElementById('mainContent');
main.innerHTML = '<h1>Articles</h1><div class="article-workspace" id="articleWorkspace"><section class="article-list-panel"><div class="article-list-header"><div class="article-list-tools"><input id="articleSearchInput" class="article-search" placeholder="Search titles, slugs, or writers" oninput="filterArticleList(this.value)"><button class="btn btn-primary" onclick="startNewArticle()">+ New Article</button></div></div><div class="article-list" id="articleList"></div></section><section class="article-editor-panel"><div class="article-editor-header"><div><div class="article-editor-title" id="articleEditorTitle">Loading articles...</div><div class="article-editor-subtitle" id="articleEditorSubtitle"></div></div><div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap"><button id="articleListToggleBtn" class="article-list-toggle-btn" onclick="toggleArticleListPane()">Hide Selector</button><div class="article-editor-tabs"><button id="articleTabEditor" onclick="switchArticlePanel(&quot;editor&quot;)">Editor</button><button id="articleTabProperties" onclick="switchArticlePanel(&quot;properties&quot;)">Properties</button></div><button class="btn btn-primary" onclick="saveCurrentArticle()">Save</button></div></div><div id="articleSaveStatus" class="article-save-status">Loading article list...</div><div class="article-editor-body" id="articleEditorBody"></div></section></div>';

  articleState.list = [];
  articleState.filtered = [];
  articleState.writers = [];
  articleState.current = null;
  articleState.selectedId = null;
  articleState.panel = 'editor';
  articleState.listCollapsed = false;
  articleState.savedRange = null;
  articleState.recentImages = [];
  articleState.carouselSeed = 0;
  articleState.editorMode = 'rich';
  articleState.markdownDraft = '';
  articleState.undoStack = [];
  articleState.redoStack = [];
  refreshArticleListPaneState();

  Promise.all([
    apiGet('/admin/articles'),
    apiGet('/admin/writers').catch(function() { return { writers: [] }; })
  ]).then(function(payloads) {
    var articlePayload = payloads[0] || { articles: [] };
    var writerPayload = payloads[1] || { writers: [] };
    articleState.list = (articlePayload.articles || []).map(normalizeArticle);
    articleState.filtered = articleState.list.slice();
    articleState.writers = (writerPayload.writers || []).map(function(w) { return w.name; });
    renderArticleList();
    if (articleState.list.length) {
      selectArticleFromList(articleState.list[0].id);
    } else {
      startNewArticle();
      setArticleSaveStatus('No articles yet. Start writing your first one.', false);
    }
  }).catch(function(err) {
    document.getElementById('articleList').innerHTML = '<div class="article-empty-state">Failed to load articles.</div>';
    document.getElementById('articleEditorBody').innerHTML = '<div class="article-empty-state">Unable to load data: ' + esc(err.message) + '</div>';
    setArticleSaveStatus('Failed to load articles', true);
  });
}

function toggleArticleListPane(forceVisible) {
  if (typeof forceVisible === 'boolean') {
    articleState.listCollapsed = !forceVisible;
  } else {
    articleState.listCollapsed = !articleState.listCollapsed;
  }
  refreshArticleListPaneState();
}

function refreshArticleListPaneState() {
  var workspace = document.getElementById('articleWorkspace');
  if (!workspace) return;
  if (articleState.listCollapsed) workspace.classList.add('article-list-hidden');
  else workspace.classList.remove('article-list-hidden');
  var toggleBtn = document.getElementById('articleListToggleBtn');
  if (toggleBtn) toggleBtn.textContent = articleState.listCollapsed ? 'Show Selector' : 'Hide Selector';
}

function setArticleSaveStatus(message, isError, isSuccess) {
  var el = document.getElementById('articleSaveStatus');
  if (!el) return;
  el.className = 'article-save-status';
  if (isError) el.classList.add('error');
  if (isSuccess) el.classList.add('success');
  el.textContent = message || '';
}

function filterArticleList(query) {
  var q = String(query || '').toLowerCase().trim();
  if (!q) {
    articleState.filtered = articleState.list.slice();
  } else {
    articleState.filtered = articleState.list.filter(function(a) {
      return String(a.title || '').toLowerCase().includes(q) ||
             String(a.url_id || '').toLowerCase().includes(q) ||
             String(a.author || '').toLowerCase().includes(q);
    });
  }
  renderArticleList();
}

function renderArticleList() {
  var el = document.getElementById('articleList');
  if (!el) return;
  if (!articleState.filtered.length) {
    el.innerHTML = '<div class="article-empty-state">No matching articles.</div>';
    return;
  }
  var html = '';
  articleState.filtered.forEach(function(a) {
    var active = articleState.selectedId === a.id ? ' active' : '';
    var dateText = (a.publish_date || '').slice(0,10);
    html += '<button class="article-item' + active + '" onclick="selectArticleFromList(' + a.id + ')"><div class="article-item-title">' + esc(a.title || 'Untitled') + '</div><div class="article-meta">' + esc(a.url_id || 'no-slug') + ' â€¢ ' + esc(a.author || 'No writer') + '</div><div class="article-meta">' + esc(a.status || 'draft') + (dateText ? ' â€¢ ' + esc(dateText) : '') + '</div></button>';
  });
  el.innerHTML = html;
}

function startNewArticle() {
  captureCurrentArticleDraft();
  articleState.undoStack = [];
  articleState.redoStack = [];
  articleState.selectedId = null;
  articleState.current = normalizeArticle({
    id: null,
    title: 'Untitled Article',
    url_id: '',
    author: '',
    excerpt: '',
    body: '',
    categories: '',
    tags: '',
    publish_date: nowAsLocalDateTime(),
    status: 'draft'
  });
  articleState.markdownDraft = '';
  articleState.panel = 'editor';
  renderArticleList();
  renderArticleWorkspace();
  setArticleSaveStatus('Editing new article draft', false);
}

function selectArticleFromList(id) {
  captureCurrentArticleDraft();
  articleState.undoStack = [];
  articleState.redoStack = [];
  articleState.selectedId = id;
  articleState.panel = 'editor';
  renderArticleList();
  document.getElementById('articleEditorTitle').textContent = 'Loading article...';
  document.getElementById('articleEditorSubtitle').textContent = '';
  document.getElementById('articleEditorBody').innerHTML = '<div class="article-empty-state">Loading selected article...</div>';
  apiGet('/admin/articles/' + id).then(function(data) {
    articleState.current = normalizeArticle(data.article || {});
    articleState.markdownDraft = '';
    articleState.selectedId = articleState.current.id;
    renderArticleList();
    renderArticleWorkspace();
    setArticleSaveStatus('Loaded article', false);
    takeImmediateUndoSnapshot();
  }).catch(function(err) {
    setArticleSaveStatus('Could not load article: ' + err.message, true);
  });
}

function switchArticlePanel(panel) {
  if (!articleState.current) return;
  captureCurrentArticleDraft();
  articleState.panel = panel;
  renderArticleWorkspace();
}

function captureCurrentArticleDraft() {
  if (!articleState.current) return;
  var titleEl = document.getElementById('articleTitleInput');
  var slugEl = document.getElementById('articleSlugInput');
  var excerptEl = document.getElementById('articleExcerptInput');
  var bodyEl = document.getElementById('articleBodyEditor');
  var markdownEl = document.getElementById('articleBodyMarkdownInput');
  var authorEl = document.getElementById('articleAuthorInput');
  var categoriesEl = document.getElementById('articleCategoriesInput');
  var tagsEl = document.getElementById('articleTagsInput');
  var publishEl = document.getElementById('articlePublishInput');
  var statusEl = document.getElementById('articleStatusInput');

  if (titleEl) articleState.current.title = titleEl.value;
  if (slugEl) articleState.current.url_id = slugEl.value.trim();
  if (excerptEl) articleState.current.excerpt = excerptEl.value;
  /* Body may not exist when saving from Properties tab â€” use last-captured draft */
  if (bodyEl) {
    if (isArticleMarkdownMode() && markdownEl) {
      articleState.markdownDraft = markdownEl.value;
      articleState.current.body = markdownToArticleHtml(markdownEl.value);
      bodyEl.innerHTML = articleState.current.body || '';
    } else {
      articleState.current.body = bodyEl.innerHTML;
      articleState.markdownDraft = articleHtmlToMarkdown(articleState.current.body);
      if (markdownEl) markdownEl.value = articleState.markdownDraft;
    }
  }
  if (authorEl) articleState.current.author = authorEl.value;
  if (categoriesEl) articleState.current.categories = categoriesEl.value;
  if (tagsEl) articleState.current.tags = tagsEl.value;
  if (publishEl) articleState.current.publish_date = publishEl.value;
  if (statusEl) articleState.current.status = statusEl.value;
}

function renderArticleWorkspace() {
  var current = articleState.current;
  if (!current) return;
  var titleEl = document.getElementById('articleEditorTitle');
  var subtitleEl = document.getElementById('articleEditorSubtitle');
  if (titleEl) titleEl.textContent = current.title || 'Untitled Article';
  if (subtitleEl) subtitleEl.textContent = (current.url_id ? ('/' + current.url_id) : 'New article draft') + ' â€¢ ' + (current.status || 'draft');

  ['articleTabEditor','articleTabProperties'].forEach(function(id) {
    var tab = document.getElementById(id);
    if (!tab) return;
    tab.classList.remove('active');
  });
  if (articleState.panel === 'editor') document.getElementById('articleTabEditor').classList.add('active');
  if (articleState.panel === 'properties') document.getElementById('articleTabProperties').classList.add('active');
  refreshArticleListPaneState();

  var body = document.getElementById('articleEditorBody');
  if (!body) return;
  if (articleState.panel === 'editor') {
    body.innerHTML = getArticleEditorHtml(current);
    initializeArticleEditor();
  }
  if (articleState.panel === 'properties') body.innerHTML = getArticlePropertiesHtml(current);
}

function syncArticleAuthorFromSelection() {
  var select = document.getElementById('articleWritersSelect');
  var input = document.getElementById('articleAuthorInput');
  if (!select || !input) return;
  var selected = [];
  for (var i = 0; i < select.options.length; i++) {
    if (select.options[i].selected) selected.push(select.options[i].value);
  }
  input.value = selected.join(', ');
}

function getArticleEditorHtml(article) {
  return '<div class="editor-toolbar"><select id="editorStyleDropdown" class="editor-style-dropdown" data-command="formatBlock"><option value="">Normal text</option><option value="H1">Heading 1</option><option value="H2">Heading 2</option><option value="H3">Heading 3</option><option value="H4">Heading 4</option><option value="H5">Heading 5</option><option value="H6">Heading 6</option></select><div class="editor-toolbar-sep"></div><button type="button" data-command="bold" title="Bold (Ctrl+B)"><b>B</b></button><button type="button" data-command="italic" title="Italic (Ctrl+I)"><i>I</i></button><button type="button" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button><button type="button" data-command="strikeThrough" title="Strikethrough"><s>S</s></button><button type="button" data-command="code" title="Inline code">&lt;/&gt;</button><div class="editor-toolbar-sep"></div><button type="button" data-command="justifyLeft" title="Align left">â‰¡</button><button type="button" data-command="justifyCenter" title="Align center">â‰¡</button><button type="button" data-command="justifyRight" title="Align right">â‰¡</button><div class="editor-toolbar-sep"></div><button type="button" data-command="insertUnorderedList" title="Bullet list">â€¢</button><button type="button" data-command="insertOrderedList" title="Numbered list">1.</button><button type="button" data-command="blockquote" title="Blockquote">"</button><button type="button" data-command="superscript" title="Superscript">xÂ²</button><div class="editor-toolbar-sep"></div><button type="button" data-command="createLink" title="Insert link (Ctrl+K)">ðŸ”—</button><button type="button" data-command="unlink" title="Remove link">ðŸ”—</button><button type="button" data-command="removeFormat" title="Clear formatting">TX</button><div class="editor-toolbar-sep"></div><button type="button" data-command="insertImage" title="Insert image">ðŸ–¼</button><button type="button" data-command="insertTable" title="Insert table">âŠž</button><div class="editor-toolbar-sep"></div><button type="button" data-command="importGdoc" title="Import from Google Docs">ðŸ“„â†“</button></div><div class="article-field"><label>Title</label><input id="articleTitleInput" class="article-input" value="' + escAttr(article.title) + '" placeholder="Article title"></div><div class="article-field"><label>Article Body</label><div id="articleEditorModeToggle" class="article-editor-mode-toggle"><button type="button" data-mode="rich">Rich Text</button><button type="button" data-mode="markdown">Markdown</button></div><div id="articleBodyEditor" class="editor-canvas" contenteditable="true">' + (article.body || '') + '</div><textarea id="articleBodyMarkdownInput" class="article-textarea article-markdown-input" placeholder="Write Markdown here..." spellcheck="false"></textarea><div id="articleImageOverlayBackdrop" class="article-image-overlay-backdrop"></div><div id="articleImageInsertPanel" class="article-image-insert-panel"><button class="overlay-close" onclick="toggleArticleImagePanel(false)">x</button><h3>Insert Media</h3><div class="article-image-insert-rows"><div class="article-image-insert-row"><label>Upload or drag images</label><div class="article-image-dropzone" id="imageDropZone" onclick="document.getElementById(&apos;imageUploadFileInput&apos;).click()" ondragover="this.classList.add(&apos;drag-over&apos;);return false" ondragleave="this.classList.remove(&apos;drag-over&apos;)" ondrop="handleImageDrop(event);this.classList.remove(&apos;drag-over&apos;);return false"><span class="dropzone-icon">+</span><span>Click or drag images here</span><input type="file" id="imageUploadFileInput" accept="image/*" multiple onchange="handleArticleImageUpload(this.files)"></div></div><div id="imageUploadPreview" class="article-image-uploaded-previews"></div><div class="article-image-insert-row"><label>Layout</label><select id="imageOverlayLayout" class="article-select" onchange="toggleArticleCarouselInput()"><option value="full">Full Width</option><option value="left">Float Left</option><option value="right">Float Right</option><option value="carousel">Carousel</option></select><input id="imageOverlayCaption" class="article-input" placeholder="Optional caption"></div><div class="article-image-insert-row"><label>Recent uploads</label><div id="imageOverlayRecent" class="article-image-recent"></div></div></div><div class="article-image-insert-actions"><button type="button" class="btn btn-sm" onclick="toggleArticleImagePanel(false)">Cancel</button><button type="button" class="btn btn-sm btn-primary" onclick="insertArticleImageBlock()">Insert</button></div></div></div><div id="articleGdocImportOverlayBackdrop" class="article-image-overlay-backdrop"></div><div id="articleGdocImportPanel" class="article-image-insert-panel"><button class="overlay-close" onclick="closeGdocImportDialog()">x</button><h3>Import from Google Docs</h3><div class="article-image-insert-rows"><div class="article-image-insert-row"><label>Google Docs URL</label><input id="gdocImportUrlInput" class="article-input" placeholder="https://docs.google.com/document/d/..." onkeydown="if(event.key===&apos;Enter&apos;)importGdoc()"></div><div style="font-size:.72rem;color:#888;line-height:1.4">Paste a published Google Docs URL (File > Share > Publish to web) or a publicly shared document link. The document content will be imported into the editor.</div><div id="gdocImportStatus" style="font-size:.72rem;margin-top:.25rem"></div></div><div class="article-image-insert-actions"><button type="button" class="btn btn-sm" onclick="closeGdocImportDialog()">Cancel</button><button type="button" class="btn btn-sm btn-primary" onclick="importGdoc()" id="gdocImportBtn">Import</button></div></div><div class="editor-statusbar" id="articleEditorStatusBar">Words: 0 â€¢ Characters: 0</div>';
}

function getArticlePropertiesHtml(article) {
  var options = '';
  articleState.writers.forEach(function(name) {
    var selected = splitWriters(article.author).includes(name) ? ' selected' : '';
    options += '<option value="' + escAttr(name) + '"' + selected + '>' + esc(name) + '</option>';
  });
  return '<div class="article-properties-grid"><div class="article-field"><label>Slug (URL ID)</label><input id="articleSlugInput" class="article-input" value="' + escAttr(article.url_id) + '" placeholder="your-article-slug"></div><div class="article-field"><label>Status</label><select id="articleStatusInput" class="article-select"><option value="publish"' + (article.status === 'publish' ? ' selected' : '') + '>Published</option><option value="draft"' + (article.status !== 'publish' ? ' selected' : '') + '>Draft</option></select></div><div class="article-field"><label>Publish Date</label><input id="articlePublishInput" class="article-input" type="datetime-local" value="' + escAttr(article.publish_date || nowAsLocalDateTime()) + '"></div><div class="article-field"><label>Writer(s)</label><select id="articleWritersSelect" class="article-select" multiple size="5" onchange="syncArticleAuthorFromSelection()">' + options + '</select></div><div class="article-field"><label>Author Field (stored)</label><input id="articleAuthorInput" class="article-input" value="' + escAttr(article.author) + '" placeholder="Comma-separated writer names"></div><div class="article-field"><label>Tags</label><input id="articleTagsInput" class="article-input" value="' + escAttr(article.tags) + '" placeholder="news, live-review, interview"></div><div class="article-field"><label>Categories</label><input id="articleCategoriesInput" class="article-input" value="' + escAttr(article.categories) + '" placeholder="Rock, Live Reviews"></div><div class="article-field" style="grid-column:1 / -1"><label>Excerpt</label><textarea id="articleExcerptInput" class="article-textarea" placeholder="Short summary for cards and metadata">' + esc(article.excerpt) + '</textarea></div></div>' + (article.id ? '<div style="margin-top:1rem"><button class="btn btn-danger" onclick="deleteCurrentArticle()">Delete Article</button></div>' : '');
}

function isArticleMarkdownMode() {
  return articleState.editorMode === 'markdown';
}

function setArticleEditorMode(mode) {
  mode = mode === 'markdown' ? 'markdown' : 'rich';
  if (articleState.editorMode === mode) return;
  var editor = document.getElementById('articleBodyEditor');
  var markdownInput = document.getElementById('articleBodyMarkdownInput');
  if (!editor || !markdownInput) return;
  if (mode === 'markdown') {
    articleState.markdownDraft = articleHtmlToMarkdown(editor.innerHTML);
    markdownInput.value = articleState.markdownDraft;
    articleState.editorMode = 'markdown';
    applyArticleEditorModeUI();
    markdownInput.focus();
  } else {
    articleState.markdownDraft = markdownInput.value;
    editor.innerHTML = markdownToArticleHtml(markdownInput.value);
    articleState.current.body = editor.innerHTML;
    articleState.editorMode = 'rich';
    applyArticleEditorModeUI();
    editor.focus();
    saveEditorSelection();
  }
  captureCurrentArticleDraft();
}

function applyArticleEditorModeUI() {
  var mode = isArticleMarkdownMode() ? 'markdown' : 'rich';
  var editor = document.getElementById('articleBodyEditor');
  var markdownInput = document.getElementById('articleBodyMarkdownInput');
  var toolbar = document.querySelector('.editor-toolbar');
  var modeToggle = document.getElementById('articleEditorModeToggle');
  if (modeToggle) {
    var buttons = modeToggle.querySelectorAll('button[data-mode]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-mode') === mode);
    }
  }
  if (editor) {
    editor.classList.toggle('is-hidden', mode === 'markdown');
    editor.setAttribute('contenteditable', mode === 'markdown' ? 'false' : 'true');
  }
  if (markdownInput) markdownInput.classList.toggle('active', mode === 'markdown');
  if (toolbar) toolbar.classList.toggle('is-hidden', mode === 'markdown');
  if (mode === 'markdown') {
    closeArticleContextMenu();
    toggleArticleImagePanel(false);
  }
}

function escapeMarkdownText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/([`*_{}\[\]()#+!|>])/g, '\\$1');
}

function escapeHtmlText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeArticleMarkdownUrl(url) {
  var value = String(url || '').trim();
  if (!value) return '#';
  if ((value.startsWith('<') && value.endsWith('>')) || (value.startsWith('(') && value.endsWith(')'))) {
    value = value.slice(1, -1).trim();
  }
  if (/^(javascript|vbscript|data):/i.test(value)) return '#';
  return value;
}

function isArticleCustomBlockElement(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.hasAttribute('data-article-carousel')) return true;
  return node.matches('.article-media,.article-carousel,.article-callout,.article-spacer,.article-cta,.article-pullquote,.article-divider');
}

function articleInlineNodeToMarkdown(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.textContent);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  var tag = node.tagName.toLowerCase();
  if (isArticleCustomBlockElement(node)) return node.outerHTML.trim();
  if (tag === 'strong' || tag === 'b') return '**' + articleInlineNodesToMarkdown(node.childNodes) + '**';
  if (tag === 'em' || tag === 'i') return '*' + articleInlineNodesToMarkdown(node.childNodes) + '*';
  if (tag === 'del' || tag === 's') return '~~' + articleInlineNodesToMarkdown(node.childNodes) + '~~';
  if (tag === 'code') return '`' + String(node.textContent || '').replace(/`/g, '\\`') + '`';
  if (tag === 'a') {
    if (node.classList.contains('article-cta')) return node.outerHTML.trim();
    var href = sanitizeArticleMarkdownUrl(node.getAttribute('href') || '#');
    var label = articleInlineNodesToMarkdown(node.childNodes).trim() || href;
    return '[' + label + '](' + href + ')';
  }
  if (tag === 'img') {
    var src = sanitizeArticleMarkdownUrl(node.getAttribute('src') || '');
    var alt = String(node.getAttribute('alt') || '');
    return '![' + alt.replace(/\]/g, '\\]') + '](' + src + ')';
  }
  if (tag === 'br') return '  \n';
  return articleInlineNodesToMarkdown(node.childNodes);
}

function articleInlineNodesToMarkdown(nodes) {
  var out = '';
  for (var i = 0; i < nodes.length; i++) {
    out += articleInlineNodeToMarkdown(nodes[i]);
  }
  return out;
}

function articleListToMarkdown(listNode, ordered, depth) {
  var rows = [];
  var index = 1;
  for (var i = 0; i < listNode.children.length; i++) {
    var li = listNode.children[i];
    if (!li || li.tagName.toLowerCase() !== 'li') continue;
    var prefix = ordered ? (index + '. ') : '- ';
    var line = new Array(depth + 1).join('  ') + prefix;
    var inlineNodes = [];
    var nestedRows = [];
    for (var n = 0; n < li.childNodes.length; n++) {
      var child = li.childNodes[n];
      if (child.nodeType === Node.ELEMENT_NODE) {
        var childTag = child.tagName.toLowerCase();
        if (childTag === 'ul' || childTag === 'ol') {
          nestedRows.push(articleListToMarkdown(child, childTag === 'ol', depth + 1));
          continue;
        }
      }
      inlineNodes.push(child);
    }
    line += articleInlineNodesToMarkdown(inlineNodes).trim();
    rows.push(line.trimEnd());
    if (nestedRows.length) rows.push(nestedRows.join('\n'));
    index += 1;
  }
  return rows.join('\n');
}

function articleNodeToMarkdown(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) {
    var raw = String(node.textContent || '').trim();
    return raw ? escapeMarkdownText(raw) : '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (isArticleCustomBlockElement(node)) return node.outerHTML.trim();
  var tag = node.tagName.toLowerCase();
  if (tag === 'p') {
    if (node.querySelector && node.querySelector('.article-cta')) return node.outerHTML.trim();
    return articleInlineNodesToMarkdown(node.childNodes).trim();
  }
  if (/^h[1-6]$/.test(tag)) {
    var level = parseInt(tag.slice(1), 10);
    return new Array(level + 1).join('#') + ' ' + articleInlineNodesToMarkdown(node.childNodes).trim();
  }
  if (tag === 'hr') return '---';
  if (tag === 'pre') {
    var codeText = String(node.textContent || '').replace(/\n+$/, '');
    return '```\n' + codeText + '\n```';
  }
  if (tag === 'blockquote') {
    if (node.classList.contains('article-pullquote')) return node.outerHTML.trim();
    var quoteBody = articleNodesToMarkdown(node.childNodes);
    if (!quoteBody) return '';
    return quoteBody.split('\n').map(function(line) { return line ? '> ' + line : '>'; }).join('\n');
  }
  if (tag === 'ul' || tag === 'ol') return articleListToMarkdown(node, tag === 'ol', 0);
  if (tag === 'div' || tag === 'figure' || tag === 'aside' || tag === 'table' || tag === 'section') return node.outerHTML.trim();
  return articleInlineNodesToMarkdown(node.childNodes).trim();
}

function articleNodesToMarkdown(nodes) {
  var blocks = [];
  for (var i = 0; i < nodes.length; i++) {
    var piece = articleNodeToMarkdown(nodes[i]);
    if (!piece) continue;
    blocks.push(piece.trim());
  }
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function articleHtmlToMarkdown(html) {
  var source = String(html || '');
  if (!source.trim()) return '';
  var container = document.createElement('div');
  container.innerHTML = source;
  return articleNodesToMarkdown(container.childNodes);
}

function articleInlineMarkdownToHtml(value) {
  var source = String(value || '');
  var codeStore = [];
  source = source.replace(/`([^`]+)`/g, function(_, code) {
    var token = '@@CODE' + codeStore.length + '@@';
    codeStore.push('<code>' + escapeHtmlText(code) + '</code>');
    return token;
  });
  var html = escapeHtmlText(source);
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)/g, function(_, alt, rawUrl, title) {
    var safeUrl = sanitizeArticleMarkdownUrl(rawUrl);
    var titleAttr = title ? ' title="' + escAttr(title) + '"' : '';
    return '<img src="' + escAttr(safeUrl) + '" alt="' + escAttr(alt) + '"' + titleAttr + '>';
  });
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+\"([^\"]*)\")?\)/g, function(_, text, rawUrl, title) {
    var safeUrl = sanitizeArticleMarkdownUrl(rawUrl);
    var titleAttr = title ? ' title="' + escAttr(title) + '"' : '';
    return '<a href="' + escAttr(safeUrl) + '"' + titleAttr + '>' + text + '</a>';
  });
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  for (var i = 0; i < codeStore.length; i++) {
    html = html.replace('@@CODE' + i + '@@', codeStore[i]);
  }
  return html;
}

function isArticleRawHtmlLine(line) {
  return /^<\/?[a-z][\s\S]*>$/i.test(line);
}

function markdownToArticleHtml(markdown) {
  var source = String(markdown || '').replace(/\r\n?/g, '\n');
  if (!source.trim()) return '';
  var lines = source.split('\n');
  var htmlParts = [];
  var paragraphLines = [];
  var quoteLines = [];
  var listItems = [];
  var listOrdered = false;
  var codeLines = null;
  var rawHtmlLines = [];

  function flushParagraph() {
    if (!paragraphLines.length) return;
    var text = paragraphLines.join('\n').trim();
    paragraphLines = [];
    if (!text) return;
    htmlParts.push('<p>' + articleInlineMarkdownToHtml(text).replace(/\n/g, '<br>') + '</p>');
  }

  function flushList() {
    if (!listItems.length) return;
    htmlParts.push((listOrdered ? '<ol>' : '<ul>') + listItems.map(function(item) { return '<li>' + item + '</li>'; }).join('') + (listOrdered ? '</ol>' : '</ul>'));
    listItems = [];
  }

  function flushQuotes() {
    if (!quoteLines.length) return;
    var quotedHtml = markdownToArticleHtml(quoteLines.join('\n'));
    quoteLines = [];
    htmlParts.push('<blockquote>' + quotedHtml + '</blockquote>');
  }

  function flushRawHtml() {
    if (!rawHtmlLines.length) return;
    htmlParts.push(rawHtmlLines.join('\n'));
    rawHtmlLines = [];
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    if (codeLines !== null) {
      if (/^```/.test(trimmed)) {
        htmlParts.push('<pre><code>' + escapeHtmlText(codeLines.join('\n')) + '</code></pre>');
        codeLines = null;
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (rawHtmlLines.length) {
      if (!trimmed) {
        flushRawHtml();
        continue;
      }
      if (isArticleRawHtmlLine(trimmed)) {
        rawHtmlLines.push(line);
        continue;
      }
      flushRawHtml();
    }

    if (/^```/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuotes();
      codeLines = [];
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuotes();
      continue;
    }

    if (isArticleRawHtmlLine(trimmed)) {
      flushParagraph();
      flushList();
      flushQuotes();
      rawHtmlLines.push(line);
      continue;
    }

    var quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }

    flushQuotes();

    var headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      var headingLevel = headingMatch[1].length;
      htmlParts.push('<h' + headingLevel + '>' + articleInlineMarkdownToHtml(headingMatch[2].trim()) + '</h' + headingLevel + '>');
      continue;
    }

    if (/^(\*\s*\*\s*\*|-{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      htmlParts.push('<hr>');
      continue;
    }

    var listMatch = line.match(/^\s*([-+*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      var itemOrdered = /\d+\./.test(listMatch[1]);
      if (!listItems.length) listOrdered = itemOrdered;
      if (listItems.length && itemOrdered !== listOrdered) {
        flushList();
        listOrdered = itemOrdered;
      }
      listItems.push(articleInlineMarkdownToHtml(listMatch[2].trim()));
      continue;
    }

    if (listItems.length) flushList();
    paragraphLines.push(line);
  }

  if (codeLines !== null) htmlParts.push('<pre><code>' + escapeHtmlText(codeLines.join('\n')) + '</code></pre>');
  flushRawHtml();
  flushQuotes();
  flushList();
  flushParagraph();

  var html = htmlParts.join('\n').trim();
  return html || '';
}

function insertTextIntoTextarea(textarea, text) {
  if (!textarea) return;
  var start = textarea.selectionStart != null ? textarea.selectionStart : textarea.value.length;
  var end = textarea.selectionEnd != null ? textarea.selectionEnd : textarea.value.length;
  var current = textarea.value || '';
  textarea.value = current.slice(0, start) + text + current.slice(end);
  var cursor = start + text.length;
  textarea.selectionStart = cursor;
  textarea.selectionEnd = cursor;
  textarea.focus();
}

function initializeArticleEditor() {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;

  ensureToolbarDelegation();
  ensureKeyboardShortcuts(editor);

  if (!articleState.markdownDraft) {
    var markdownInput = document.getElementById('articleBodyMarkdownInput');
    if (markdownInput) {
      articleState.markdownDraft = articleHtmlToMarkdown(editor.innerHTML);
      markdownInput.value = articleState.markdownDraft;
      markdownInput.addEventListener('input', function() {
        if (!isArticleMarkdownMode()) return;
        articleState.markdownDraft = markdownInput.value;
        articleState.current.body = markdownToArticleHtml(markdownInput.value);
      });
    }
  }

  var modeToggle = document.getElementById('articleEditorModeToggle');
  if (modeToggle) {
    modeToggle.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      setArticleEditorMode(btn.getAttribute('data-mode'));
    });
  }

  var backdrop = document.getElementById('articleImageOverlayBackdrop');
  if (backdrop) {
    backdrop.onclick = function() { toggleArticleImagePanel(false); };
  }

  var gdocBackdrop = document.getElementById('articleGdocImportOverlayBackdrop');
  if (gdocBackdrop) {
    gdocBackdrop.onclick = function() { closeGdocImportDialog(); };
  }

  ensureArticleContextMenu();
  if (!editor.dataset.contextMenuBound) {
    editor.addEventListener('contextmenu', function(e) {
      if (isArticleMarkdownMode()) return;
      e.preventDefault();
      if (!moveEditorSelectionToPoint(editor, e.clientX, e.clientY)) saveEditorSelection();
      openArticleContextMenu(e.clientX, e.clientY);
    });
    editor.addEventListener('scroll', closeArticleContextMenu, { passive: true });
    editor.dataset.contextMenuBound = '1';
  }

  editor.addEventListener('mouseup', saveEditorSelection);
  editor.addEventListener('keyup', saveEditorSelection);
  editor.addEventListener('focus', saveEditorSelection);
  editor.addEventListener('blur', saveEditorSelection);
  editor.addEventListener('input', function() { scheduleUndoSnapshot(); updateWordCountDebounced(); });
  editor.addEventListener('paste', function(e) { sanitizePastedContent(e); takeImmediateUndoSnapshot(); });
  editor.addEventListener('keydown', function(e) {
    if (e.key !== 'Backspace' || e.ctrlKey || e.metaKey) return;
    handleBackspaceDeleteBlock(e);
  });

  setupLinkPopover(editor);
  setupImageClickToEdit(editor);

  applyArticleEditorModeUI();
  toggleArticleImagePanel(false);
  saveEditorSelection();
  updateWordCount();

  var statusBar = document.getElementById('articleEditorStatusBar');
  if (statusBar) statusBar.style.display = '';
}

var toolbarDelegationBound = false;
function ensureToolbarDelegation() {
  if (toolbarDelegationBound) return;
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.editor-toolbar [data-command]');
    if (!btn) return;
    e.preventDefault();
    var command = btn.getAttribute('data-command');
    var editor = document.getElementById('articleBodyEditor');
    if (!editor) return;
    if (isArticleMarkdownMode()) return;

    if (command === 'createLink') {
      insertArticleLink();
    } else if (command === 'unlink') {
      executeArticleEditorCommand('unlink');
    } else if (command === 'code') {
      toggleInlineCode();
    } else if (command === 'blockquote') {
      toggleBlockquote();
    } else if (command === 'removeFormat') {
      executeArticleEditorCommand('removeFormat');
    } else if (command === 'superscript') {
      executeArticleEditorCommand('superscript');
    } else if (command === 'insertImage') {
      openArticleImageOverlayWithLayout('full');
    } else if (command === 'insertTable') {
      showTableGridPicker();
    } else if (command === 'importGdoc') {
      showGdocImportDialog();
    } else if (command === 'formatBlock') {
      var value = btn.value;
      executeArticleEditorCommand('formatBlock', value);
      editor.focus();
    } else {
      executeArticleEditorCommand(command);
    }
    takeImmediateUndoSnapshot();
    updateToolbarState();
  });

  document.addEventListener('change', function(e) {
    var sel = e.target.closest('.editor-toolbar select[data-command]');
    if (!sel) return;
    var command = sel.getAttribute('data-command');
    var value = sel.value;
    executeArticleEditorCommand(command, value);
    takeImmediateUndoSnapshot();
    updateToolbarState();
  });

  toolbarDelegationBound = true;
}

function executeArticleEditorCommand(command, value) {
  if (isArticleMarkdownMode()) return;
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  editor.focus();
  restoreEditorSelection();
  document.execCommand(command, false, value == null ? null : value);
  saveEditorSelection();
  captureCurrentArticleDraft();
}

function applyArticleFormat(command) {
  executeArticleEditorCommand(command, null);
}

function formatArticleHeading() {
  executeArticleEditorCommand('formatBlock', 'H2');
}

function insertArticleLink() {
  var url = prompt('Enter URL');
  if (!url) return;
  executeArticleEditorCommand('createLink', url.trim());
}

function formatArticleCode() {
  executeArticleEditorCommand('formatBlock', 'pre');
}

function toggleInlineCode() {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  editor.focus();
  restoreEditorSelection();
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  if (range.collapsed) return;
  var ancestor = range.commonAncestorContainer;
  var code = ancestor.nodeType === 3 ? ancestor.parentElement.closest('code') : ancestor.closest('code');
  if (code) {
    var frag = document.createDocumentFragment();
    while (code.firstChild) frag.appendChild(code.firstChild);
    code.parentNode.replaceChild(frag, code);
  } else {
    var contents = range.extractContents();
    var wrapper = document.createElement('code');
    wrapper.appendChild(contents);
    range.insertNode(wrapper);
    range.setStartAfter(wrapper);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  saveEditorSelection();
  captureCurrentArticleDraft();
}

function toggleBlockquote() {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  editor.focus();
  restoreEditorSelection();
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  var ancestor = range.commonAncestorContainer;
  if (ancestor.nodeType === 3) ancestor = ancestor.parentElement;
  var blockquote = ancestor.closest('blockquote');
  if (blockquote) {
    executeArticleEditorCommand('formatBlock', 'p');
  } else {
    executeArticleEditorCommand('formatBlock', 'blockquote');
  }
}

function updateToolbarState() {
  var sel = window.getSelection();
  var editor = document.getElementById('articleBodyEditor');
  var toolbar = document.querySelector('.editor-toolbar');
  if (!toolbar || !editor || isArticleMarkdownMode()) return;

  var buttons = toolbar.querySelectorAll('[data-command]');
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    if (btn.tagName === 'SELECT') continue;
    btn.classList.remove('active');
  }

  if (!sel || !sel.rangeCount) return;
  if (!editor.contains(sel.anchorNode)) return;

  var commands = ['bold','italic','underline','strikeThrough','code','justifyLeft','justifyCenter','justifyRight','insertUnorderedList','insertOrderedList','superscript','blockquote'];
  for (var j = 0; j < commands.length; j++) {
    var cmd = commands[j];
    if (cmd === 'code') {
      var ancestor = sel.anchorNode;
      if (ancestor && ancestor.nodeType === 3) ancestor = ancestor.parentElement;
      if (ancestor && ancestor.closest('code')) {
        toolbar.querySelector('[data-command="code"]').classList.add('active');
      }
    } else if (document.queryCommandState(cmd)) {
      var activeBtn = toolbar.querySelector('[data-command="' + cmd + '"]');
      if (activeBtn) activeBtn.classList.add('active');
    }
  }

  var styleDropdown = document.getElementById('editorStyleDropdown');
  if (styleDropdown) {
    var ancestor = sel.anchorNode;
    while (ancestor && ancestor !== editor) {
      if (ancestor.nodeType === 1 && /^H[1-6]$/.test(ancestor.tagName)) {
        styleDropdown.value = ancestor.tagName;
        return;
      }
      ancestor = ancestor.parentElement;
    }
    styleDropdown.value = '';
  }
}

var toolbarRafId = null;
document.addEventListener('selectionchange', function() {
  if (toolbarRafId) return;
  toolbarRafId = requestAnimationFrame(function() {
    toolbarRafId = null;
    updateToolbarState();
  });
});

function saveEditorSelection() {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  articleState.savedRange = range.cloneRange();
}

function restoreEditorSelection() {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor || !articleState.savedRange) return false;
  var sel = window.getSelection();
  if (!sel) return false;
  try {
    sel.removeAllRanges();
    sel.addRange(articleState.savedRange.cloneRange());
    return true;
  } catch (e) {
    return false;
  }
}

function ensureArticleContextMenu() {
  var menu = document.getElementById('articleEditorContextMenu');
  if (menu) return menu;
  menu = document.createElement('div');
  menu.id = 'articleEditorContextMenu';
  menu.className = 'editor-context-menu';
  menu.innerHTML = '<button type="button" data-action="divider">Insert Divider Line</button><button type="button" data-action="image">Insert Image</button><button type="button" data-action="carousel">Insert Carousel</button><button type="button" data-action="embed">Insert Embed</button><div class="menu-separator"></div><button type="button" data-action="importGdoc">Import from Google Docs</button><div class="menu-separator"></div><button type="button" data-action="quote">Insert Pull Quote</button><button type="button" data-action="callout">Insert Callout Box</button><div class="menu-separator"></div><button type="button" data-action="spacer-sm">Insert Small Spacer</button><button type="button" data-action="spacer-md">Insert Medium Spacer</button><button type="button" data-action="spacer-lg">Insert Large Spacer</button><div class="menu-separator"></div><button type="button" data-action="cta">Insert CTA Button</button>';
  menu.addEventListener('mousedown', function(e) { e.preventDefault(); });
  menu.addEventListener('click', function(e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    handleArticleContextMenuAction(btn.getAttribute('data-action'));
  });
  document.body.appendChild(menu);

  if (!document.body.dataset.articleContextMenuGlobalsBound) {
    document.addEventListener('click', function(e) {
      var current = document.getElementById('articleEditorContextMenu');
      if (!current || !current.classList.contains('active')) return;
      if (!current.contains(e.target)) closeArticleContextMenu();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeArticleContextMenu();
    });
    window.addEventListener('resize', closeArticleContextMenu);
    window.addEventListener('scroll', closeArticleContextMenu, true);
    document.body.dataset.articleContextMenuGlobalsBound = '1';
  }

  return menu;
}

function openArticleContextMenu(clientX, clientY) {
  var menu = ensureArticleContextMenu();
  menu.style.left = clientX + 'px';
  menu.style.top = clientY + 'px';
  menu.classList.add('active');
  var rect = menu.getBoundingClientRect();
  var margin = 8;
  var left = clientX;
  var top = clientY;
  if (left + rect.width + margin > window.innerWidth) left = window.innerWidth - rect.width - margin;
  if (top + rect.height + margin > window.innerHeight) top = window.innerHeight - rect.height - margin;
  if (left < margin) left = margin;
  if (top < margin) top = margin;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function closeArticleContextMenu() {
  var menu = document.getElementById('articleEditorContextMenu');
  if (!menu) return;
  menu.classList.remove('active');
}

function moveEditorSelectionToPoint(editor, clientX, clientY) {
  if (!editor) return false;
  var range = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  } else if (document.caretPositionFromPoint) {
    var pos = document.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range || !editor.contains(range.startContainer)) return false;
  var sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  saveEditorSelection();
  return true;
}

function openArticleImageOverlayWithLayout(layout) {
  if (isArticleMarkdownMode()) {
    setArticleSaveStatus('Switch to Rich Text mode to use image overlays', true);
    return;
  }
  restoreEditorSelection();
  saveEditorSelection();
  toggleArticleImagePanel(true);
  var layoutInput = document.getElementById('imageOverlayLayout');
  if (layoutInput) {
    layoutInput.value = layout || 'full';
    toggleArticleCarouselInput();
  }
}

function handleArticleContextMenuAction(action) {
  closeArticleContextMenu();
  if (action === 'image') {
    openArticleImageOverlayWithLayout('full');
    return;
  }
  if (action === 'carousel') {
    openArticleImageOverlayWithLayout('carousel');
    return;
  }
  if (action === 'embed') {
    showEmbedDialog();
    return;
  }
  if (action === 'importGdoc') {
    showGdocImportDialog();
    return;
  }
  if (action === 'cta') {
    var label = prompt('Button text', 'Read More');
    if (label == null) return;
    label = label.trim() || 'Read More';
    var url = prompt('Button URL', 'https://');
    if (url == null) return;
    url = url.trim() || '#';
    if (url !== '#' && !/^https?:\/\//i.test(url) && !url.startsWith('/')) url = 'https://' + url;
    insertArticleHtmlAtCursor('<p><a class="article-cta" href="' + escAttr(url) + '" target="_blank" rel="noopener">' + esc(label) + '</a></p><p></p>');
    setArticleSaveStatus('CTA button inserted', false, true);
    return;
  }

  var inserts = {
    divider: '<hr class="article-divider"><p></p>',
    quote: '<blockquote class="article-pullquote"><p>Quote text...</p></blockquote><p></p>',
    callout: '<aside class="article-callout"><p><strong>Note:</strong> Add important context here.</p></aside><p></p>',
    'spacer-sm': '<div class="article-spacer article-spacer--sm"></div><p></p>',
    'spacer-md': '<div class="article-spacer article-spacer--md"></div><p></p>',
    'spacer-lg': '<div class="article-spacer article-spacer--lg"></div><p></p>'
  };
  var html = inserts[action];
  if (!html) return;
  if (insertArticleHtmlAtCursor(html)) {
    setArticleSaveStatus('Block inserted', false, true);
  } else {
    setArticleSaveStatus('Could not insert block', true);
  }
}

function handleImageDrop(e) {
  e.preventDefault();
  var files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length) handleArticleImageUpload(files);
}

var imageUploadQueue = [];

function handleArticleImageUpload(files) {
  if (!files || !files.length) return;
  var preview = document.getElementById('imageUploadPreview');
  Array.from(files).forEach(function(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    var objUrl = URL.createObjectURL(file);
    imageUploadQueue.push({ file: file, objUrl: objUrl, url: null });
    var idx = imageUploadQueue.length - 1;
    var div = document.createElement('div');
    div.className = 'upload-thumb-wrapper';
    div.innerHTML = '<img src="' + objUrl + '" class="upload-thumb"><button class="upload-thumb-remove" onclick="removeQueuedImage(' + idx + ',this)">x</button>';
    if (preview) preview.appendChild(div);
  });
  setArticleSaveStatus(imageUploadQueue.filter(function(item) { return item !== null; }).length + ' image(s) selected', false, true);
  var uploadInput = document.getElementById('imageUploadFileInput');
  if (uploadInput) uploadInput.value = '';
}

function removeQueuedImage(idx, btn) {
  if (imageUploadQueue[idx]) {
    URL.revokeObjectURL(imageUploadQueue[idx].objUrl);
    imageUploadQueue[idx] = null;
  }
  var wrapper = btn && btn.parentElement;
  if (wrapper && wrapper.parentElement) wrapper.parentElement.removeChild(wrapper);
  var remaining = imageUploadQueue.filter(function(item) { return item !== null; }).length;
  setArticleSaveStatus(remaining ? (remaining + ' image(s) selected') : 'Image selection cleared', false, !!remaining);
}

function toggleArticleImagePanel(forceOpen) {
  closeArticleContextMenu();
  var panel = document.getElementById('articleImageInsertPanel');
  var backdrop = document.getElementById('articleImageOverlayBackdrop');
  if (!panel) return;
  var shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('active');
  if (shouldOpen && isArticleMarkdownMode()) {
    setArticleSaveStatus('Switch to Rich Text mode to insert media', true);
    return;
  }
  if (shouldOpen) {
    saveEditorSelection();
    toggleArticleCarouselInput();
    renderImageOverlayRecent();
    panel.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
  } else {
    panel.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    clearImageUploadQueue();
    imageUploadQueue = [];
  }
}

function renderImageOverlayRecent() {
  var container = document.getElementById('imageOverlayRecent');
  if (!container) return;
  container.innerHTML = '';
  if (!articleState.recentImages || !articleState.recentImages.length) {
    container.innerHTML = '<span style="font-size:.75rem;color:#aaa">No recent uploads</span>';
    return;
  }
  articleState.recentImages.forEach(function(url) {
    var img = document.createElement('img');
    img.className = 'recent-thumb';
    img.src = url;
    img.title = 'Click to insert';
    img.onclick = function() {
      var layoutInput = document.getElementById('imageOverlayLayout');
      var captionInput = document.getElementById('imageOverlayCaption');
      var layout = layoutInput ? layoutInput.value : 'full';
      var caption = captionInput ? captionInput.value.trim() : '';
      var html = layout === 'carousel' ? buildArticleCarouselHtml([url], caption) : buildArticleFigureHtml(url, layout, caption);
      insertArticleHtmlAtCursor(html);
      toggleArticleImagePanel(false);
      setArticleSaveStatus('Image inserted', false, true);
    };
    container.appendChild(img);
  });
}

function clearImageUploadQueue() {
  imageUploadQueue.forEach(function(item) {
    if (item && item.objUrl) URL.revokeObjectURL(item.objUrl);
  });
  imageUploadQueue = [];
  var preview = document.getElementById('imageUploadPreview');
  if (preview) preview.innerHTML = '';
  var uploadInput = document.getElementById('imageUploadFileInput');
  if (uploadInput) uploadInput.value = '';
}

function toggleArticleCarouselInput() {
  var layoutInput = document.getElementById('imageOverlayLayout');
  var captionInput = document.getElementById('imageOverlayCaption');
  if (!layoutInput || !captionInput) return;
  captionInput.placeholder = layoutInput.value === 'carousel' ? 'Optional carousel caption' : 'Optional caption';
}

function insertArticleImageBlock() {
  var layoutInput = document.getElementById('imageOverlayLayout');
  var captionInput = document.getElementById('imageOverlayCaption');
  if (!layoutInput) return;
  var layout = layoutInput.value || 'full';
  var caption = captionInput ? captionInput.value.trim() : '';

  var queued = imageUploadQueue.filter(function(item) { return item !== null; });
  if (!queued.length) {
    setArticleSaveStatus('Upload at least one image first', true);
    return;
  }

  setArticleSaveStatus('Uploading images...', false);

  var promises = queued.map(function(item) {
    if (item.url) return Promise.resolve(item.url);
    return uploadImage(item.file).then(function(url) {
      item.url = url;
      articleState.recentImages = articleState.recentImages || [];
      if (articleState.recentImages.indexOf(url) === -1) articleState.recentImages.unshift(url);
      if (articleState.recentImages.length > 20) articleState.recentImages.length = 20;
      return url;
    });
  });

  Promise.all(promises).then(function(urls) {
    var html;
    if (layout === 'carousel') {
      html = buildArticleCarouselHtml(urls, caption);
    } else {
      html = buildArticleFigureHtml(urls[0], layout, caption);
    }
    clearImageUploadQueue();
    if (insertArticleHtmlAtCursor(html)) {
      setArticleSaveStatus('Image inserted', false, true);
      if (captionInput) captionInput.value = '';
      toggleArticleImagePanel(false);
    } else {
      setArticleSaveStatus('Could not insert image', true);
    }
  }).catch(function(err) {
    setArticleSaveStatus('Upload failed: ' + err.message, true);
  });
}

function buildArticleFigureHtml(url, layout, caption) {
  var modifier = 'article-media--full';
  if (layout === 'left') modifier = 'article-media--float-left';
  if (layout === 'right') modifier = 'article-media--float-right';
  var html = '<figure class="article-media ' + modifier + '"><img src="' + escAttr(url) + '" alt="' + escAttr(caption || 'Article image') + '">';
  if (caption) html += '<figcaption>' + esc(caption) + '</figcaption>';
  html += '</figure><p></p>';
  return html;
}

function buildArticleCarouselHtml(urls, caption) {
  articleState.carouselSeed += 1;
  var carouselId = 'article-carousel-' + Date.now() + '-' + articleState.carouselSeed;
  var isSingle = urls.length <= 1;
  var slides = '';
  var thumbs = '';
  urls.forEach(function(url, idx) {
    var activeClass = idx === 0 ? ' is-active' : '';
    slides += '<div class="carousel-slide' + activeClass + '"><img src="' + escAttr(url) + '" alt="' + escAttr(caption || ('Carousel image ' + (idx + 1))) + '"></div>';
    thumbs += '<button type="button" class="carousel-thumb' + activeClass + '" onclick="changeCarouselSlide(&quot;' + carouselId + '&quot;, ' + idx + ')"><img src="' + escAttr(url) + '" alt="Thumbnail ' + (idx + 1) + '"></button>';
  });
  var navHtml = '';
  if (!isSingle) {
    navHtml = '<button type="button" class="carousel-nav prev" onclick="moveCarouselSlide(&quot;' + carouselId + '&quot;, -1)">&#10094;</button><button type="button" class="carousel-nav next" onclick="moveCarouselSlide(&quot;' + carouselId + '&quot;, 1)">&#10095;</button>';
  }
  var thumbHtml = !isSingle ? '<div class="article-carousel-thumbs">' + thumbs + '</div>' : '';
  var html = '<div id="' + carouselId + '" class="article-carousel article-media article-media--full' + (isSingle ? ' is-single' : '') + '" data-article-carousel data-current-slide="0"><div class="article-carousel-main"><div class="article-carousel-slides">' + slides + '</div>' + navHtml + '</div>' + thumbHtml;
  if (caption) html += '<div class="carousel-caption">' + esc(caption) + '</div>';
  html += '</div><p></p>';
  return html;
}

function changeCarouselSlide(carouselId, newIndex) {
  var carousel = document.getElementById(carouselId);
  if (!carousel) return;
  var slides = carousel.querySelectorAll('.carousel-slide');
  var thumbs = carousel.querySelectorAll('.carousel-thumb');
  if (!slides.length) return;
  var safeIndex = Math.max(0, Math.min(newIndex, slides.length - 1));
  carousel.setAttribute('data-current-slide', String(safeIndex));
  for (var i = 0; i < slides.length; i++) {
    slides[i].classList.toggle('is-active', i === safeIndex);
  }
  for (var j = 0; j < thumbs.length; j++) {
    thumbs[j].classList.toggle('is-active', j === safeIndex);
  }
}

// Intercept clicks on carousel buttons inside contenteditable
document.addEventListener('mousedown', function(e) {
  var btn = e.target.closest('.article-carousel .carousel-nav,.article-carousel .carousel-thumb');
  if (btn) { e.preventDefault(); }
});

function moveCarouselSlide(carouselId, delta) {
  var carousel = document.getElementById(carouselId);
  if (!carousel) return;
  var slides = carousel.querySelectorAll('.carousel-slide');
  if (!slides.length) return;
  var current = parseInt(carousel.getAttribute('data-current-slide') || '0', 10);
  var next = current + delta;
  if (next < 0) next = slides.length - 1;
  if (next >= slides.length) next = 0;
  changeCarouselSlide(carouselId, next);
}

function insertArticleHtmlAtCursor(html) {
  if (isArticleMarkdownMode()) {
    var markdownInput = document.getElementById('articleBodyMarkdownInput');
    if (!markdownInput) return false;
    var markdownChunk = articleHtmlToMarkdown(html);
    if (markdownChunk) insertTextIntoTextarea(markdownInput, markdownChunk + '\n\n');
    articleState.markdownDraft = markdownInput.value;
    articleState.current.body = markdownToArticleHtml(markdownInput.value);
    return true;
  }
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return false;
  editor.focus();
  restoreEditorSelection();
  var inserted = false;
  var isComplex = html.indexOf('article-carousel') !== -1 || html.indexOf('data-article') !== -1 || html.indexOf('onclick=') !== -1;
  if (!isComplex && document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
    inserted = document.execCommand('insertHTML', false, html);
  }
  if (!inserted) {
    var sel = window.getSelection();
    if (!sel) return false;
    var range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    var container = document.createElement('div');
    container.innerHTML = html;
    var frag = document.createDocumentFragment();
    var node;
    var lastNode = null;
    while ((node = container.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.deleteContents();
    range.insertNode(frag);
    if (lastNode) {
      range = range.cloneRange();
      range.setStartAfter(lastNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
  saveEditorSelection();
  captureCurrentArticleDraft();
  return true;
}

function buildArticlePayload() {
  captureCurrentArticleDraft();
  return {
    title: articleState.current.title,
    url_id: articleState.current.url_id,
    author: articleState.current.author,
    excerpt: articleState.current.excerpt,
    body: articleState.current.body,
    categories: articleState.current.categories,
    tags: articleState.current.tags,
    publish_date: articleState.current.publish_date || nowAsLocalDateTime(),
    status: articleState.current.status || 'draft'
  };
}

function saveCurrentArticle() {
  if (!articleState.current) return;
  var payload = buildArticlePayload();
  if (!payload.title || !payload.url_id) {
    setArticleSaveStatus('Title and slug are required before saving', true);
    return;
  }
  setArticleSaveStatus('Saving article...', false);
  var savePromise;
  if (articleState.current.id) {
    savePromise = apiPut('/admin/articles/' + articleState.current.id, payload);
  } else {
    savePromise = apiPost('/admin/articles', payload);
  }
  savePromise.then(function() {
    setArticleSaveStatus('Article saved', false, true);
    clearLocalDraft();
    refreshArticleListAfterSave(payload.url_id, articleState.current.id);
  }).catch(function(err) {
    setArticleSaveStatus('Save failed: ' + err.message, true);
  });
}

function refreshArticleListAfterSave(savedSlug, existingId) {
  apiGet('/admin/articles').then(function(data) {
    articleState.list = (data.articles || []).map(normalizeArticle);
    var searchInput = document.getElementById('articleSearchInput');
    filterArticleList(searchInput ? searchInput.value : '');
    if (existingId) {
      selectArticleFromList(existingId);
      return;
    }
    var created = articleState.list.find(function(a) { return a.url_id === savedSlug; });
    if (created) {
      selectArticleFromList(created.id);
    } else {
      renderArticleWorkspace();
    }
  });
}

function deleteCurrentArticle() {
  if (!articleState.current || !articleState.current.id) return;
  if (!confirm('Delete this article?')) return;
  var id = articleState.current.id;
  apiDelete('/admin/articles/' + id).then(function() {
    setArticleSaveStatus('Article deleted', false, true);
    articleState.current = null;
    articleState.selectedId = null;
    return apiGet('/admin/articles');
  }).then(function(data) {
    articleState.list = (data.articles || []).map(normalizeArticle);
    filterArticleList(document.getElementById('articleSearchInput') ? document.getElementById('articleSearchInput').value : '');
    if (articleState.list.length) selectArticleFromList(articleState.list[0].id);
    else startNewArticle();
  }).catch(function(err) {
    setArticleSaveStatus('Delete failed: ' + err.message, true);
  });
}

// ===== KEYBOARD SHORTCUTS =====
function ensureKeyboardShortcuts(editor) {
  if (!editor || editor.dataset.shortcutsBound) return;
  editor.addEventListener('keydown', function(e) {
    var ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    var key = e.key.toLowerCase();
    if (key === 'b') { e.preventDefault(); applyArticleFormat('bold'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
    if (key === 'i') { e.preventDefault(); applyArticleFormat('italic'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
    if (key === 'u') { e.preventDefault(); applyArticleFormat('underline'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
    if (key === 'k') { e.preventDefault(); insertArticleLink(); takeImmediateUndoSnapshot(); return; }
    if (key === 'z') {
      if (e.shiftKey) { e.preventDefault(); redo(); return; }
      e.preventDefault(); undo(); return;
    }
    if (key === 'y') { e.preventDefault(); redo(); return; }
    if (e.shiftKey && key === 'x') { e.preventDefault(); applyArticleFormat('strikeThrough'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
    if (e.shiftKey && key === '7') { e.preventDefault(); executeArticleEditorCommand('insertOrderedList'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
    if (e.shiftKey && key === '8') { e.preventDefault(); executeArticleEditorCommand('insertUnorderedList'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
    if (e.altKey) {
      if (key === '0') { e.preventDefault(); executeArticleEditorCommand('formatBlock', 'p'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
      if (key === '1') { e.preventDefault(); executeArticleEditorCommand('formatBlock', 'H1'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
      if (key === '2') { e.preventDefault(); executeArticleEditorCommand('formatBlock', 'H2'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
      if (key === '3') { e.preventDefault(); executeArticleEditorCommand('formatBlock', 'H3'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
      if (key === '4') { e.preventDefault(); executeArticleEditorCommand('formatBlock', 'H4'); takeImmediateUndoSnapshot(); updateToolbarState(); return; }
    }
    if (key === 'f') { e.preventDefault(); openFindReplaceBar(); return; }
    if (key === '/') { e.preventDefault(); showKeyboardShortcutsHelp(); return; }
  });
  editor.dataset.shortcutsBound = '1';
}

// ===== UNDO / REDO =====
function serializeSelection() {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  var range = sel.getRangeAt(0);
  var editor = document.getElementById('articleBodyEditor');
  if (!editor || !editor.contains(range.commonAncestorContainer)) return null;
  try {
    return {
      anchorPath: getNodePath(range.anchorNode, editor),
      anchorOffset: range.anchorOffset,
      focusPath: getNodePath(range.focusNode, editor),
      focusOffset: range.focusOffset
    };
  } catch(e) { return null; }
}

function deserializeSelection(data) {
  if (!data) return false;
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return false;
  try {
    var anchorNode = restoreNodePath(data.anchorPath, editor);
    var focusNode = restoreNodePath(data.focusPath, editor);
    if (!anchorNode || !focusNode) return false;
    var range = document.createRange();
    range.setStart(anchorNode, Math.min(data.anchorOffset, anchorNode.textContent ? anchorNode.textContent.length : 0));
    range.setEnd(focusNode, Math.min(data.focusOffset, focusNode.textContent ? focusNode.textContent.length : 0));
    var sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch(e) { return false; }
}

function getNodePath(node, root) {
  var path = [];
  var current = node;
  while (current && current !== root) {
    var parent = current.parentNode;
    if (!parent) break;
    var index = Array.prototype.indexOf.call(parent.childNodes, current);
    path.unshift(index);
    current = parent;
  }
  return path;
}

function restoreNodePath(path, root) {
  var node = root;
  for (var i = 0; i < path.length; i++) {
    if (node.childNodes[path[i]]) node = node.childNodes[path[i]];
    else return null;
  }
  return node;
}

function pushUndoSnapshot(force) {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  var html = editor.innerHTML;
  if (!force && articleState.undoStack.length && articleState.undoStack[articleState.undoStack.length - 1].html === html) return;
  var sel = serializeSelection();
  articleState.undoStack.push({ html: html, selection: sel });
  if (articleState.undoStack.length > 50) articleState.undoStack.shift();
  articleState.redoStack = [];
}

function takeImmediateUndoSnapshot() {
  pushUndoSnapshot(true);
}

function handleBackspaceDeleteBlock(e) {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  restoreEditorSelection();
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  if (!range.collapsed) return;
  var node = range.startContainer;
  var offset = range.startOffset;
  if (node.nodeType === 3 && offset === 0) node = node.parentElement;
  if (!node || node === editor) return;

  /* If we're at the very start of an element (e.g., a <p> right after a carousel) */
  var prev = node.previousElementSibling;
  if (!prev) {
    /* Check if node is a <p> that's first child after a carousel */
    if (node.nodeType === 1 && node.tagName === 'P' && !node.textContent.trim()) {
      prev = node.previousElementSibling;
    }
    if (!prev && node.parentElement && node.parentElement !== editor) {
      prev = node.parentElement.previousElementSibling;
    }
  }

  var block = prev && prev.closest ? prev.closest('.article-carousel,.article-media,.article-callout,.article-pullquote,.article-spacer,.article-cta,.article-divider,.article-table,.article-embed') : null;
  if (!block) return;

  e.preventDefault();
  /* Delete the empty paragraph after the block too */
  if (node.nodeType === 1 && node.tagName === 'P' && !node.textContent.trim() && node.previousElementSibling === block) {
    node.parentElement.removeChild(node);
  }
  block.parentElement.removeChild(block);
  takeImmediateUndoSnapshot();
  captureCurrentArticleDraft();
}

function scheduleUndoSnapshot() {
  if (undoScheduleTimer) clearTimeout(undoScheduleTimer);
  undoScheduleTimer = setTimeout(function() {
    undoScheduleTimer = null;
    pushUndoSnapshot(false);
  }, 300);
}

function undo() {
  if (!articleState.undoStack.length) return;
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  var current = { html: editor.innerHTML, selection: serializeSelection() };
  articleState.redoStack.push(current);
  var snapshot = articleState.undoStack.pop();
  editor.innerHTML = snapshot.html;
  deserializeSelection(snapshot.selection);
  captureCurrentArticleDraft();
  updateWordCount();
}

function redo() {
  if (!articleState.redoStack.length) return;
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  var current = { html: editor.innerHTML, selection: serializeSelection() };
  articleState.undoStack.push(current);
  var snapshot = articleState.redoStack.pop();
  editor.innerHTML = snapshot.html;
  deserializeSelection(snapshot.selection);
  captureCurrentArticleDraft();
  updateWordCount();
}

// ===== PASTE SANITISATION =====
function sanitizePastedContent(e) {
  e.preventDefault();
  var clipboardData = e.clipboardData || window.clipboardData;
  var pastedHtml = clipboardData && clipboardData.getData('text/html');
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;

  if (pastedHtml) {
    var temp = document.createElement('div');
    temp.innerHTML = pastedHtml;
    walkAndSanitize(temp, editor);
    var sanitizedHtml = temp.innerHTML;
    var sel = window.getSelection();
    if (sel && sel.rangeCount) {
      sel.getRangeAt(0).deleteContents();
      editor.focus();
      document.execCommand('insertHTML', false, sanitizedHtml);
    }
  } else {
    var text = clipboardData && clipboardData.getData('text/plain');
    if (text) {
      editor.focus();
      document.execCommand('insertText', false, text);
    }
  }
  saveEditorSelection();
  captureCurrentArticleDraft();
}

function walkAndSanitize(node, editor) {
  var walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, null, false);
  var nodesToUnwrap = [];
  var nodesToRemove = [];

  while (walker.nextNode()) {
    var el = walker.currentNode;
    if (el.nodeType !== 1) continue;
    var tag = el.tagName.toLowerCase();
    if (tag === 'font' || tag === 'span') {
      el.removeAttribute('style');
      el.removeAttribute('class');
      el.removeAttribute('id');
      var hasAttrs = el.attributes && el.attributes.length > 0;
      var isStyling = tag === 'font';
      if (!hasAttrs || isStyling) {
        nodesToUnwrap.push(el);
        continue;
      }
    }
    el.removeAttribute('style');
    if (el.className && typeof el.className === 'string') {
      var classes = el.className.split(/\s+/).filter(function(c) {
        return c.startsWith('article-') || c === 'carousel-slide' || c === 'carousel-thumb' || c === 'carousel-nav';
      });
      el.className = classes.join(' ');
    }
  }

  for (var i = 0; i < nodesToUnwrap.length; i++) {
    var n = nodesToUnwrap[i];
    if (!n.parentNode) continue;
    while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n);
    n.parentNode.removeChild(n);
  }
}

// ===== LINK POPOVER =====
function setupLinkPopover(editor) {
  var popover = document.getElementById('editorLinkPopover');
  if (popover) return;
  popover = document.createElement('div');
  popover.id = 'editorLinkPopover';
  popover.className = 'editor-link-popover';
  popover.innerHTML = '<input id="editorLinkUrlInput" type="text" placeholder="https://..." class="article-input"><button onclick="editorLinkPopoverChange()">Change</button><button onclick="editorLinkPopoverOpen()">Open</button><button onclick="editorLinkPopoverRemove()">Remove</button>';
  popover.style.display = 'none';
  document.body.appendChild(popover);

  popover.addEventListener('mousedown', function(e) { e.preventDefault(); });

  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link || link.classList.contains('article-cta')) { hideLinkPopover(); return; }
    var editor = document.getElementById('articleBodyEditor');
    if (!editor || !editor.contains(link)) { hideLinkPopover(); return; }
    showLinkPopover(link);
  });

  document.addEventListener('mousedown', function(e) {
    if (popover.style.display !== 'none' && !popover.contains(e.target) && !e.target.closest('a')) {
      setTimeout(hideLinkPopover, 50);
    }
  });
}

function showLinkPopover(link) {
  var popover = document.getElementById('editorLinkPopover');
  if (!popover) return;
  var urlInput = document.getElementById('editorLinkUrlInput');
  if (urlInput) urlInput.value = link.getAttribute('href') || '';
  popover._activeLink = link;
  var rect = link.getBoundingClientRect();
  popover.style.display = 'flex';
  popover.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
  popover.style.top = (rect.bottom + 6) + 'px';
}

function hideLinkPopover() {
  var popover = document.getElementById('editorLinkPopover');
  if (popover) { popover.style.display = 'none'; popover._activeLink = null; }
}

function editorLinkPopoverChange() {
  var popover = document.getElementById('editorLinkPopover');
  var urlInput = document.getElementById('editorLinkUrlInput');
  if (!popover || !popover._activeLink || !urlInput) return;
  var url = urlInput.value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('#')) url = 'https://' + url;
  popover._activeLink.setAttribute('href', url);
  hideLinkPopover();
  takeImmediateUndoSnapshot();
  captureCurrentArticleDraft();
}

function editorLinkPopoverOpen() {
  var popover = document.getElementById('editorLinkPopover');
  if (!popover || !popover._activeLink) return;
  var href = popover._activeLink.getAttribute('href');
  if (href) window.open(href, '_blank');
  hideLinkPopover();
}

function editorLinkPopoverRemove() {
  var popover = document.getElementById('editorLinkPopover');
  if (!popover || !popover._activeLink) return;
  var link = popover._activeLink;
  var text = link.textContent;
  var textNode = document.createTextNode(text);
  link.parentNode.replaceChild(textNode, link);
  hideLinkPopover();
  takeImmediateUndoSnapshot();
  captureCurrentArticleDraft();
}

// ===== IMAGE CLICK-TO-EDIT =====
function setupImageClickToEdit(editor) {
  if (editor.dataset.imageEditBound) return;
  editor.addEventListener('click', function(e) {
    var fig = e.target.closest('.article-media');
    if (!fig) { removeImageResizeHandles(); return; }
    if (e.target.closest('.image-resize-dot') || e.target.closest('.image-rotation-handle') || e.target.closest('.image-alignment-bar') || e.target.closest('.image-alt-input')) return;
    showImageResizeHandles(fig);
  });
  editor.dataset.imageEditBound = '1';
}

function showImageResizeHandles(fig) {
  removeImageResizeHandles();
  fig.classList.add('editing');
  var handles = ['nw','n','ne','e','se','s','sw','w'];
  handles.forEach(function(pos) {
    var h = document.createElement('div');
    h.className = 'image-resize-dot ' + pos;
    h.addEventListener('mousedown', function(e) { startImageResize(e, fig, pos); });
    fig.appendChild(h);
  });

  var rotHandle = document.createElement('div');
  rotHandle.className = 'image-rotation-handle';
  rotHandle.addEventListener('mousedown', function(e) { startImageRotate(e, fig); });
  fig.appendChild(rotHandle);

  var alignment = document.createElement('div');
  alignment.className = 'image-alignment-bar';
  alignment.innerHTML = '<button onclick="setImageAlignment(this.parentElement.parentElement, &apos;full&apos;)">Full</button><button onclick="setImageAlignment(this.parentElement.parentElement, &apos;left&apos;)">Left</button><button onclick="setImageAlignment(this.parentElement.parentElement, &apos;right&apos;)">Right</button>';
  fig.appendChild(alignment);

  var img = fig.querySelector('img');
  if (img && !fig.querySelector('.image-alt-input')) {
    var altInput = document.createElement('input');
    altInput.className = 'image-alt-input article-input';
    altInput.value = img.getAttribute('alt') || '';
    altInput.placeholder = 'Alt text...';
    altInput.addEventListener('input', function() { img.setAttribute('alt', this.value); });
    fig.appendChild(altInput);
  }

  var caption = fig.querySelector('figcaption');
  if (caption) caption.contentEditable = 'true';
}

function removeImageResizeHandles() {
  document.querySelectorAll('#articleBodyEditor .editing').forEach(function(el) { el.classList.remove('editing'); });
  document.querySelectorAll('#articleBodyEditor .image-resize-dot,#articleBodyEditor .image-rotation-handle,#articleBodyEditor .image-alignment-bar,#articleBodyEditor .image-alt-input').forEach(function(el) { el.remove(); });
  var captions = document.querySelectorAll('#articleBodyEditor figcaption');
  captions.forEach(function(c) { c.contentEditable = 'false'; });
}

function setImageAlignment(fig, alignment) {
  fig.classList.remove('article-media--full','article-media--float-left','article-media--float-right');
  if (alignment === 'left') fig.classList.add('article-media--float-left');
  else if (alignment === 'right') fig.classList.add('article-media--float-right');
  else fig.classList.add('article-media--full');
  takeImmediateUndoSnapshot();
  captureCurrentArticleDraft();
}

var imageResizeState = null;
function startImageResize(e, fig, pos) {
  e.preventDefault();
  var img = fig.querySelector('.carousel-slide.is-active img') || fig.querySelector('img');
  if (!img) return;
  imageResizeState = {
    fig: fig, img: img, pos: pos,
    startX: e.clientX, startY: e.clientY,
    startWidth: img.offsetWidth, startHeight: img.offsetHeight,
    isCarousel: !!fig.classList.contains('article-carousel')
  };
  document.addEventListener('mousemove', onImageResizeMove);
  document.addEventListener('mouseup', onImageResizeEnd);
}

function onImageResizeMove(e) {
  if (!imageResizeState) return;
  var s = imageResizeState;
  var dx = e.clientX - s.startX;
  var dy = e.clientY - s.startY;
  var aspect = s.startHeight / s.startWidth;
  var pos = s.pos;
  var newWidth = s.startWidth;
  var newHeight = s.startHeight;
  if (pos.includes('e')) newWidth = Math.max(50, s.startWidth + dx);
  if (pos.includes('w')) newWidth = Math.max(50, s.startWidth - dx);
  if (pos.includes('s')) newHeight = Math.max(30, s.startHeight + dy);
  if (pos.includes('n')) newHeight = Math.max(30, s.startHeight - dy);
  if (['nw','ne','sw','se'].indexOf(pos) !== -1) newHeight = newWidth * aspect;
  s.img.style.width = newWidth + 'px';
  s.img.style.height = newHeight + 'px';
  if (s.isCarousel) {
    var allImgs = s.fig.querySelectorAll('.carousel-slide img');
    for (var k = 0; k < allImgs.length; k++) {
      if (allImgs[k] !== s.img) {
        allImgs[k].style.width = newWidth + 'px';
        allImgs[k].style.height = newHeight + 'px';
      }
    }
  }
}

function onImageResizeEnd() {
  document.removeEventListener('mousemove', onImageResizeMove);
  document.removeEventListener('mouseup', onImageResizeEnd);
  if (imageResizeState) { takeImmediateUndoSnapshot(); captureCurrentArticleDraft(); }
  imageResizeState = null;
}

// ===== IMAGE ROTATION =====
var imageRotateState = null;
function startImageRotate(e, fig) {
  e.preventDefault();
  e.stopPropagation();
  var img = fig.querySelector('img');
  if (!img) return;
  var currentRot = parseFloat(img.dataset.rotation || '0');
  var rect = img.getBoundingClientRect();
  var cx = rect.left + rect.width / 2;
  var cy = rect.top + rect.height / 2;
  var startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
  imageRotateState = { img: img, cx: cx, cy: cy, startAngle: startAngle, currentRot: currentRot };
  document.addEventListener('mousemove', onImageRotateMove);
  document.addEventListener('mouseup', onImageRotateEnd);
}

function onImageRotateMove(e) {
  if (!imageRotateState) return;
  var s = imageRotateState;
  var angle = Math.atan2(e.clientY - s.cy, e.clientX - s.cx) * (180 / Math.PI);
  var delta = angle - s.startAngle;
  var newRot = Math.round((s.currentRot + delta) / 15) * 15;
  s.img.style.transform = 'rotate(' + newRot + 'deg)';
  s.img.dataset.rotation = newRot;
}

function onImageRotateEnd() {
  document.removeEventListener('mousemove', onImageRotateMove);
  document.removeEventListener('mouseup', onImageRotateEnd);
  if (imageRotateState) { takeImmediateUndoSnapshot(); captureCurrentArticleDraft(); }
  imageRotateState = null;
}

// ===== EMBED DIALOG =====
function showEmbedDialog() {
  var url = prompt('Enter YouTube or Spotify URL');
  if (!url) return;
  url = url.trim();
  var iframe = buildEmbedIframe(url);
  if (!iframe) { alert('Unsupported URL. Use YouTube (youtube.com/watch?v= or youtu.be/) or Spotify (open.spotify.com/track/ or /album/)'); return; }
  var html = '<div class="article-embed">' + iframe + '</div><p></p>';
  insertArticleHtmlAtCursor(html);
  setArticleSaveStatus('Embed inserted', false, true);
  takeImmediateUndoSnapshot();
}

function buildEmbedIframe(url) {
  var youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    return '<iframe src="https://www.youtube.com/embed/' + youtubeMatch[1] + '" allowfullscreen></iframe>';
  }
  var spotifyMatch = url.match(/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) {
    return '<iframe src="https://open.spotify.com/embed/' + spotifyMatch[1] + '/' + spotifyMatch[2] + '" allowfullscreen></iframe>';
  }
  return null;
}

// ===== GOOGLE DOCS IMPORT =====
function showGdocImportDialog() {
  var backdrop = document.getElementById('articleGdocImportOverlayBackdrop');
  var panel = document.getElementById('articleGdocImportPanel');
  if (!backdrop || !panel) return;
  var urlInput = document.getElementById('gdocImportUrlInput');
  var statusEl = document.getElementById('gdocImportStatus');
  if (urlInput) urlInput.value = '';
  if (statusEl) statusEl.textContent = '';
  backdrop.classList.add('active');
  panel.classList.add('active');
  setTimeout(function() { if (urlInput) urlInput.focus(); }, 100);
}

function closeGdocImportDialog() {
  var backdrop = document.getElementById('articleGdocImportOverlayBackdrop');
  var panel = document.getElementById('articleGdocImportPanel');
  if (backdrop) backdrop.classList.remove('active');
  if (panel) panel.classList.remove('active');
}

function importGdoc() {
  var urlInput = document.getElementById('gdocImportUrlInput');
  var statusEl = document.getElementById('gdocImportStatus');
  var btn = document.getElementById('gdocImportBtn');
  if (!urlInput) return;
  var url = urlInput.value.trim();
  if (!url) {
    if (statusEl) { statusEl.textContent = 'Please enter a Google Docs URL'; statusEl.style.color = '#e74c3c'; }
    return;
  }
  if (!url.match(/\/d\/([a-zA-Z0-9_-]+)/)) {
    if (statusEl) { statusEl.textContent = 'Invalid URL. Expected format: https://docs.google.com/document/d/DOC_ID/edit'; statusEl.style.color = '#e74c3c'; }
    return;
  }
  if (statusEl) { statusEl.textContent = 'Fetching document...'; statusEl.style.color = '#888'; }
  if (btn) btn.disabled = true;
  apiPost('/admin/import-gdoc', { url: url }).then(function(r) {
    if (!r.ok) return r.json().then(function(err) { throw new Error(err.error || 'Import failed'); });
    return r.json();
  }).then(function(data) {
    var rawHtml = data.html;
    var cleanHtml = sanitizeGdocHtml(rawHtml);
    insertArticleHtmlAtCursor(cleanHtml);
    closeGdocImportDialog();
    setArticleSaveStatus('Document imported from Google Docs', false, true);
    takeImmediateUndoSnapshot();
  }).catch(function(err) {
    if (statusEl) { statusEl.textContent = err.message; statusEl.style.color = '#e74c3c'; }
  }).finally(function() {
    if (btn) btn.disabled = false;
  });
}

function sanitizeGdocHtml(html) {
  var container = document.createElement('div');
  container.innerHTML = html;
  var walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null, false);
  var nodesToUnwrap = [];
  var nodesToRemove = [];
  while (walker.nextNode()) {
    var el = walker.currentNode;
    if (el.nodeType !== 1) continue;
    el.removeAttribute('style');
    el.removeAttribute('id');
    el.removeAttribute('data-*');
    var tag = el.tagName.toLowerCase();
    if (tag === 'font' || tag === 'span') {
      var hasAttrs = false;
      for (var a = 0; a < (el.attributes || []).length; a++) {
        if (el.attributes[a].name !== 'style') { hasAttrs = true; break; }
      }
      if (!hasAttrs || tag === 'font') {
        nodesToUnwrap.push(el);
        continue;
      }
    }
    if (tag === 'meta' || tag === 'link' || tag === 'style' || tag === 'script' || tag === 'title') {
      nodesToRemove.push(el);
      continue;
    }
    if (el.className && typeof el.className === 'string') {
      el.className = '';
    }
  }
  for (var i = 0; i < nodesToUnwrap.length; i++) {
    var n = nodesToUnwrap[i];
    if (!n.parentNode) continue;
    while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n);
    n.parentNode.removeChild(n);
  }
  for (var j = 0; j < nodesToRemove.length; j++) {
    var m = nodesToRemove[j];
    if (m.parentNode) m.parentNode.removeChild(m);
  }
  var bodyEl = container.querySelector('body');
  if (bodyEl) return bodyEl.innerHTML;
  return container.innerHTML;
}

// ===== WORD COUNT =====
var wordCountTimer = null;
function updateWordCountDebounced() {
  if (wordCountTimer) clearTimeout(wordCountTimer);
  wordCountTimer = setTimeout(function() { wordCountTimer = null; updateWordCount(); }, 500);
}

function updateWordCount() {
  var editor = document.getElementById('articleBodyEditor');
  var statusBar = document.getElementById('articleEditorStatusBar');
  if (!editor || !statusBar) return;
  var text = (editor.textContent || '').trim();
  var words = text ? text.split(/\s+/).length : 0;
  var chars = text.length;
  statusBar.textContent = 'Words: ' + words + ' â€¢ Characters: ' + chars;
}

// ===== AUTO-SAVE =====
var autoSaveTimer = null;
var autoSaveDirty = false;

function markDirty() {
  autoSaveDirty = true;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSave, 3000);
}

function autoSave() {
  if (!autoSaveDirty) return;
  if (!articleState.current) return;
  captureCurrentArticleDraft();
  var payload = buildArticlePayload();
  if (!payload.title || !payload.url_id) {
    saveLocalDraft(payload.body);
    return;
  }
  var savePromise;
  if (articleState.current.id) {
    savePromise = apiPut('/admin/articles/' + articleState.current.id, payload);
  } else {
    savePromise = apiPost('/admin/articles', payload);
  }
  savePromise.then(function() {
    autoSaveDirty = false;
    setArticleSaveStatus('Auto-saved', false, true);
    clearLocalDraft();
    setTimeout(function() { var el = document.getElementById('articleSaveStatus'); if (el && el.textContent === 'Auto-saved') el.textContent = ''; }, 2000);
  }).catch(function() {
    saveLocalDraft(payload.body);
    setArticleSaveStatus('Auto-save failed â€” draft stored locally', true);
  });
}

function saveLocalDraft(body) {
  if (!articleState.current) return;
  var id = articleState.current.id || articleState.current.url_id || 'new';
  try { localStorage.setItem('feats_draft_' + id, body || ''); } catch(e) {}
}

function clearLocalDraft() {
  if (!articleState.current) return;
  var id = articleState.current.id || articleState.current.url_id || 'new';
  try { localStorage.removeItem('feats_draft_' + id); } catch(e) {}
}

function checkLocalDraft() {
  if (!articleState.current) return;
  var id = articleState.current.id || articleState.current.url_id || 'new';
  try {
    var draft = localStorage.getItem('feats_draft_' + id);
    if (draft && draft !== articleState.current.body) {
      if (confirm('A local draft exists from ' + (articleState.current.id ? 'a previous autosave' : 'before saving') + '. Do you want to restore it?')) {
        var editor = document.getElementById('articleBodyEditor');
        if (editor) editor.innerHTML = draft;
        articleState.current.body = draft;
        captureCurrentArticleDraft();
        setArticleSaveStatus('Local draft restored', false, true);
      }
    }
  } catch(e) {}
}

// ===== FULLSCREEN MODE =====
function toggleEditorFullscreen() {
  var btn = document.getElementById('editorFullscreenBtn');
  var isFullscreen = document.body.classList.toggle('editor-fullscreen');
  if (btn) btn.textContent = isFullscreen ? 'Exit fullscreen' : 'Fullscreen';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && document.body.classList.contains('editor-fullscreen')) {
    document.body.classList.remove('editor-fullscreen');
    var btn = document.getElementById('editorFullscreenBtn');
    if (btn) btn.textContent = 'Fullscreen';
  }
});

// ===== FIND & REPLACE =====
function openFindReplaceBar() {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor) return;
  var bar = document.getElementById('editorFindBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'editorFindBar';
    bar.className = 'editor-find-bar';
    bar.innerHTML = '<input id="editorFindInput" placeholder="Find..." oninput="findInEditor()"><input id="editorReplaceInput" placeholder="Replace..."><button onclick="findInEditor(-1)">â–²</button><button onclick="findInEditor(1)">â–¼</button><button onclick="replaceOne()">Replace</button><button onclick="replaceAll()">Replace All</button><button onclick="closeFindReplaceBar()">Done</button>';
    var editorBody = document.getElementById('articleEditorBody');
    if (editorBody) editorBody.insertBefore(bar, editorBody.firstChild);
  }
  bar.classList.add('active');
  document.getElementById('editorFindInput').focus();
  document.addEventListener('keydown', findReplaceKeyHandler);
}

function closeFindReplaceBar() {
  var bar = document.getElementById('editorFindBar');
  if (bar) bar.classList.remove('active');
  clearFindHighlights();
  document.removeEventListener('keydown', findReplaceKeyHandler);
}

function findReplaceKeyHandler(e) {
  if (e.key === 'Escape') { closeFindReplaceBar(); return; }
  if (e.key === 'Enter') { findInEditor(1); e.preventDefault(); }
}

var findMatches = [];
var findIndex = -1;

function findInEditor(dir) {
  clearFindHighlights();
  var editor = document.getElementById('articleBodyEditor');
  var input = document.getElementById('editorFindInput');
  if (!editor || !input) return;
  var query = input.value;
  if (!query) { findMatches = []; findIndex = -1; return; }
  dir = dir || 1;
  findMatches = [];
  findIndex = -1;
  var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
  var regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  var offset = 0;
  var textNodes = [];
  while (walker.nextNode()) {
    var node = walker.currentNode;
    textNodes.push({ node: node, offset: offset });
    offset += node.textContent.length;
    var match;
    var text = node.textContent;
    var idx = 0;
    while ((match = regex.exec(text)) !== null) {
      findMatches.push({ node: node, start: match.index, end: match.index + match[0].length });
    }
  }
  if (!findMatches.length) return;
  if (dir === 1) {
    findIndex = 0;
  } else {
    findIndex = findMatches.length - 1;
  }
  highlightMatch(findIndex);
}

function highlightMatch(idx) {
  if (idx < 0 || idx >= findMatches.length) return;
  var m = findMatches[idx];
  var sel = window.getSelection();
  if (!sel) return;
  var range = document.createRange();
  range.setStart(m.node, m.start);
  range.setEnd(m.node, m.end);
  sel.removeAllRanges();
  sel.addRange(range);
  var editor = document.getElementById('articleBodyEditor');
  if (editor) editor.focus();
}

function clearFindHighlights() {
  var sel = window.getSelection();
  if (sel) sel.removeAllRanges();
}

function replaceOne() {
  if (!findMatches.length || findIndex < 0) return;
  var input = document.getElementById('editorReplaceInput');
  if (!input) return;
  var replacement = input.value;
  var m = findMatches[findIndex];
  m.node.textContent = m.node.textContent.slice(0, m.start) + replacement + m.node.textContent.slice(m.end);
  findInEditor(1);
  takeImmediateUndoSnapshot();
  captureCurrentArticleDraft();
}

function replaceAll() {
  var editor = document.getElementById('articleBodyEditor');
  var findInput = document.getElementById('editorFindInput');
  var replaceInput = document.getElementById('editorReplaceInput');
  if (!editor || !findInput || !replaceInput) return;
  var query = findInput.value;
  if (!query) return;
  var regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
  var count = 0;
  while (walker.nextNode()) {
    var node = walker.currentNode;
    if (regex.test(node.textContent)) {
      regex.lastIndex = 0;
      node.textContent = node.textContent.replace(regex, replaceInput.value);
      count++;
    }
  }
  setArticleSaveStatus('Replaced ' + count + ' occurrence(s)', false, true);
  takeImmediateUndoSnapshot();
  captureCurrentArticleDraft();
}

// ===== TABLE GRID PICKER =====
function showTableGridPicker() {
  var picker = document.getElementById('editorTablePicker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'editorTablePicker';
    picker.className = 'editor-table-picker';
    document.body.appendChild(picker);
  }
  var html = '';
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      html += '<div class="tp-cell" data-row="' + r + '" data-col="' + c + '" onmouseenter="highlightTablePickerCells(' + r + ',' + c + ')" onclick="insertTableFromPicker(' + (r + 1) + ',' + (c + 1) + ')"></div>';
    }
  }
  picker.innerHTML = html;
  picker.classList.add('active');
  picker.style.display = 'grid';

  var toolbar = document.querySelector('.editor-toolbar');
  if (toolbar) {
    var btn = toolbar.querySelector('[data-command="insertTable"]');
    if (btn) {
      var rect = btn.getBoundingClientRect();
      picker.style.left = rect.left + 'px';
      picker.style.top = (rect.bottom + 4) + 'px';
    }
  }

  document.addEventListener('click', closeTablePickerOnOutside);
}

function highlightTablePickerCells(row, col) {
  var picker = document.getElementById('editorTablePicker');
  if (!picker) return;
  var cells = picker.querySelectorAll('.tp-cell');
  cells.forEach(function(cell) {
    var r = parseInt(cell.getAttribute('data-row'));
    var c = parseInt(cell.getAttribute('data-col'));
    cell.classList.toggle('tp-highlight', r <= row && c <= col);
  });
}

function insertTableFromPicker(rows, cols) {
  var picker = document.getElementById('editorTablePicker');
  if (picker) { picker.classList.remove('active'); picker.style.display = 'none'; }
  document.removeEventListener('click', closeTablePickerOnOutside);

  var html = '<table class="article-table"><thead><tr>';
  for (var c = 0; c < cols; c++) html += '<th>Header</th>';
  html += '</tr></thead><tbody>';
  for (var r = 0; r < rows - 1; r++) {
    html += '<tr>';
    for (var c2 = 0; c2 < cols; c2++) html += '<td>Cell</td>';
    html += '</tr>';
  }
  html += '</tbody></table><p></p>';
  insertArticleHtmlAtCursor(html);
  takeImmediateUndoSnapshot();
  setArticleSaveStatus('Table inserted', false, true);
}

function closeTablePickerOnOutside(e) {
  var picker = document.getElementById('editorTablePicker');
  if (!picker || !picker.classList.contains('active')) return;
  if (!picker.contains(e.target)) {
    picker.classList.remove('active');
    picker.style.display = 'none';
    document.removeEventListener('click', closeTablePickerOnOutside);
  }
}

// ===== COPY AS MARKDOWN =====
function copyArticleAsMarkdown() {
  captureCurrentArticleDraft();
  var md = articleHtmlToMarkdown(articleState.current.body);
  navigator.clipboard.writeText(md).then(function() {
    setArticleSaveStatus('Markdown copied to clipboard', false, true);
  }).catch(function() {
    setArticleSaveStatus('Failed to copy', true);
  });
}

// ===== KEYBOARD SHORTCUT HELP =====
function showKeyboardShortcutsHelp() {
  var overlay = document.getElementById('editorShortcutsOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'editorShortcutsOverlay';
    overlay.className = 'editor-shortcuts-overlay';
    overlay.innerHTML = '<div class="editor-shortcuts-modal"><h3>Keyboard Shortcuts</h3><table><tr><td>Ctrl+B</td><td>Bold</td></tr><tr><td>Ctrl+I</td><td>Italic</td></tr><tr><td>Ctrl+U</td><td>Underline</td></tr><tr><td>Ctrl+Shift+X</td><td>Strikethrough</td></tr><tr><td>Ctrl+K</td><td>Insert link</td></tr><tr><td>Ctrl+Z</td><td>Undo</td></tr><tr><td>Ctrl+Y / Ctrl+Shift+Z</td><td>Redo</td></tr><tr><td>Ctrl+Shift+7</td><td>Ordered list</td></tr><tr><td>Ctrl+Shift+8</td><td>Bullet list</td></tr><tr><td>Ctrl+Alt+0</td><td>Normal text</td></tr><tr><td>Ctrl+Alt+1-4</td><td>Heading 1-4</td></tr><tr><td>Ctrl+F</td><td>Find & replace</td></tr><tr><td>Esc</td><td>Exit fullscreen</td></tr><tr><td>Ctrl+/</td><td>Show this help</td></tr></table><button onclick="closeShortcutsHelp()">Close</button></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeShortcutsHelp();
    });
  }
  overlay.style.display = 'flex';
}

function closeShortcutsHelp() {
  var overlay = document.getElementById('editorShortcutsOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ===== TABLE EDITING =====
document.addEventListener('click', function(e) {
  var editor = document.getElementById('articleBodyEditor');
  if (!editor || !editor.contains(e.target)) return;

  var td = e.target.closest('td,th');
  if (td) {
    document.querySelectorAll('#articleBodyEditor td.selected-cell,#articleBodyEditor th.selected-cell').forEach(function(el) { el.classList.remove('selected-cell'); });
    td.classList.add('selected-cell');
  }
});

// Override the original getArticleEditorHtml - this runs after admin.js, so the new version takes effect
// The HTML includes the full-screen button in the header
(function patchArticleEditorHeader() {
  var origRender = renderArticleWorkspace;
  if (!origRender) return;
  renderArticleWorkspace = function() {
    origRender();
    var headerRight = document.querySelector('.article-editor-header > div:last-child');
    if (headerRight && !document.getElementById('editorFullscreenBtn')) {
      var fsBtn = document.createElement('button');
      fsBtn.id = 'editorFullscreenBtn';
      fsBtn.className = 'btn btn-sm';
      fsBtn.textContent = 'Fullscreen';
      fsBtn.style.cssText = 'font-size:.68rem;text-transform:uppercase;letter-spacing:.6px';
      fsBtn.onclick = toggleEditorFullscreen;
      headerRight.insertBefore(fsBtn, headerRight.firstChild);
    }
  };
})();
