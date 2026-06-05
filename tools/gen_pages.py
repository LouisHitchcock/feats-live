import json, re, os

BASE = r'C:\Users\Louis\Desktop\code\feats'

with open(os.path.join(BASE, 'articles_parsed.json'), 'r', encoding='utf-8') as f:
    articles = json.load(f)

HEADER_NAV = '''<header class="site-header">
    <a href="/" class="site-logo">Feats.</a>
    <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">&#9776;</button>
    <nav class="nav-links" id="navLinks">
      <a href="/music" class="active" aria-current="page">Music</a>
      <a href="/">Work</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
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
    <div class="info">
      <a href="mailto:Info@Feats.Live">Info@Feats.Live</a>
      &nbsp;|&nbsp;
      <a href="https://www.instagram.com/feats.live/" target="_blank" rel="noopener">Instagram</a>
      &nbsp;|&nbsp;
      <a href="https://www.youtube.com/@FeatsLive" target="_blank" rel="noopener">YouTube</a>
    </div>
    <div class="info">Brighton and London Based</div>
    <div class="info">&copy; 2026 FEATS LIVE CIC | Company Number: 16660624</div>
    <div class="footer-links">
      <a href="/youth-development">Youth Development Programme</a>
      <a href="/s/Feats-Contributor-Code-of-Conduct-V3.pdf">Contributor Code of Conduct</a>
      <a href="/privacy-policy">Privacy Policy</a>
      <a href="/sitemap.xml">Sitemap</a>
      <a href="/robots.txt">Robots.txt</a>
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

def clean_body(body):
    body = re.sub(r' class=""', '', body)
    body = re.sub(r' style="white-space:pre-wrap;?"', '', body)
    body = re.sub(r' data-rte-preserve-empty="true"', '', body)
    body = re.sub(r'<p class="[^"]*"[^>]*>', '<p>', body)
    body = re.sub(r'<hr[^>]*>', '<hr style="margin:2rem 0;border:none;border-top:1px solid rgba(0,0,0,.1)">', body)
    body = re.sub(r'<img([^>]+)>', r'<img\1 style="max-width:100%;height:auto;display:block;margin:1.5rem 0;border-radius:4px">', body)
    return body

def gen_html(article):
    title = article['title']
    url_id = article['url_id']
    cats = ' &middot; '.join(article['cats'][:5]) if article['cats'] else 'Article'
    cover = article['cover'] or '/images/hero-3.jpg'
    author = article['author']
    date_str = article['date_str']
    excerpt = article['excerpt'][:160]
    body = clean_body(article['body'])

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} &mdash; Feats.</title>
  <meta name="description" content="{excerpt}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,500;0,700;1,500;1,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
{ART_CSS}
</head>
<body>
{HEADER_NAV}
  <main class="page-wrap">
    <article class="article-body">
      <img class="featured-img" src="{cover}" alt="{title}" loading="lazy">
      <div class="meta">{cats} &middot; {author} &middot; {date_str}</div>
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

def gen_listing(articles):
    cards = []
    for a in articles[:20]:
        cats = ' &middot; '.join(a['cats'][:3]) if a['cats'] else 'Article'
        cover = a['cover'] or '/images/hero-3.jpg'
        card = f'''
        <article class="music-card">
          <a href="/music/{a['url_id']}">
            <img src="{cover}" alt="{a['title']}" loading="lazy">
            <div class="meta"><span>{cats}</span><span>{a['author']}</span><span>{a['date_str']}</span></div>
            <h2>{a['title']}</h2>
            <p>{a['excerpt'][:200]}</p>
            <span class="read-more">Read More</span>
          </a>
        </article>'''
        cards.append(card)

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Music | Discover Gig Highlights &mdash; Feats.</title>
  <meta name="description" content="Browse Feats. music articles: live gig reviews, interviews, artist showcases, festival coverage, and editorial content.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,500;0,700;1,500;1,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
{HEADER_NAV}
  <main class="page-wrap">
    <section class="section">
      <h1 class="section-title">Music</h1>
      <div class="music-grid">
{"".join(cards)}
      </div>
      <div style="text-align:center;margin-top:3rem">
        <a href="/music?offset=0" class="btn">Older Posts</a>
      </div>
    </section>
  </main>
{FOOTER}
  <script>
    document.getElementById('navToggle').addEventListener('click', function(){{
      document.getElementById('navLinks').classList.toggle('open');
    }});
  </script>
</body>
</html>'''

music_dir = os.path.join(BASE, 'music')
generated = 0
failed = 0
for i, a in enumerate(articles):
    page_dir = os.path.join(music_dir, a['url_id'])
    os.makedirs(page_dir, exist_ok=True)
    try:
        html = gen_html(a)
        with open(os.path.join(page_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        generated += 1
        if (i + 1) % 20 == 0:
            print(f'  {i+1}/{len(articles)}...')
    except Exception as e:
        failed += 1
        print(f'  FAIL {a["url_id"]}: {e}')

print(f'Generated {generated} articles, {failed} failed')

print('Generating music listing...')
with open(os.path.join(music_dir, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(gen_listing(articles))

print('Generating sitemap...')
urls = []
for a in articles:
    urls.append(f'  <url><loc>https://feats.live/music/{a["url_id"]}</loc></url>')
sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://feats.live/</loc><priority>1.0</priority></url>
  <url><loc>https://feats.live/music</loc><priority>0.9</priority></url>
  <url><loc>https://feats.live/about</loc><priority>0.7</priority></url>
  <url><loc>https://feats.live/contact</loc><priority>0.6</priority></url>
{"".join(urls)}
</urlset>'''
with open(os.path.join(BASE, 'sitemap.xml'), 'w', encoding='utf-8') as f:
    f.write(sitemap)

print(f'Done! Sitemap has {len(urls)} article URLs')
