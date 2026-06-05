import os, json

BASE = r'C:\Users\Louis\Desktop\Code\Feats'

with open(os.path.join(BASE, 'api', 'articles_clean.json'), 'r', encoding='utf-8') as f:
    articles = json.load(f)

HEADER_NAV = '''<header class="site-header">
    <a href="/" class="site-logo">Feats.</a>
    <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">&#9776;</button>
    <nav class="nav-links" id="navLinks">
      <a href="/feats-live/music">Music</a>
      <a href="/feats-live/about">About</a>
      <a href="/feats-live/contact">Contact</a>
      <div class="social-links">
        <a href="https://www.instagram.com/feats.live/" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#0a0a0a"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        </a>
        <a href="https://www.youtube.com/@FeatsLive" target="_blank" rel="noopener" aria-label="YouTube">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#0a0a0a"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        </a>
      </div>
    </nav>
  </header>'''

FOOTER = '''<footer class="site-footer">
    <div class="brand">Feats.</div>
    <div class="info"><a href="mailto:Info@Feats.Live">Info@Feats.Live</a> &nbsp;|&nbsp; <a href="https://www.instagram.com/feats.live/" target="_blank">Instagram</a> &nbsp;|&nbsp; <a href="https://www.youtube.com/@FeatsLive" target="_blank">YouTube</a></div>
    <div class="info">Brighton and London Based</div>
    <div class="info">&copy; 2026 FEATS LIVE CIC | Company Number: 16660624</div>
    <div class="footer-links">
      <a href="/feats-live/youth-development">Youth Development Programme</a>
      <a href="/feats-live/privacy-policy">Privacy Policy</a>
      <a href="/feats-live/sitemap.xml">Sitemap</a>
      <a href="/feats-live/robots.txt">Robots.txt</a>
    </div>
  </footer>'''

ART_CSS = '''  <style>
    .article-body{max-width:750px;margin:0 auto;padding:3rem 2rem}
    .article-body .featured-img{width:100%;height:auto;margin-bottom:2rem}
    .article-body h1{font-size:2.2rem;margin-bottom:.5rem;line-height:1.2}
    .article-body .meta{font-size:.8rem;opacity:.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2rem}
    .article-body p{font-size:1.05rem;opacity:.85;margin-bottom:1.5rem;line-height:1.8}
    .article-body img{max-width:100%;height:auto;display:block;margin:1.5rem 0;border-radius:4px}
    .article-body a{text-decoration:underline;opacity:.8}
    .article-body a:hover{opacity:1}
  </style>'''

music_dir = os.path.join(BASE, 'music')
count = 0
for a in articles:
    url_id = a['url_id']
    title = a['title']
    body = a['body']
    excerpt = a['excerpt'][:160]
    author = a['author']
    date_str = a['publish_date']
    cats = ' &middot; '.join(a['categories'].split(', ')[:5]) if a['categories'] else 'Article'
    cover = a['cover_url']
    if not cover or cover == '/images/hero-3.jpg':
        cover = 'https://feats-api.fpvgate-analytics.workers.dev/images/hero-3.jpg'

    page_dir = os.path.join(music_dir, url_id)
    os.makedirs(page_dir, exist_ok=True)

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} &mdash; Feats.</title>
  <meta name="description" content="{excerpt}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,500;0,700;1,500;1,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/feats-live/css/style.css">
  <link rel="icon" type="image/x-icon" href="/feats-live/favicon.ico">
{ART_CSS}
</head>
<body>
{HEADER_NAV}
  <main class="page-wrap">
    <article class="article-body">
      <img class="featured-img" src="{cover}" alt="{title}" loading="lazy">
      <div class="meta">{cats} &middot; {author} &middot; {date_str[:10]}</div>
      <h1>{title}</h1>
      {body}
    </article>
  </main>
{FOOTER}
  <script>
    document.getElementById('navToggle').addEventListener('click', function(){{
      document.getElementById('navLinks').classList.toggle('open');
    }});
  </script>
</body>
</html>'''

    with open(os.path.join(page_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    count += 1

print(f'Generated {count} article pages')
