import os, re, json, requests

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
IMG_API = 'https://feats-api.fpvgate-analytics.workers.dev/images/articles'
HEADER = '''<header class="site-header">
    <a href="/" class="site-logo">Feats.</a>
    <button class="nav-toggle" id="navToggle" aria-label="Toggle menu">&#9776;</button>
    <nav class="nav-links" id="navLinks">
      <a href="/feats-live/music">Music</a>
      <a href="/feats-live/about">About</a>
      <a href="/feats-live/contact">Contact</a>
      <div class="social-links">
        <a href="https://www.instagram.com/feats.live/" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#0a0a0a"><path d="M12 2.163c3.204 0 3.584.012 4.85.07..."/></svg>
        </a>
        <a href="https://www.youtube.com/@FeatsLive" target="_blank" rel="noopener" aria-label="YouTube">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#0a0a0a"><path d="M23.498 6.186..."/></svg>
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

print('Loading articles...')
r = requests.get('https://feats-api.fpvgate-analytics.workers.dev/api/articles')
articles = r.json()['articles']
print(f'{len(articles)} articles')

# Try to fetch proper bodies
for i, a in enumerate(articles):
    if a.get('body') and len(a.get('body','')) > 100:
        continue
    try:
        r2 = requests.get(f'https://feats.live/music/{a["url_id"]}?format=json-pretty', timeout=10)
        if r2.status_code == 200:
            body = r2.json()['item']['body']
            # Extract text from sqs-html-content as fallback
            texts = re.findall(r'<div class="sqs-html-content"[^>]*>(.*?)</div>', body, re.DOTALL)
            cleaned = []
            for t in texts:
                t = re.sub(r'<p class=""[^>]*>', '<p>', t)
                t = re.sub(r' style="[^"]*"', '', t)
                t = re.sub(r' data-[a-z-]+="[^"]*"', '', t)
                t = re.sub(r' class="[^"]*"', '', t)
                cleaned.append(t)
            # Also grab images with float
            imgs = re.findall(r'<div class="sqs-block image-block[^"]*"[^>]*>(.*?)</div>\s*</div>', body, re.DOTALL)
            for img_block in imgs:
                m = re.search(r'<img[^>]+src="([^"]+)"[^>]*>', img_block)
                if m:
                    src = m.group(1)
                    if 'squarespace-cdn.com' in src:
                        fn = src.split('/')[-1].split('?')[0]
                        if os.path.exists(os.path.join(BASE, 'images', 'articles', fn)):
                            src = IMG_API + '/' + fn
                    cap = re.search(r'<div class="image-caption"><p[^>]*>(.*?)</p>', img_block)
                    caption = re.sub(r'<[^>]+>', '', cap.group(1)).strip() if cap else ''
                    fc = ''
                    if 'float-right' in img_block:
                        fc = ' style="width:45%;height:auto;float:right;margin:0.5rem 0 0.5rem 1.5rem;border-radius:4px"'
                    elif 'float-left' in img_block:
                        fc = ' style="width:45%;height:auto;float:left;margin:0.5rem 1.5rem 0.5rem 0;border-radius:4px"'
                    else:
                        fc = ' style="width:100%;height:auto;display:block;margin:1.5rem 0;border-radius:4px"'
                    out = f'<img src="{src}" alt=""{fc} loading="lazy">'
                    if caption:
                        out += f'<p style="font-size:.85rem;opacity:.6;clear:both">{caption}</p>'
                    cleaned.append(out)
            if cleaned:
                a['body'] = '\n'.join(cleaned)
    except:
        pass
    if (i+1) % 20 == 0:
        bodies = sum(1 for a in articles if a.get('body') and len(a['body']) > 100)
        print(f'  {i+1}/{len(articles)} ({bodies} bodies)')

bodies = sum(1 for a in articles if a.get('body') and len(a['body']) > 100)
print(f'Total with bodies: {bodies}')

# Save
with open(os.path.join(BASE, 'api', 'articles_clean.json'), 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=2)

index = [{k: a[k] for k in ['url_id','title','excerpt','author','publish_date','categories','cover_url']} for a in articles]
with open(os.path.join(BASE, 'article_index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, indent=2)

# Regenerate article pages
print('Regenerating article pages...')
music_dir = os.path.join(BASE, 'music')
count = 0
for a in articles:
    body = a.get('body', '')
    if not body or len(body) < 50:
        continue
    title = a['title']
    url_id = a['url_id']
    excerpt = a.get('excerpt','')[:160]
    author = a.get('author','Feats.')
    pd = a.get('publish_date','')[:10]
    cats = ' &middot; '.join(a.get('categories','').split(', ')[:5]) if a.get('categories') else 'Article'
    cover = a.get('cover_url','')
    if not cover:
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
  <style>
    .article-body{{max-width:750px;margin:0 auto;padding:3rem 2rem}}
    .article-body .featured-img{{width:100%;height:auto;margin-bottom:2rem}}
    .article-body h1{{font-size:2.2rem;margin-bottom:.5rem;line-height:1.2}}
    .article-body .meta{{font-size:.8rem;opacity:.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2rem}}
    .article-body p{{font-size:1.05rem;opacity:.85;margin-bottom:1.5rem;line-height:1.8}}
    .article-body img{{max-width:100%;height:auto;border-radius:4px}}
    .article-body a{{text-decoration:underline;opacity:.8}}
    .article-body a:hover{{opacity:1}}
    .img-wrap-right{{float:right;width:45%;margin:0.5rem 0 0.5rem 1.5rem}}
    .img-wrap-left{{float:left;width:45%;margin:0.5rem 1.5rem 0.5rem 0}}
    @media(max-width:600px){{.img-wrap-right,.img-wrap-left{{float:none;width:100%;margin:1rem 0}}}}
  </style>
</head>
<body>
{HEADER}
  <main class="page-wrap">
    <article class="article-body">
      <img class="featured-img" src="{cover}" alt="{title}" loading="lazy">
      <div class="meta">{cats} &middot; {author} &middot; {pd}</div>
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
print('Done!')
