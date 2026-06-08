
// ===== STATE =====
var API = 'https://feats-live.louishitchcock.xyz';
var currentUser = null;

// ===== AUTH =====
function loginWithGoogle() {
  window.location.href = API + '/auth/google';
}
function logout() {
  localStorage.removeItem('feats_admin_token');
  currentUser = null;
  window.history.replaceState({}, document.title, '/admin');
  window.location.reload();
}

function checkAuth() {
  var token = localStorage.getItem('feats_admin_token');
  if (!token) return;
  fetch(API + '/admin/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
    .then(function(user) {
      currentUser = user;
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('adminLayout').classList.add('active');
      document.getElementById('userInfo').textContent = user.name + ' (' + user.role + ')';
      try {
        showTab('dashboard');
      } catch (e) {
        console.error('Failed to load default tab', e);
      }
    })
    .catch(function(err) {
      console.error('Auth check failed', err);
      localStorage.removeItem('feats_admin_token');
    });
}

// Extract token from URL after OAuth redirect
var params = new URLSearchParams(window.location.search);
if (params.get('token')) {
  localStorage.setItem('feats_admin_token', params.get('token'));
  window.history.replaceState({}, document.title, '/admin');
  checkAuth();
} else {
  checkAuth();
}

// ===== TABS =====
function showTab(name, clickedEl) {
  document.querySelectorAll('.sidebar nav a').forEach(function(a) { a.classList.remove('active'); });
  if (clickedEl && clickedEl.classList) {
    clickedEl.classList.add('active');
  } else {
    var activeNav = document.querySelector('.sidebar nav a[data-tab="' + name + '"]');
    if (activeNav) activeNav.classList.add('active');
  }

  switch(name) {
    case 'dashboard': loadDashboard(); break;
    case 'articles': loadArticles(); break;
    case 'writers': loadWriters(); break;
    case 'users': loadUsers(); break;
    case 'analytics': loadAnalytics(); break;
    case 'tech': loadTech(); break;
  }
}

// ===== API HELPERS =====
function apiHeaders() {
  var h = { 'Content-Type': 'application/json' };
  var token = localStorage.getItem('feats_admin_token');
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

function apiGet(path) {
  return fetch(API + path, { headers: apiHeaders() }).then(function(r) {
    if (r.status === 401) { localStorage.removeItem('feats_admin_token'); window.location.reload(); }
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
}

function apiPost(path, body) {
  return fetch(API + path, { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) }).then(function(r) {
    if (r.status === 401) { localStorage.removeItem('feats_admin_token'); window.location.reload(); }
    return r;
  });
}

function apiPut(path, body) {
  return fetch(API + path, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify(body) }).then(function(r) {
    if (r.status === 401) { localStorage.removeItem('feats_admin_token'); window.location.reload(); }
    return r;
  });
}

function apiDelete(path) {
  return fetch(API + path, { method: 'DELETE', headers: apiHeaders() }).then(function(r) {
    if (r.status === 401) { localStorage.removeItem('feats_admin_token'); window.location.reload(); }
    return r;
  });
}

// ===== MODAL =====
function openModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
  document.getElementById('modalContent').innerHTML = '';
}

document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ===== DASHBOARD =====
function loadDashboard() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<h1>Dashboard</h1><div class="stats-grid" id="statsGrid"></div><div id="recentActivity"></div>';

  apiGet('/admin/dashboard').then(function(d) {
    var grid = document.getElementById('statsGrid');
    grid.innerHTML = '';
    var stats = [
      { label: 'Total Articles', value: d.totalArticles, sub: d.publishedArticles + ' published' },
      { label: 'Total Writers', value: d.totalWriters, sub: '' },
      { label: 'Total Views', value: d.totalViews || 0, sub: d.uniqueVisitors ? d.uniqueVisitors + ' unique' : '' },
      { label: 'Storage Used', value: d.storageMB ? d.storageMB + ' MB' : 'N/A', sub: '' }
    ];
    stats.forEach(function(s) {
      grid.innerHTML += '<div class="stat-card"><h3>' + s.label + '</h3><div class="value">' + s.value + '</div><div class="sub">' + s.sub + '</div></div>';
    });
  });
}

