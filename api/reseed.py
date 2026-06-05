import os, re, json, requests, xml.etree.ElementTree as ET
from datetime import datetime

XML = r'C:\Users\Louis\Downloads\Squarespace-Wordpress-Export-06-05-2026.xml'
NS = {'content': 'http://purl.org/rss/1.0/modules/content/', 'wp': 'http://wordpress.org/export/1.2/'}

BASE = r'C:\Users\Louis\Desktop\Code\Feats'
API = 'https://feats-api.fpvgate-analytics.workers.dev/api/articles'

tree = ET.parse(XML)
channel = tree.getroot().find('channel')

articles = []
for item in channel.findall('item'):
    if item.findtext('wp:status', '', NS) != 'publish':
        continue
    link = item.findtext('link', '')
    url_id = link.split('/')[-1] if '/' in link else ''
    if not url_id:
        continue

    title = item.findtext('title', 'Untitled')
    body = item.findtext('content:encoded', '', NS) or ''
    excerpt_raw = item.findtext('{http://wordpress.org/export/1.2/excerpt/}encoded', '', NS) or ''
    excerpt = re.sub(r'<[^>]+>', '', excerpt_raw)[:300]
    author = (item.findtext('dc:creator', 'Feats.') or 'Feats.').strip()
    dt = datetime.now()
    try:
        dt = datetime.strptime(item.findtext('wp:post_date', '', NS)[:19], '%Y-%m-%d %H:%M:%S')
    except:
        pass
    publish_date = dt.strftime('%Y-%m-%d %H:%M:%S')
    cats = ', '.join(c.text for c in item.findall('category') if c.get('domain') == 'category' and c.text)
    m = re.search(r'<img[^>]+src="([^"]+)"', body)
    cover = m.group(1) if m else ''
    cover_local = '/images/hero-3.jpg'
    if cover:
        fname = cover.split('/')[-1].split('?')[0]
        local_path = os.path.join(BASE, 'images', 'articles', fname)
        if os.path.exists(local_path):
            cover_local = '/images/articles/' + fname

    articles.append({
        'url_id': url_id,
        'title': title,
        'body': body,
        'excerpt': excerpt,
        'author': author,
        'publish_date': publish_date,
        'categories': cats,
        'cover_url': cover_local,
        'status': 'publish',
    })

print(f'Parsed {len(articles)} articles')

# Update article_index.json
index_data = []
for a in articles:
    index_data.append({
        'url_id': a['url_id'],
        'title': a['title'],
        'excerpt': a['excerpt'],
        'author': a['author'],
        'publish_date': a['publish_date'],
        'categories': a['categories'],
        'cover_url': a['cover_url'],
    })

with open(os.path.join(BASE, 'article_index.json'), 'w', encoding='utf-8') as f:
    json.dump(index_data, f, indent=2)
print('article_index.json updated')

# Sort by publish_date descending so newest first
articles.sort(key=lambda a: a['publish_date'], reverse=True)

# Re-seed via API
ok = 0
fail = 0
for i, a in enumerate(articles):
    try:
        r = requests.post(API, json=a, timeout=30)
        if r.status_code == 201:
            ok += 1
        else:
            fail += 1
    except Exception as e:
        fail += 1
    if (i + 1) % 20 == 0:
        print(f'  {i+1}/{len(articles)} ({ok} ok, {fail} fail)')

print(f'Done! {ok} seeded, {fail} failed')
