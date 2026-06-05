import os, re, json, xml.etree.ElementTree as ET
from datetime import datetime

XML_PATH = r'C:\Users\Louis\Downloads\Squarespace-Wordpress-Export-06-05-2026.xml'
BASE = r'C:\Users\Louis\Desktop\Code\Feats'
NS = {'content': 'http://purl.org/rss/1.0/modules/content/', 'wp': 'http://wordpress.org/export/1.2/'}

IMG_API = 'https://feats-api.fpvgate-analytics.workers.dev/images/articles'

tree = ET.parse(XML_PATH)
channel = tree.getroot().find('channel')

def swap_img(match):
    full = match.group(0)
    src = match.group(1)
    if 'squarespace-cdn.com' in src:
        fname = src.split('/')[-1].split('?')[0]
        local_path = os.path.join(BASE, 'images', 'articles', fname)
        if os.path.exists(local_path):
            src = IMG_API + '/' + fname
    return '<img src="' + src + '" alt="" style="max-width:100%;height:auto;display:block;margin:1.5rem 0;border-radius:4px">'

def clean(body):
    body = re.sub(r'\[caption[^\]]*\]', '', body)
    body = re.sub(r'\[/caption\]', '', body)
    body = re.sub(r'<div class="sqs-html-content"[^>]*>', '', body)
    body = re.sub(r'</div>', '', body)
    body = re.sub(r'<p class=""[^>]*>', '<p>', body)
    body = re.sub(r' style="[^"]*"', '', body)
    body = re.sub(r' class="[^"]*"', '', body)
    body = re.sub(r' data-[a-z-]+="[^"]*"', '', body)
    body = re.sub(r'<hr[^>]*>', '<hr style="margin:2rem 0;border:none;border-top:1px solid rgba(0,0,0,.1)">', body)
    body = re.sub(r'<img[^>]+src="([^"]+)"[^>]*>', swap_img, body)
    body = re.sub(r'<p>&nbsp;</p>', '', body)
    body = re.sub(r'\n{3,}', '\n\n', body)
    return body.strip()

articles = []
for item in channel.findall('item'):
    if item.findtext('wp:status', '', NS) != 'publish':
        continue
    link = item.findtext('link', '')
    url_id = link.split('/')[-1] if '/' in link else ''
    if not url_id:
        continue

    title = item.findtext('title', 'Untitled')
    body = clean(item.findtext('content:encoded', '', NS) or '')
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
    cover_url = m.group(1) if m else '/images/hero-3.jpg'

    articles.append({
        'url_id': url_id, 'title': title, 'body': body,
        'excerpt': excerpt, 'author': author,
        'publish_date': publish_date, 'categories': cats,
        'cover_url': cover_url, 'status': 'publish',
    })

print(f'Cleaned {len(articles)} articles')

with open(os.path.join(BASE, 'api', 'articles_clean.json'), 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=2)

index = [{k: a[k] for k in ['url_id','title','excerpt','author','publish_date','categories','cover_url']} for a in articles]
with open(os.path.join(BASE, 'article_index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, indent=2)

print('Sample body:')
print(articles[0]['body'][:400])