// ===== ARTICLES =====
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
  markdownDraft: ''
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
  if (isArticleMarkdownMode() && markdownEl) {
    articleState.markdownDraft = markdownEl.value;
    articleState.current.body = markdownToArticleHtml(markdownEl.value);
    if (bodyEl) bodyEl.innerHTML = articleState.current.body || '';
  } else if (bodyEl) {
    articleState.current.body = bodyEl.innerHTML;
    articleState.markdownDraft = articleHtmlToMarkdown(articleState.current.body);
    if (markdownEl) markdownEl.value = articleState.markdownDraft;
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
  return '<div class="article-field"><label>Title</label><input id="articleTitleInput" class="article-input" value="' + escAttr(article.title) + '" placeholder="Article title"></div><div class="article-field"><label>Article Body</label><div id="articleBodyEditor" class="editor-canvas" contenteditable="true">' + (article.body || '') + '</div><div class="editor-floating-toolbar"><button type="button" onclick="applyArticleFormat(&quot;bold&quot;)"><b>B</b></button><button type="button" onclick="applyArticleFormat(&quot;italic&quot;)"><i>I</i></button><button type="button" onclick="applyArticleFormat(&quot;underline&quot;)"><u>U</u></button><span class="editor-floating-sep"></span><button type="button" onclick="formatArticleHeading()">H2</button><button type="button" onclick="applyArticleFormat(&quot;insertUnorderedList&quot;)">UL</button><button type="button" onclick="applyArticleFormat(&quot;insertOrderedList&quot;)">OL</button><span class="editor-floating-sep"></span><button type="button" onclick="insertArticleLink()">Link</button><button type="button" onclick="applyArticleFormat(&quot;removeFormat&quot;)">Clear</button><span class="editor-floating-sep"></span><button type="button" onclick="formatArticleCode()">&lt;/&gt;</button><button type="button" class="btn-insert-image" onclick="toggleArticleImagePanel()">+ IMAGE</button></div><div id="articleImageOverlayBackdrop" class="article-image-overlay-backdrop"></div><div id="articleImageInsertPanel" class="article-image-insert-panel"><button class="overlay-close" onclick="toggleArticleImagePanel(false)">x</button><h3>Insert Media</h3><div class="article-image-insert-rows"><div class="article-image-insert-row"><label>Upload or drag images</label><div class="article-image-dropzone" id="imageDropZone" onclick="document.getElementById(&apos;imageUploadFileInput&apos;).click()" ondragover="this.classList.add(&apos;drag-over&apos;);return false" ondragleave="this.classList.remove(&apos;drag-over&apos;)" ondrop="handleImageDrop(event);this.classList.remove(&apos;drag-over&apos;);return false"><span class="dropzone-icon">+</span><span>Click or drag images here</span><input type="file" id="imageUploadFileInput" accept="image/*" multiple onchange="handleArticleImageUpload(this.files)"></div></div><div id="imageUploadPreview" class="article-image-uploaded-previews"></div><div class="article-image-insert-row"><label>Layout</label><select id="imageOverlayLayout" class="article-select" onchange="toggleArticleCarouselInput()"><option value="full">Full Width</option><option value="left">Float Left</option><option value="right">Float Right</option><option value="carousel">Carousel</option></select><input id="imageOverlayCaption" class="article-input" placeholder="Optional caption"></div><div class="article-image-insert-row"><label>Recent uploads</label><div id="imageOverlayRecent" class="article-image-recent"></div></div></div><div class="article-image-insert-actions"><button type="button" class="btn btn-sm" onclick="toggleArticleImagePanel(false)">Cancel</button><button type="button" class="btn btn-sm btn-primary" onclick="insertArticleImageBlock()">Insert</button></div></div></div>';
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

function ensureArticleEditorModeUi(editor, toolbar) {
  var field = editor.parentElement;
  if (!field) return;
  var modeToggle = document.getElementById('articleEditorModeToggle');
  if (!modeToggle) {
    modeToggle = document.createElement('div');
    modeToggle.id = 'articleEditorModeToggle';
    modeToggle.className = 'article-editor-mode-toggle';
    modeToggle.innerHTML = '<button type="button" data-mode="rich">Rich Text</button><button type="button" data-mode="markdown">Markdown</button>';
    var label = field.querySelector('label');
    if (label && label.nextSibling) field.insertBefore(modeToggle, label.nextSibling);
    else field.insertBefore(modeToggle, editor);
    modeToggle.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      setArticleEditorMode(btn.getAttribute('data-mode'));
    });
  }
  var markdownInput = document.getElementById('articleBodyMarkdownInput');
  if (!markdownInput) {
    markdownInput = document.createElement('textarea');
    markdownInput.id = 'articleBodyMarkdownInput';
    markdownInput.className = 'article-textarea article-markdown-input';
    markdownInput.placeholder = 'Write Markdown here...';
    markdownInput.setAttribute('spellcheck', 'false');
    editor.insertAdjacentElement('afterend', markdownInput);
  }
  if (!markdownInput.dataset.modeBound) {
    markdownInput.addEventListener('input', function() {
      if (!isArticleMarkdownMode()) return;
      articleState.markdownDraft = markdownInput.value;
      articleState.current.body = markdownToArticleHtml(markdownInput.value);
    });
    markdownInput.dataset.modeBound = '1';
  }
  if (!articleState.markdownDraft) {
    articleState.markdownDraft = articleHtmlToMarkdown(editor.innerHTML);
  }
  markdownInput.value = articleState.markdownDraft;
  applyArticleEditorModeUI();
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
  var toolbar = document.querySelector('.editor-floating-toolbar');
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
  var toolbar = document.querySelector('.editor-floating-toolbar');
  ensureArticleEditorModeUi(editor, toolbar);
  if (toolbar && !toolbar.dataset.selectionGuard) {
    toolbar.addEventListener('mousedown', function(e) {
      if (e.target.closest('button')) e.preventDefault();
    });
    toolbar.dataset.selectionGuard = '1';
  }
  var backdrop = document.getElementById('articleImageOverlayBackdrop');
  if (backdrop) {
    backdrop.onclick = function() {
      toggleArticleImagePanel(false);
    };
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
  toggleArticleImagePanel(false);
  saveEditorSelection();
}

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
function ensureArticleContextMenu() {
  var menu = document.getElementById('articleEditorContextMenu');
  if (menu) return menu;
  menu = document.createElement('div');
  menu.id = 'articleEditorContextMenu';
  menu.className = 'editor-context-menu';
  menu.innerHTML = '<button type="button" data-action="divider">Insert Divider Line</button><button type="button" data-action="image">Insert Image</button><button type="button" data-action="carousel">Insert Carousel</button><div class="menu-separator"></div><button type="button" data-action="quote">Insert Pull Quote</button><button type="button" data-action="callout">Insert Callout Box</button><div class="menu-separator"></div><button type="button" data-action="spacer-sm">Insert Small Spacer</button><button type="button" data-action="spacer-md">Insert Medium Spacer</button><button type="button" data-action="spacer-lg">Insert Large Spacer</button><div class="menu-separator"></div><button type="button" data-action="cta">Insert CTA Button</button>';
  menu.addEventListener('mousedown', function(e) {
    e.preventDefault();
  });
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
  var slides = '';
  var thumbs = '';
  urls.forEach(function(url, idx) {
    var activeClass = idx === 0 ? ' active' : '';
    slides += '<div class="carousel-slide' + activeClass + '"><img src="' + escAttr(url) + '" alt="' + escAttr(caption || ('Carousel image ' + (idx + 1))) + '"></div>';
    thumbs += '<button type="button" class="carousel-thumb' + activeClass + '" onclick="changeCarouselSlide(&quot;' + carouselId + '&quot;, ' + idx + ')"><img src="' + escAttr(url) + '" alt="Thumbnail ' + (idx + 1) + '"></button>';
  });
  var html = '<div id="' + carouselId + '" class="article-carousel article-media article-media--full" data-article-carousel data-current-slide="0"><button type="button" class="carousel-nav carousel-nav-prev" onclick="moveCarouselSlide(&quot;' + carouselId + '&quot;, -1)">&#10094;</button><div class="carousel-slides">' + slides + '</div><button type="button" class="carousel-nav carousel-nav-next" onclick="moveCarouselSlide(&quot;' + carouselId + '&quot;, 1)">&#10095;</button><div class="carousel-thumbnails">' + thumbs + '</div>';
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
    slides[i].classList.toggle('active', i === safeIndex);
  }
  for (var j = 0; j < thumbs.length; j++) {
    thumbs[j].classList.toggle('active', j === safeIndex);
  }
}

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
  if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
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

// ===== WRITERS =====
function loadWriters() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<h1>Writers / Contributors</h1><button class="btn btn-primary" onclick="showNewWriter()">+ Add Writer</button><div class="card" style="margin-top:1rem"><table><thead><tr><th>Name</th><th>Photo</th><th>Bio</th><th></th></tr></thead><tbody id="writersBody"></tbody></table></div>';

  apiGet('/admin/writers').then(function(d) {
    var body = document.getElementById('writersBody');
    d.writers.forEach(function(w) {
      body.innerHTML += '<tr><td>' + esc(w.name) + '</td><td>' + (w.photo_url ? '<img src="' + esc(w.photo_url) + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover">' : '-') + '</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(w.bio || '') + '</td><td><button class="btn btn-sm btn-primary" onclick="editWriter(' + w.id + ')">Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteWriter(' + w.id + ')">Delete</button></td></tr>';
    });
  });
}

function showNewWriter() {
  openModal('<h2>Add Writer</h2><label>Name</label><input id="writerName"><label>Photo</label><div class="writer-photo-upload"><input type="file" id="writerPhotoFile" accept="image/*"><div id="writerPhotoPreview"></div></div><label>Bio</label><textarea id="writerBio"></textarea><div class="modal-footer"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveNewWriter()">Save</button></div>');
}

function saveNewWriter() {
  var file = document.getElementById('writerPhotoFile').files[0];
  var name = document.getElementById('writerName').value;
  var bio = document.getElementById('writerBio').value;
  if (!name) { alert('Name required'); return; }

  function doSave(photoUrl) {
    apiPost('/admin/writers', { name: name, photo_url: photoUrl || '', bio: bio })
      .then(function() { closeModal(); loadWriters(); })
      .catch(function(e) { alert('Error: ' + e.message); });
  }

  if (file) {
    uploadImage(file).then(doSave).catch(function(e) { alert('Upload failed: ' + e.message); });
  } else {
    doSave('');
  }
}

function editWriter(id) {
  apiGet('/admin/writers/' + id).then(function(d) {
    var w = d.writer;
    openModal('<h2>Edit Writer</h2><label>Name</label><input id="writerName" value="' + esc(w.name) + '"><label>Photo</label><div class="writer-photo-upload">' + (w.photo_url ? '<div class="writer-photo-current"><img src="' + esc(w.photo_url) + '"><button class="btn btn-sm btn-danger" onclick="removeWriterPhoto(' + id + ')">Remove Photo</button></div>' : '') + '<input type="file" id="writerPhotoFile" accept="image/*"><div id="writerPhotoPreview"></div></div><label>Bio</label><textarea id="writerBio">' + esc(w.bio || '') + '</textarea><div class="modal-footer"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveEditWriter(' + id + ')">Save</button></div>');
  });
}

function saveEditWriter(id) {
  var file = document.getElementById('writerPhotoFile').files[0];
  var name = document.getElementById('writerName').value;
  var bio = document.getElementById('writerBio').value;
  if (!name) { alert('Name required'); return; }

  function doSave(photoUrl) {
    apiPut('/admin/writers/' + id, { name: name, photo_url: photoUrl || '', bio: bio })
      .then(function() { closeModal(); loadWriters(); })
      .catch(function(e) { alert('Error: ' + e.message); });
  }

  if (file) {
    uploadImage(file).then(doSave).catch(function(e) { alert('Upload failed: ' + e.message); });
  } else {
    doSave(null);
  }
}

function deleteWriter(id) {
  if (!confirm('Delete this writer?')) return;
  apiDelete('/admin/writers/' + id).then(function() { loadWriters(); }).catch(function(e) { alert('Error: ' + e.message); });
}

// ===== ADMIN USERS =====
function loadUsers() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<h1>Admin Users</h1>' + (currentUser && currentUser.role === 'superadmin' ? '<button class="btn btn-primary" onclick="showNewUser()">+ Add User</button>' : '') + '<div class="card" style="margin-top:1rem"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th></th></tr></thead><tbody id="usersBody"></tbody></table></div>';

  apiGet('/admin/users').then(function(d) {
    var body = document.getElementById('usersBody');
    d.users.forEach(function(u) {
      body.innerHTML += '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.email) + '</td><td><span class="badge badge-' + u.role + '">' + u.role + '</span></td><td>' + (u.last_login || '').slice(0,10) + '</td><td>' + (currentUser && currentUser.role === 'superadmin' && u.role !== 'superadmin' ? '<button class="btn btn-sm btn-danger" onclick="deleteUser(' + u.id + ')">Remove</button>' : '') + '</td></tr>';
    });
  });
}

function showNewUser() {
  openModal('<h2>Add Admin User</h2><label>Email</label><input id="userEmail" placeholder="google@email.com"><label>Name</label><input id="userName"><label>Role</label><select id="userRole"><option value="admin">Admin</option><option value="superadmin">Super Admin</option></select><div class="modal-footer"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveNewUser()">Add</button></div>');
}

function saveNewUser() {
  var body = {
    email: document.getElementById('userEmail').value,
    name: document.getElementById('userName').value,
    role: document.getElementById('userRole').value
  };
  if (!body.email) { alert('Email required'); return; }
  apiPost('/admin/users', body).then(function() { closeModal(); loadUsers(); }).catch(function(e) { alert('Error: ' + e.message); });
}

function deleteUser(id) {
  if (!confirm('Remove this admin user?')) return;
  apiDelete('/admin/users/' + id).then(function() { loadUsers(); }).catch(function(e) { alert('Error: ' + e.message); });
}

// ===== ANALYTICS =====
function loadAnalytics() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<h1>Analytics</h1><p style="color:#888;margin-bottom:1rem">Analytics tracking will be populated as visitors browse the site.</p><div class="stats-grid" id="analyticsGrid"><div class="stat-card"><h3>Total Page Views</h3><div class="value">---</div></div><div class="stat-card"><h3>Unique Visitors</h3><div class="value">---</div></div><div class="stat-card"><h3>Countries</h3><div class="value">---</div></div></div><div class="card"><h3 style="margin-bottom:1rem">Top Articles</h3><table><thead><tr><th>Article</th><th>Views</th><th>Unique Visitors</th></tr></thead><tbody id="analyticsTopBody"><tr><td colspan="3" style="text-align:center;color:#888">Loading...</td></tr></tbody></table></div>';

  apiGet('/admin/analytics').then(function(d) {
    var grid = document.getElementById('analyticsGrid');
    grid.innerHTML = '<div class="stat-card"><h3>Total Page Views</h3><div class="value">' + (d.totalViews || 0) + '</div></div><div class="stat-card"><h3>Unique Visitors</h3><div class="value">' + (d.uniqueVisitors || 0) + '</div></div><div class="stat-card"><h3>Countries</h3><div class="value">' + (d.countries || 0) + '</div></div>';

    var body = document.getElementById('analyticsTopBody');
    body.innerHTML = '';
    if (d.topArticles && d.topArticles.length) {
      d.topArticles.forEach(function(a) {
        body.innerHTML += '<tr><td>' + esc(a.title) + '</td><td>' + a.views + '</td><td>' + a.unique_visitors + '</td></tr>';
      });
    } else {
      body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888">No data yet</td></tr>';
    }
  });
}

// ===== TECHNICAL =====
function loadTech() {
  var main = document.getElementById('mainContent');
  main.innerHTML = '<h1>Technical Details</h1><div class="stats-grid" id="techGrid"></div><div class="card" style="margin-top:1rem"><h3>Environment</h3><pre style="background:#f8f8f8;padding:1rem;border-radius:6px;margin-top:.5rem;font-size:.85rem;overflow-x:auto" id="techEnv"></pre></div>';

  apiGet('/admin/tech').then(function(d) {
    var grid = document.getElementById('techGrid');
    grid.innerHTML = '<div class="stat-card"><h3>R2 Images</h3><div class="value">' + (d.r2ImageCount || 'N/A') + '</div><div class="sub">' + (d.r2StorageMB || 'N/A') + ' MB used</div></div><div class="stat-card"><h3>Database Size</h3><div class="value">' + (d.dbSizeMB || 'N/A') + ' MB</div></div><div class="stat-card"><h3>Worker</h3><div class="value">feats-live</div><div class="sub">Custom domain</div></div><div class="stat-card"><h3>Bandwidth</h3><div class="value">' + (d.bandwidthGB || 'N/A') + ' GB</div><div class="sub">This month (estimate)</div></div>';

    document.getElementById('techEnv').textContent = JSON.stringify(d.env, null, 2);
  });
}

// ===== SIDEBAR STATE =====
var sidebarRetractTimer = null;

function applySidebarState(expanded, pinned) {
  var sb = document.querySelector('.sidebar');
  if (!sb) return;
  sb.classList.remove('is-expanded','is-collapsed','is-pinned');
  if (pinned) {
    sb.classList.add('is-pinned','is-expanded');
  } else if (expanded) {
    sb.classList.add('is-expanded');
  } else {
    sb.classList.add('is-collapsed');
  }
}

function sidebarEnter() {
  if (sidebarRetractTimer) {
    clearTimeout(sidebarRetractTimer);
    sidebarRetractTimer = null;
  }
  var sb = document.querySelector('.sidebar');
  if (!sb || sb.classList.contains('is-pinned')) return;
  applySidebarState(true, false);
}

function sidebarLeave() {
  var sb = document.querySelector('.sidebar');
  if (!sb || sb.classList.contains('is-pinned')) return;
  if (sidebarRetractTimer) clearTimeout(sidebarRetractTimer);
  sidebarRetractTimer = setTimeout(function() {
    applySidebarState(false, false);
    sidebarRetractTimer = null;
  }, 200);
}

function toggleSidebarPin() {
  var sb = document.querySelector('.sidebar');
  if (!sb) return;
  var wasPinned = sb.classList.contains('is-pinned');
  var newPinned = !wasPinned;
  localStorage.setItem('feats_admin_sidebar_pin', newPinned ? '1' : '');
  if (newPinned) {
    applySidebarState(true, true);
  } else {
    applySidebarState(false, false);
  }
}

// Init sidebar state from localStorage
(function() {
  var sb = document.querySelector('.sidebar');
  if (!sb) return;
  var isPinned = localStorage.getItem('feats_admin_sidebar_pin') === '1';
  if (isPinned) {
    applySidebarState(true, true);
  } else {
    applySidebarState(false, false);
  }
})();

// ===== UTILITIES =====
// ===== UTILITIES =====
function toggleDarkMode(enabled) {
  document.documentElement.setAttribute('data-theme', enabled ? 'dark' : '');
  localStorage.setItem('feats_admin_dark', enabled ? '1' : '');
}
(function() {
  if (localStorage.getItem('feats_admin_dark') === '1') {
    document.documentElement.setAttribute('data-theme', 'dark');
    var cb = document.getElementById('darkModeToggle');
    if (cb) cb.checked = true;
  }
})();

// ===== UTILITIES =====
function uploadImage(file) {
  return new Promise(function(resolve, reject) {
    var ext = file.name.split('.').pop().toLowerCase();
    var key = 'uploads/' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.' + ext;
    var reader = new FileReader();
    reader.onload = function(e) {
      var contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      fetch(API + '/images/' + key, {
        method: 'PUT',
        headers: Object.assign(apiHeaders(), { 'Content-Type': contentType }),
        body: new Blob([e.target.result], { type: contentType })
      }).then(function(r) {
        if (!r.ok) throw new Error('Upload failed: ' + r.status);
        resolve(API + '/images/' + key);
      }).catch(reject);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function removeWriterPhoto(id) {
  if (!confirm('Remove this writer\'s photo?')) return;
  apiPut('/admin/writers/' + id, { name: document.getElementById('writerName').value, photo_url: '', bio: document.getElementById('writerBio').value })
    .then(function() { closeModal(); loadWriters(); })
    .catch(function(e) { alert('Error: ' + e.message); });
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Check auth on load
document.addEventListener('DOMContentLoaded', function() {
  var sb = document.querySelector('.sidebar');
  if (sb) {
    sb.addEventListener('mouseenter', sidebarEnter);
    sb.addEventListener('mouseleave', sidebarLeave);
  }
  checkAuth();
});
